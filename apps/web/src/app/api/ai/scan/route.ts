import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserWithTier, getLimits, getScanUsage, incrementScanUsage } from '@/lib/subscription'
import { PostHog } from 'posthog-node'
import { charTier, RARITY_W, scarcityScore, detectEra, buildTargets } from '@/lib/investment/helpers'

const ph = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, { host: 'https://eu.i.posthog.com', flushAt: 1, flushInterval: 0 })

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

// ── Prompts ───────────────────────────────────────────────────────────────────

// Prompt A — numéro seul, ultra-focalisé, température 0
const PROMPT_NUMBER = `Look at this Pokémon card image (direct photo or marketplace screenshot).

Find the COLLECTOR NUMBER. It is ALWAYS at the bottom of the card, format "XXX/YYY" like "006/165" or "SV107/SV122".
Also look in any visible text (listing title, description) for a number like "006/165".

Return ONLY this JSON: {"num":"006","total":"165"}
- "num" = left part before the slash (keep leading zeros: "006" not "6")
- "total" = right part after the slash (digits only, no letters)
- If special format like "SV107/SV122": {"num":"SV107","total":"SV122"}
- If not found: {"num":"","total":""}`

// Prompt B — nom seul, toujours les deux langues
const PROMPT_NAME = `Look at this Pokémon card image (direct photo or marketplace screenshot).

Find the POKÉMON NAME. It appears at the top of the card. Also check any visible listing title or description.
Include the variant suffix exactly: ex, EX, GX, VMAX, VSTAR, V, Tag Team, BREAK...

Return ONLY this JSON:
{"enName":"Charizard ex","frName":"Dracaufeu ex","lang":"FR"}

- enName: ALWAYS the English name (e.g. "Charizard ex", "Pikachu VMAX", "Mewtwo GX")
- frName: the name as printed on the card if it's French, else same as enName
- lang: FR/EN/JP/DE/ES/IT/PT (language printed on the card)
- If the card is English: {"enName":"Charizard ex","frName":"Charizard ex","lang":"EN"}
- If not found: {"enName":"","frName":"","lang":"FR"}`

// Prompt C — contexte set (seulement si A et B insuffisants)
const PROMPT_SET = `Look at this Pokémon card image or marketplace screenshot.

Find the SET/EXPANSION name. Look at:
1. The card itself (set symbol, bottom text, copyright line)
2. Any visible listing text (title like "Dracaufeu ex 006/165 Extension 151")

Return ONLY this JSON: {"setName":"151","setId":"sv3pt5"}
- setId: pokemontcg.io format ONLY if 100% certain (sv3pt5, sv3, swsh10...), else ""
- If not found: {"setName":"","setId":""}`

// Prompt de secours si A+B+C échouent tous
const PROMPT_FULL = `You are a Pokémon TCG card identification expert.

This image shows a Pokémon card (direct photo or marketplace screenshot).
Read ALL visible text: card itself, listing title, description.

Return ONLY valid JSON:
{"cardName":"Dracaufeu ex","englishName":"Charizard ex","cardNumber":"006/165","setName":"151","setId":"sv3pt5","language":"FR"}

Rules:
- cardNumber MUST include both parts: "006/165" not just "006"
- englishName: English translation of the Pokémon name
- setId: pokemontcg.io ID only if certain, else ""
- If you cannot find a field, use ""`

// ── Types ─────────────────────────────────────────────────────────────────────
interface AiResult {
  cardName: string; englishName: string; cardNumber: string
  setName: string; setId: string; language: string
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[''`]/g, '').replace(/\s+/g, ' ').trim()
}

function numberVariants(raw: string): string[] {
  const base = raw.split('/')[0].trim()
  if (!base) return []
  const vs = new Set<string>([base])
  const noZeros = base.replace(/^0+(?=[0-9])/, '')
  vs.add(noZeros)
  if (/^\d+$/.test(noZeros)) {
    vs.add(noZeros.padStart(2, '0'))
    vs.add(noZeros.padStart(3, '0'))
  }
  const alpha = base.match(/^([A-Z]+)(\d+)$/i)
  if (alpha) {
    const [, pfx, dig] = alpha
    const clean = dig.replace(/^0+(?=[0-9])/, '')
    vs.add(`${pfx.toUpperCase()}${dig}`)
    vs.add(`${pfx.toUpperCase()}${clean}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(2, '0')}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(3, '0')}`)
    vs.add(clean); vs.add(clean.padStart(3, '0'))
  }
  return [...vs].filter(Boolean)
}

function parseTotal(raw: string): number | null {
  const s = (raw ?? '').split('/')[1]?.trim() ?? raw?.trim()
  if (!s || /[A-Za-z]/.test(s)) return null
  const n = parseInt(s, 10)
  return n > 0 && n <= 500 ? n : null
}

function numberSetHints(num: string): string[] {
  const n = num.toUpperCase()
  if (n.match(/^SV\d/))   return ['swsh45sv', 'swsh4sv', 'swsh35sv', 'pgo', 'swsh1']
  if (n.match(/^TG\d/))   return ['swsh9', 'swsh10', 'swsh11', 'swsh12', 'swsh12pt5']
  if (n.match(/^GG\d/))   return ['sv1', 'sv2', 'sv3', 'sv3pt5', 'sv4']
  if (n.match(/^SWSH\d/)) return ['swshp']
  if (n.match(/^SM\d/))   return ['smp']
  if (n.match(/^XY\d/))   return ['xyp']
  return []
}

const SET_NAME_MAP: Record<string, string> = {
  '151': 'sv3pt5', 'flammes obsidiennes': 'sv3', 'obsidian flames': 'sv3',
  'mascarade crepusculaire': 'sv6', 'twilight masquerade': 'sv6',
  'forces temporelles': 'sv5', 'temporal forces': 'sv5',
  'evolution celeste': 'swsh7', 'evolving skies': 'swsh7',
  'astres radieux': 'swsh10', 'brilliant stars': 'swsh9',
  'couronne zenith': 'swsh12pt5', 'crown zenith': 'swsh12pt5',
  'origine perdue': 'swsh11', 'lost origin': 'swsh11',
  'epee et bouclier': 'swsh1', 'sword shield': 'swsh1',
  'celebrations': 'cel25', 'base': 'base1', 'jungle': 'jungle', 'fossil': 'fossil',
  'scarlet violet': 'sv1', 'ecarlate et violet': 'sv1',
  'paldea evolved': 'sv2', 'ecarlate et violet evolution paldea': 'sv2',
  'pokemon go': 'pgo', 'paldean fates': 'sv4pt5', 'destinees de paldea': 'sv4pt5',
  'shrouded fable': 'sv6pt5', 'fable nebuleuse': 'sv6pt5',
  'stellar crown': 'sv7', 'couronne stellaire': 'sv7',
  'surging sparks': 'sv8', 'etincelles dechainantes': 'sv8',
  'prismatic evolutions': 'sv8pt5', 'evolutions prismatiques': 'sv8pt5',
  'journey together': 'sv9', 'voyage ensemble': 'sv9',
  'paradox rift': 'sv4', 'faille paradoxe': 'sv4',
}

// ── DB selects ────────────────────────────────────────────────────────────────
const SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true, releaseDate: true, logoUrl: true, printedTotal: true, totalCards: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true, source: true } },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}
const CAND_SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true } },
}

// ── Score ─────────────────────────────────────────────────────────────────────
function matchScore(card: any, num: string, enName: string, frName: string, setId: string, total: number | null): number {
  let s = 0
  const nums    = numberVariants(num)
  const cn      = (card.number ?? '').split('/')[0].trim()
  const enNorm  = normalizeName(enName)
  const frNorm  = normalizeName(frName)
  const cardNorm = normalizeName(card.name ?? '')
  const sid     = card.set?.externalId ?? ''

  if (num && nums.includes(cn))                                         s += 50
  else if (num && cn.replace(/^[A-Z]+/i, '') === num.replace(/^[A-Z]+/i, '')) s += 20

  if (total && (card.set?.printedTotal === total || card.set?.totalCards === total)) s += 35

  if (enNorm && cardNorm === enNorm)                                    s += 40
  else if (frNorm && cardNorm === frNorm)                               s += 40
  else if (enNorm && cardNorm.includes(enNorm.split(' ')[0]))           s += 12

  if (setId && sid === setId)                                           s += 30

  return s
}

// ── Résolution set ────────────────────────────────────────────────────────────
async function resolveSetId(setName: string, setIdHint: string, total: number | null): Promise<{ setId: string; candidates: string[] }> {
  // 1. Total imprimé → peut matcher plusieurs sets, on garde tous les candidats
  if (total) {
    const sets = await prisma.pokemonSet.findMany({
      where: { OR: [{ printedTotal: total }, { totalCards: total }] },
      select: { externalId: true },
      orderBy: { releaseDate: 'desc' },
      take: 5,
    })
    if (sets.length === 1) {
      console.log(`[scan] set via total ${total} → ${sets[0].externalId}`)
      return { setId: sets[0].externalId, candidates: [sets[0].externalId] }
    }
    if (sets.length > 1) {
      const ids = sets.map(s => s.externalId)
      console.log(`[scan] total ${total} → ${ids.join(', ')} (multiple, keeping as candidates)`)
      // Essayer de discriminer par setName si fourni
      if (setName) {
        const norm = normalizeName(setName)
        for (const [k, v] of Object.entries(SET_NAME_MAP)) {
          if (norm.includes(k) || k.includes(norm.substring(0, 6))) {
            if (ids.includes(v)) return { setId: v, candidates: ids }
          }
        }
      }
      return { setId: ids[0], candidates: ids }
    }
  }

  // 2. Nom du set
  if (setName) {
    const norm = normalizeName(setName)
    for (const [k, v] of Object.entries(SET_NAME_MAP)) {
      if (norm.includes(k) || k.includes(norm.substring(0, 8))) {
        return { setId: v, candidates: [v] }
      }
    }
    const dbSet = await prisma.pokemonSet.findFirst({
      where: { name: { contains: setName.substring(0, 12), mode: 'insensitive' } },
      select: { externalId: true },
      orderBy: { releaseDate: 'desc' },
    })
    if (dbSet?.externalId) return { setId: dbSet.externalId, candidates: [dbSet.externalId] }
  }

  return { setId: setIdHint || '', candidates: setIdHint ? [setIdHint] : [] }
}

// ── Recherche DB — (number, total) comme clé primaire ────────────────────────
async function findCard(
  num: string, total: number | null, enName: string, frName: string,
  setId: string, setCandidates: string[],
): Promise<any | null> {
  const nums   = numberVariants(num)
  const enNorm = normalizeName(enName)
  const frNorm = normalizeName(frName)
  const allSets = [...new Set([...setCandidates, ...numberSetHints(num)].filter(Boolean))]

  // S1 — externalId exact
  const extIds = allSets.flatMap(sid => nums.map(n => `${sid}-${n}`))
  if (extIds.length) {
    const found = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: SEL })
    if (found) { console.log(`[scan] ✅ S1 externalId ${found.name}`); return found }
  }

  // S2 — (number, printedTotal) : la clé la plus fiable
  if (num && total) {
    const rows = await prisma.card.findMany({
      where: { number: { in: nums }, set: { OR: [{ printedTotal: total }, { totalCards: total }] } },
      select: SEL,
      take: 10,
    })
    if (rows.length === 1) { console.log(`[scan] ✅ S2 num+total unique ${rows[0].name}`); return rows[0] }
    if (rows.length > 1) {
      const scored = rows.map(c => ({ c, s: matchScore(c, num, enName, frName, setId, total) })).sort((a, b) => b.s - a.s)
      console.log(`[scan] S2 num+total: ${rows.length} candidats, best=${scored[0].c.name} score=${scored[0].s}`)
      if (scored[0].s >= 40) return scored[0].c
    }
  }

  // S3 — name + number (fr et en en parallèle)
  if (num && (enName || frName)) {
    const nameQueries = [enName, frName].filter((v, i, a) => v && a.indexOf(v) === i)
    const s3results = await Promise.all(nameQueries.map(name =>
      prisma.card.findMany({
        where: { name: { contains: name, mode: 'insensitive' }, number: { in: nums } },
        select: SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 8,
      })
    ))
    const s3all = s3results.flat()
    if (s3all.length) {
      const exact = setId ? s3all.find(c => c.set.externalId === setId) : null
      const best  = exact ?? s3all.sort((a, b) => matchScore(b, num, enName, frName, setId, total) - matchScore(a, num, enName, frName, setId, total))[0]
      console.log(`[scan] ✅ S3 name+num ${best.name}`); return best
    }
  }

  // S4 — number + setId
  if (num && setId) {
    const s4 = await prisma.card.findFirst({ where: { number: { in: nums }, set: { externalId: setId } }, select: SEL })
    if (s4) { console.log(`[scan] ✅ S4 num+set ${s4.name}`); return s4 }
  }

  // S5 — number seul, scorer par nom
  if (num) {
    const byNum = await prisma.card.findMany({ where: { number: { in: nums } }, select: SEL, take: 30 })
    if (byNum.length === 1) { console.log(`[scan] ✅ S5 num unique ${byNum[0].name}`); return byNum[0] }
    if (byNum.length > 1) {
      const scored = byNum.map(c => ({ c, s: matchScore(c, num, enName, frName, setId, total) })).sort((a, b) => b.s - a.s)
      if (scored[0].s >= 40) { console.log(`[scan] ✅ S5 num+score ${scored[0].c.name}`); return scored[0].c }
    }
  }

  // S6 — name + setId (sans numéro)
  if (setId && (enName || frName)) {
    const name = enName || frName
    const s6 = await prisma.card.findFirst({
      where: { name: { contains: name, mode: 'insensitive' }, set: { externalId: setId } },
      select: SEL,
    })
    if (s6) { console.log(`[scan] ✅ S6 name+set ${s6.name}`); return s6 }
  }

  return null
}

// ── Candidats ─────────────────────────────────────────────────────────────────
async function findCandidates(num: string, enName: string, frName: string, setId: string, total: number | null): Promise<any[]> {
  const nums = numberVariants(num)
  const seen = new Map<string, any>()
  const add  = (cards: any[]) => cards.forEach(c => { if (!seen.has(c.id)) seen.set(c.id, c) })

  if (num && total) {
    add(await prisma.card.findMany({
      where: { number: { in: nums }, set: { OR: [{ printedTotal: total }, { totalCards: total }] } },
      select: CAND_SEL, take: 6,
    }))
  }
  if (num && setId) {
    add(await prisma.card.findMany({ where: { number: { in: nums }, set: { externalId: setId } }, select: CAND_SEL, take: 4 }))
  }
  // Chercher sur les deux noms séparément (EN en priorité, FR en fallback)
  for (const name of [enName, frName].filter((v, i, a) => v && v !== a[i - 1])) {
    add(await prisma.card.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: CAND_SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 6,
    }))
  }

  return [...seen.values()]
    .map(c => ({ c, s: matchScore(c, num, enName, frName, setId, total) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 5)
    .map(({ c }) => c)
}

// ── AI calls ──────────────────────────────────────────────────────────────────
async function callGemini(b64: string, mime: string, prompt: string, maxTokens = 300): Promise<{ text: string | null; rateLimited: boolean }> {
  const safeMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(mime) ? mime : 'image/jpeg'
  let anyRateLimit = false
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: safeMime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens } }),
          signal: AbortSignal.timeout(20000),
        }
      )
      if (res.status === 429) { anyRateLimit = true; continue }
      if (!res.ok) continue
      const json = await res.json()
      const candidate = json?.candidates?.[0]
      if (candidate?.finishReason === 'SAFETY') continue
      const text = candidate?.content?.parts?.[0]?.text ?? ''
      if (text) return { text, rateLimited: false }
    } catch { /* continue */ }
  }
  return { text: null, rateLimited: anyRateLimit }
}

async function callGroq(b64: string, mime: string, prompt: string, maxTokens = 200): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null
  const safeMime = mime.startsWith('image/') ? mime : 'image/jpeg'
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${safeMime};base64,${b64}` } }, { type: 'text', text: prompt }] }],
        max_tokens: maxTokens, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    return (await res.json())?.choices?.[0]?.message?.content ?? null
  } catch { return null }
}

function extractJson(text: string): Record<string, string> | null {
  const tries = [
    () => { const m = text.match(/\{[\s\S]*?\}/g); if (m) { for (let i = m.length - 1; i >= 0; i--) { try { return JSON.parse(m[i]) } catch {} } } throw 0 },
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of tries) {
    try {
      const p = fn()
      if (p && typeof p === 'object' && !Array.isArray(p)) return p
    } catch { /* try next */ }
  }
  return null
}

// ── pokemontcg.io ─────────────────────────────────────────────────────────────
async function searchPtcgio(num: string, total: number | null, enName: string, frName: string, setId: string): Promise<{ ptcgCard: any; dbCard: any | null } | null> {
  try {
    const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    const numClean = num.replace(/^0+(?=[0-9])/, '')
    const queries: string[] = []

    // La requête la plus précise : numéro + total
    if (num && total) queries.push(`number:"${numClean}" set.printedTotal:"${total}"`)
    if (num && setId) queries.push(`number:"${numClean}" set.id:${setId}`)
    const ptcgName = enName || frName // pokemontcg.io comprend les deux
    if (ptcgName && total) queries.push(`name:"${ptcgName}" set.printedTotal:"${total}"`)
    if (ptcgName && num)   queries.push(`name:"${ptcgName}" number:"${numClean}"`)
    if (ptcgName && setId) queries.push(`name:"${ptcgName}" set.id:${setId}`)
    // Essayer aussi avec le nom français si différent
    if (frName && frName !== enName && total) queries.push(`name:"${frName}" set.printedTotal:"${total}"`)
    if (frName && frName !== enName && num)   queries.push(`name:"${frName}" number:"${numClean}"`)


    for (const q of queries.slice(0, 4)) {
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`, { headers, signal: AbortSignal.timeout(6000) })
        if (!res.ok) continue
        const cards: any[] = (await res.json()).data ?? []
        if (!cards.length) continue
        const match = cards.find(c => c.number === num || c.number === numClean)
          ?? cards.find(c => c.name.toLowerCase().includes(((enName || frName).split(' ')[0] || '').toLowerCase()))
          ?? cards[0]
        console.log(`[scan] ptcgio: ${match.id} (${match.name} #${match.number})`)
        const dbCard = await prisma.card.findUnique({ where: { externalId: match.id }, select: SEL })
        return { ptcgCard: match, dbCard }
      } catch { /* timeout → try next query */ }
    }
  } catch (e: any) { console.warn('[scan] ptcgio:', e?.message) }
  return null
}

async function importCard(ptcgCard: any): Promise<any | null> {
  try {
    const s = ptcgCard.set
    const set = await prisma.pokemonSet.upsert({
      where: { externalId: s.id },
      create: { externalId: s.id, name: s.name, series: s.series ?? 'Unknown', totalCards: s.total ?? 0, printedTotal: s.printedTotal ?? s.total ?? 0, releaseDate: s.releaseDate ? new Date(s.releaseDate) : null, logoUrl: s.images?.logo ?? null, symbolUrl: s.images?.symbol ?? null },
      update: { logoUrl: s.images?.logo ?? null, printedTotal: s.printedTotal ?? s.total ?? 0 },
      select: { id: true },
    })
    await prisma.card.upsert({
      where: { externalId: ptcgCard.id },
      create: { externalId: ptcgCard.id, name: ptcgCard.name, number: ptcgCard.number, supertype: ptcgCard.supertype ?? 'Pokémon', subtypes: ptcgCard.subtypes ?? [], rarity: ptcgCard.rarity ?? null, imageSmUrl: ptcgCard.images?.small ?? null, imageLgUrl: ptcgCard.images?.large ?? null, set: { connect: { id: set.id } } },
      update: { imageLgUrl: ptcgCard.images?.large ?? null, imageSmUrl: ptcgCard.images?.small ?? null },
    })
    return await prisma.card.findUnique({ where: { externalId: ptcgCard.id }, select: SEL })
  } catch { return null }
}

// ── Extraction AI : 3 prompts focalisés en parallèle ─────────────────────────
async function extractWithFocusedPrompts(buffers: { b64: string; mime: string }[]): Promise<{
  num: string; total: number | null; enName: string; frName: string
  setName: string; setId: string; language: string
}> {
  const { b64, mime } = buffers[0]

  // Lance les 3 mini-prompts en parallèle
  const [rA, rB, rC] = await Promise.all([
    callGemini(b64, mime, PROMPT_NUMBER, 60),
    callGemini(b64, mime, PROMPT_NAME, 100),
    callGemini(b64, mime, PROMPT_SET, 80),
  ])

  const pA = rA.text ? extractJson(rA.text) : null
  const pB = rB.text ? extractJson(rB.text) : null
  const pC = rC.text ? extractJson(rC.text) : null

  let numRaw  = (pA?.num     ?? '').trim()
  let totRaw  = (pA?.total   ?? '').trim()
  let enName  = (pB?.enName  ?? pB?.name ?? '').trim()
  let frName  = (pB?.frName  ?? '').trim()
  const lang  = (pB?.lang    ?? 'FR').trim()
  let setName = (pC?.setName ?? '').trim()
  let setIdAI = (pC?.setId   ?? '').trim()

  // Si une deuxième image existe, l'utiliser pour compléter les champs manquants
  if (buffers.length > 1 && (!numRaw || !enName)) {
    const { b64: b2, mime: m2 } = buffers[1]
    const toRun: Promise<any>[] = []
    if (!numRaw) toRun.push(callGemini(b2, m2, PROMPT_NUMBER, 60))
    else         toRun.push(Promise.resolve({ text: null }))
    if (!enName) toRun.push(callGemini(b2, m2, PROMPT_NAME, 100))
    else         toRun.push(Promise.resolve({ text: null }))

    const [r2A, r2B] = await Promise.all(toRun)
    if (!numRaw && r2A.text) {
      const p2A = extractJson(r2A.text)
      if (p2A?.num)   { numRaw = p2A.num.trim(); totRaw = (p2A.total ?? '').trim() }
    }
    if (!enName && r2B.text) {
      const p2B = extractJson(r2B.text)
      enName = (p2B?.enName ?? p2B?.name ?? '').trim()
      frName = (p2B?.frName ?? frName).trim()
    }
  }

  // Fallback Groq pour le numéro si Gemini a échoué
  if (!numRaw && rA.rateLimited) {
    const groqNum = await callGroq(b64, mime, PROMPT_NUMBER, 60)
    if (groqNum) {
      const p = extractJson(groqNum)
      if (p?.num) { numRaw = p.num.trim(); totRaw = (p.total ?? '').trim() }
    }
  }

  // Fallback Groq pour le nom
  if (!enName) {
    const groqName = await callGroq(b64, mime, PROMPT_NAME, 100)
    if (groqName) {
      const p = extractJson(groqName)
      enName = (p?.enName ?? p?.name ?? '').trim()
      frName = (p?.frName ?? frName).trim()
    }
  }

  // Si enName manque mais frName existe → utiliser frName comme enName
  // (l'AI connaît les noms FR→EN, mais si elle n'a pas renvoyé enName on fallback)
  if (!enName && frName) enName = frName

  const total = parseTotal(totRaw) ?? parseTotal(numRaw)

  console.log(`[scan] focused: num="${numRaw}" total="${totRaw}" en="${enName}" fr="${frName}" lang=${lang} set="${setName}" setId="${setIdAI}"`)

  return { num: numRaw, total, enName, frName, setName, setId: setIdAI, language: lang }
}

// ── Fallback : prompt complet si les focalisés échouent ──────────────────────
async function extractFallback(b64: string, mime: string): Promise<AiResult | null> {
  const { text } = await callGemini(b64, mime, PROMPT_FULL, 200)
  if (text) {
    const p = extractJson(text)
    if (p?.cardName || p?.englishName || p?.cardNumber) {
      return {
        cardName:    (p.cardName    ?? '').trim(),
        englishName: (p.englishName ?? '').trim(),
        cardNumber:  (p.cardNumber  ?? '').trim(),
        setName:     (p.setName     ?? '').trim(),
        setId:       (p.setId       ?? '').trim(),
        language:    (p.language    ?? 'FR').trim(),
      }
    }
  }
  // Groq fallback
  const groqText = await callGroq(b64, mime, PROMPT_FULL, 200)
  if (groqText) {
    const p = extractJson(groqText)
    if (p?.cardName || p?.englishName || p?.cardNumber) {
      return {
        cardName:    (p.cardName    ?? '').trim(),
        englishName: (p.englishName ?? '').trim(),
        cardNumber:  (p.cardNumber  ?? '').trim(),
        setName:     (p.setName     ?? '').trim(),
        setId:       (p.setId       ?? '').trim(),
        language:    (p.language    ?? 'FR').trim(),
      }
    }
  }
  return null
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ ok: false, error: 'Connexion requise', requiresAuth: true }, { status: 401 })

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress
  const user  = await getUserWithTier(clerkId, email ?? undefined)

  const limits = getLimits(user.tier as any)
  if (limits.scansPerMonth !== Infinity) {
    const used = await getScanUsage(user.id)
    if (used >= limits.scansPerMonth) {
      return NextResponse.json({ ok: false, error: `Limite de ${limits.scansPerMonth} scans/mois atteinte.`, limitReached: true, used, limit: limits.scansPerMonth, upgradeUrl: '/pricing' }, { status: 429 })
    }
  }

  try {
    const form = await req.formData()
    const imageFiles: File[] = []
    for (const key of ['image', 'image2', 'image3']) {
      const f = form.get(key) as File | null
      if (f && f.size > 0) {
        if (f.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image trop grande (max 10MB)' }, { status: 400 })
        imageFiles.push(f)
      }
    }
    if (!imageFiles.length) return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 })

    const buffers = await Promise.all(imageFiles.map(async f => ({
      b64:  Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type) ? f.type : 'image/jpeg',
    })))
    const { b64, mime } = buffers[0]

    // ── Phase 1 : 3 prompts focalisés en parallèle ───────────────
    const focused = await extractWithFocusedPrompts(buffers)

    let { num, total, enName, frName, setName, setId: setIdAI, language } = focused
    let cardNumber = num ? (focused.total !== null ? `${num}/${focused.total}` : num) : ''

    // Si les focalisés n'ont pas trouvé le numéro ni le nom → prompt complet
    if (!num && !enName && !frName) {
      console.log('[scan] focused prompts empty — fallback to full prompt')
      const fb = await extractFallback(b64, mime)
      if (fb) {
        num        = fb.cardNumber.split('/')[0].trim()
        total      = parseTotal(fb.cardNumber)
        enName     = fb.englishName
        frName     = fb.cardName !== fb.englishName ? fb.cardName : ''
        setName    = fb.setName
        setIdAI    = fb.setId
        language   = fb.language
        cardNumber = fb.cardNumber
      }
    }

    // Si on a le numéro mais pas le nom → Groq pour le nom
    if (num && !enName && !frName) {
      const groqName = await callGroq(b64, mime, PROMPT_NAME, 100)
      if (groqName) {
        const p = extractJson(groqName)
        enName = (p?.enName ?? p?.name ?? '').trim()
        frName = (p?.frName ?? '').trim()
      }
    }

    console.log(`[scan] final hint: num="${num}" total=${total} en="${enName}" fr="${frName}" set="${setName}" setId="${setIdAI}"`)

    // ── Phase 2 : Résolution du set ───────────────────────────────
    const { setId, candidates: setCandidates } = await resolveSetId(setName, setIdAI, total)

    // ── Phase 3 : Recherches en parallèle ────────────────────────
    const hasInfo = !!(enName || frName || num)
    const [card0, rawCandidates, ptcgResult] = await Promise.all([
      findCard(num, total, enName, frName, setId, setCandidates),
      findCandidates(num, enName, frName, setId, total),
      hasInfo ? searchPtcgio(num, total, enName, frName, setId) : Promise.resolve(null),
    ])

    // ── Phase 4 : Sélection ───────────────────────────────────────
    const dbScore   = card0 ? matchScore(card0, num, enName, frName, setId, total) : 0
    let ptcgCard: any = ptcgResult?.dbCard ?? null
    if (!ptcgCard && ptcgResult?.ptcgCard) ptcgCard = await importCard(ptcgResult.ptcgCard)
    const ptcgScore = ptcgCard ? matchScore(ptcgCard, num, enName, frName, setId, total) : 0

    console.log(`[scan] DB:${dbScore}(${card0?.name ?? '-'}) ptcg:${ptcgScore}(${ptcgCard?.name ?? '-'})`)

    let card: any = null
    if (dbScore >= 50 && dbScore >= ptcgScore)     card = card0
    else if (ptcgScore > 0 && ptcgScore > dbScore) card = ptcgCard
    else if (dbScore >= 30)                        card = card0
    else if (ptcgScore > 0)                        card = ptcgCard

    // ── Phase 5 : Dernier recours — rescue via Groq ───────────────
    if (!card && hasInfo) {
      console.log('[scan] 🔄 rescue via Groq')
      const groqText = await callGroq(b64, mime, PROMPT_NUMBER, 60)
      if (groqText) {
        const p   = extractJson(groqText)
        const rNum   = (p?.num   ?? '').trim()
        const rTotal = parseTotal((p?.total ?? '').trim())
        if (rNum && (rNum !== num || rTotal !== total)) {
          const { setId: rSetId, candidates: rCands } = await resolveSetId(setName, setIdAI, rTotal)
          const rCard = await findCard(rNum, rTotal, enName, frName, rSetId, rCands)
          if (rCard && matchScore(rCard, rNum, enName, frName, rSetId, rTotal) >= 25) {
            card = rCard
            num   = rNum
            total = rTotal
          }
        }
      }
    }

    // ── Phase 6 : Construire la réponse ──────────────────────────
    const hint: AiResult = {
      cardName:    frName || enName,
      englishName: enName || frName,
      cardNumber,
      setName,
      setId: setId || setIdAI,
      language,
    }

    const buildCand = (c: any) => ({
      id: c.id, name: c.name, number: c.number, rarity: c.rarity ?? '',
      imageUrl: c.imageLgUrl ?? c.imageSmUrl ?? null,
      setName: c.set?.name ?? '', setId: c.set?.externalId ?? '',
      price: Number(c.prices?.[0]?.market ?? 0) || null,
    })

    const candIds = new Set<string>()
    const candidateList: ReturnType<typeof buildCand>[] = []
    if (card) { candIds.add(card.id); candidateList.push(buildCand(card)) }
    for (const c of rawCandidates) {
      if (!candIds.has(c.id)) { candIds.add(c.id); candidateList.push(buildCand(c)); if (candidateList.length >= 5) break }
    }
    if (candidateList.length === 0 && ptcgCard && !candIds.has(ptcgCard.id)) {
      candidateList.push(buildCand(ptcgCard))
    }
    if (candidateList.length === 0 && (enName || frName)) {
      candidateList.push({ id: `ai:${num || 'unknown'}`, name: enName || frName, number: cardNumber || '?', rarity: '', imageUrl: null, setName: setName || 'Extension inconnue', setId: setId || '', price: null })
    }

    const price    = Number(card?.prices?.[0]?.market ?? 0)
    const md       = card?.marketData ?? null
    const ai       = card?.aiAnalysis ?? null
    const pred365  = ai?.predictions?.find((p: any) => p.horizonDays === 365)
    let proj = null, annualGrowthRate = 0
    if (price > 0 && card) {
      const rarityW = RARITY_W[card.rarity ?? ''] ?? 0.05
      const exId    = card.set?.externalId ?? ''
      const era     = detectEra(exId, card.set?.name ?? null)
      const cTier   = charTier(card.name)
      const ath     = md?.allTimeHigh ? Number(md.allTimeHigh) : price
      const athDrop = ath > price ? +(((ath - price) / ath) * 100).toFixed(1) : 0
      const targets = buildTargets(price, ath, cTier, rarityW, scarcityScore(exId, card.rarity ?? ''), era, athDrop)
      proj = { y1: { value: targets.t1y }, y3: { value: targets.t3y }, y5: { value: targets.t5y }, y10: { value: targets.t10y } }
      annualGrowthRate = +(((targets.t1y / price) - 1) * 100).toFixed(1)
    }

    await incrementScanUsage(user.id)
    ph.capture({ distinctId: clerkId, event: 'card_scanned', properties: { card_name: card?.name ?? enName, card_found: !!card, tier: user.tier } })

    return NextResponse.json({
      ok: true,
      identification: hint,
      candidates: candidateList,
      dbMatch: card ? {
        id: card.id, name: card.name, number: card.number, rarity: card.rarity,
        imageUrl: card.imageLgUrl ?? card.imageSmUrl,
        set: card.set,
        price: price > 0 ? { market: price, low: Number(card.prices[0].low ?? 0), high: Number(card.prices[0].high ?? 0), currency: card.prices[0].currency } : null,
        market: md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, liquidityScore: md.liquidityScore ?? 0, trendDirection: md.trendDirection, change7d: Number(md.priceChange7d ?? 0), change30d: Number(md.priceChange30d ?? 0), change1y: Number(md.priceChange1y ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0), volatility: Number(md.volatility30d ?? 0) } : null,
        ai: ai ? { investmentScore: ai.investmentScore, trendDirection: ai.trendDirection, bullishSignals: ai.bullishSignals.slice(0, 3), bearishSignals: ai.bearishSignals.slice(0, 2), keyInsight: ai.keyInsight, pred1y: pred365 ? { value: Number(pred365.predictedPrice), low: Number(pred365.lowerBound), high: Number(pred365.upperBound) } : null } : null,
        projections: proj,
        annualGrowthRate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
