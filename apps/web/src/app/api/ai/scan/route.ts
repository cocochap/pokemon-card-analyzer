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

// Prompt unique — extrait tout en un seul appel
const PROMPT_CORE = `You are a Pokémon TCG card identification expert.

Look at this image (direct card photo OR marketplace screenshot from Vinted/eBay/LeBonCoin).
Read ALL visible text: card itself, listing title, description, watermarks.

Extract these fields and return ONLY this JSON:
{
  "num": "006",
  "total": "165",
  "enName": "Charizard ex",
  "frName": "Dracaufeu ex",
  "lang": "FR",
  "setName": "151",
  "setId": "sv3pt5"
}

Field rules:
- num: collector number LEFT of the slash (keep leading zeros: "006" not "6"). For "SV107/SV122" → "SV107"
- total: RIGHT of the slash, digits only (for "006/165" → "165"). For "SV107/SV122" → "SV122"
- enName: ALWAYS English Pokémon name with exact suffix (Charizard ex, Pikachu VMAX, Mewtwo GX...)
- frName: name as printed on card if French, otherwise same as enName
- lang: FR/EN/JP/DE/ES/IT/PT
- setName: expansion name visible on card or in listing text ("151", "Flammes Obsidiennes"...)
- setId: pokemontcg.io set ID ONLY if 100% certain (sv3pt5, sv3, swsh10...), else ""
- Use "" for any field you cannot find`

// ── Types ─────────────────────────────────────────────────────────────────────
interface AiResult {
  cardName: string; englishName: string; cardNumber: string
  setName: string; setId: string; language: string
}

// ── Utils ─────────────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')   // accents
    .replace(/[''`\-]/g, ' ') // apostrophes + tirets → espace (Dracaufeu-ex = Dracaufeu ex)
    .replace(/\s+/g, ' ')
    .trim()
}

// Transforme un ID pokemontcg.io en ID DB (sv3pt5 → sv03.5, sv9 → sv09, etc.)
function ptcgioToDbId(id: string): string {
  const m1 = id.match(/^sv(\d+)pt(\d+)$/i) // sv3pt5 → sv03.5
  if (m1) return `sv${m1[1].padStart(2, '0')}.${m1[2]}`
  const m2 = id.match(/^sv(\d+)$/i)         // sv9 → sv09
  if (m2) return `sv${m2[1].padStart(2, '0')}`
  return id
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

// IDs dans le format réel de la DB (pas pokemontcg.io)
const SET_NAME_MAP: Record<string, string> = {
  // SV — IDs DB (sv03.5, pas sv3pt5)
  '151': 'sv03.5', 'flammes obsidiennes': 'sv03', 'obsidian flames': 'sv03',
  'mascarade crepusculaire': 'sv06', 'twilight masquerade': 'sv06',
  'forces temporelles': 'sv05', 'temporal forces': 'sv05',
  'destinees de paldea': 'sv04.5', 'paldean fates': 'sv04.5',
  'faille paradoxe': 'sv04', 'paradox rift': 'sv04',
  'fable nebuleuse': 'sv06.5', 'shrouded fable': 'sv06.5',
  'couronne stellaire': 'sv07', 'stellar crown': 'sv07',
  'etincelles deferlantes': 'sv08', 'surging sparks': 'sv08',
  'evolutions prismatiques': 'sv08.5', 'prismatic evolutions': 'sv08.5',
  'aventures ensemble': 'sv09', 'journey together': 'sv09',
  'rivalites destinees': 'sv10', 'destined rivals': 'sv10',
  'ecarlate et violet': 'sv01', 'scarlet violet': 'sv01',
  'evolutions a paldea': 'sv02', 'paldea evolved': 'sv02',
  // SWSH
  'evolution celeste': 'swsh7', 'evolving skies': 'swsh7',
  'astres radieux': 'swsh10', 'brilliant stars': 'swsh9',
  'origine perdue': 'swsh11', 'lost origin': 'swsh11',
  'tempete argentee': 'swsh12', 'silver tempest': 'swsh12',
  'couronne zenith': 'swsh12.5', 'crown zenith': 'swsh12.5',
  'epee et bouclier': 'swsh1', 'sword shield': 'swsh1',
  // Vintage
  'celebrations': 'cel25', 'base': 'base1', 'jungle': 'jungle', 'fossil': 'fossil',
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

  // 3. setIdHint fourni par l'AI (peut être un ID pokemontcg.io, on transforme)
  if (setIdHint) {
    const dbId = ptcgioToDbId(setIdHint)
    const cands = dbId !== setIdHint ? [dbId, setIdHint] : [setIdHint]
    return { setId: dbId, candidates: cands }
  }

  return { setId: '', candidates: [] }
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

  // S1 — externalId exact (essaye les IDs DB transformés ET les IDs pokemontcg.io)
  const dbIds   = [...new Set([...allSets, ...allSets.map(ptcgioToDbId)].filter(Boolean))]
  const extIds  = dbIds.flatMap(sid => nums.map(n => `${sid}-${n}`))
  if (extIds.length) {
    const found = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: SEL })
    if (found) { console.log(`[scan] ✅ S1 externalId ${found.name}`); return found }
  }

  // S2 — (number, printedTotal) : la clé la plus fiable, indépendante du setId
  if (num && total) {
    const rows = await prisma.card.findMany({
      where: { number: { in: nums }, set: { OR: [{ printedTotal: total }, { totalCards: total }] } },
      select: SEL,
      take: 10,
    })
    if (rows.length === 1) { console.log(`[scan] ✅ S2 num+total unique ${rows[0].name}`); return rows[0] }
    if (rows.length > 1) {
      const scored = rows.map(c => ({ c, s: matchScore(c, num, enName, frName, setId, total) })).sort((a, b) => b.s - a.s)
      console.log(`[scan] S2 num+total: ${rows.length} candidats, best="${scored[0].c.name}" score=${scored[0].s}`)
      // Seuil abaissé : avec num+total on est déjà très confiant (50+35=85 si les deux matchent)
      if (scored[0].s >= 30) return scored[0].c
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

// Appel d'un seul modèle Gemini — timeout 8s
async function callGeminiModel(model: string, b64: string, mime: string, prompt: string, maxTokens: number): Promise<string | null> {
  const safeMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(mime) ? mime : 'image/jpeg'
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: safeMime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens } }),
        signal: AbortSignal.timeout(8000), // 8s max par modèle
      }
    )
    if (res.status === 429 || !res.ok) return null
    const json = await res.json()
    const candidate = json?.candidates?.[0]
    if (candidate?.finishReason === 'SAFETY') return null
    return candidate?.content?.parts?.[0]?.text || null
  } catch { return null }
}

// Tous les modèles Gemini en race simultanée — premier résultat valide gagne
async function callGemini(b64: string, mime: string, prompt: string, maxTokens = 200): Promise<string | null> {
  const calls = GEMINI_MODELS.map(m => callGeminiModel(m, b64, mime, prompt, maxTokens))
  try {
    return await Promise.any(calls.map(p => p.then(t => { if (!t) throw 0; return t })))
  } catch {
    return null
  }
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
      signal: AbortSignal.timeout(8000),
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
        // Essayer l'ID pokemontcg.io ET l'ID DB transformé
        const dbIdTransformed = ptcgioToDbId(match.set?.id ?? '') + '-' + match.number
        const dbCard = await prisma.card.findFirst({
          where: { OR: [{ externalId: match.id }, { externalId: dbIdTransformed }] },
          select: SEL,
        })
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

// ── Race : tous les modèles Gemini + Groq simultanément ─────────────────────
async function raceAI(b64: string, mime: string, prompt: string, maxTokens = 200): Promise<string | null> {
  const sources = [
    callGemini(b64, mime, prompt, maxTokens), // race interne des 3 modèles Gemini
    callGroq(b64, mime, prompt, maxTokens),
  ]
  try {
    return await Promise.any(sources.map(p => p.then(t => { if (!t) throw 0; return t })))
  } catch {
    return null
  }
}

function parseAIResult(text: string | null): {
  num: string; total: number | null; enName: string; frName: string
  setName: string; setId: string; language: string
} {
  const empty = { num: '', total: null, enName: '', frName: '', setName: '', setId: '', language: 'FR' }
  if (!text) return empty
  const p = extractJson(text)
  if (!p) return empty

  const numRaw  = (p.num     ?? '').trim()
  const totRaw  = (p.total   ?? '').trim()
  const enName  = (p.enName  ?? p.englishName ?? p.cardName ?? p.name ?? '').trim()
  const frName  = (p.frName  ?? p.cardName ?? '').trim()
  const lang    = (p.lang    ?? p.language ?? 'FR').trim()
  const setName = (p.setName ?? p.setId ?? '').trim()
  const setId   = (p.setId   ?? '').trim()
  const total   = parseTotal(totRaw) ?? parseTotal(numRaw)

  return { num: numRaw, total, enName: enName || frName, frName: frName || enName, setName, setId, language: lang }
}

// ── Extraction AI : 1 prompt, race Gemini vs Groq ────────────────────────────
async function extractCard(buffers: { b64: string; mime: string }[]): Promise<{
  num: string; total: number | null; enName: string; frName: string
  setName: string; setId: string; language: string
}> {
  const { b64, mime } = buffers[0]

  // Race : les deux modèles partent en même temps, premier réponse valide gagne
  const text = await raceAI(b64, mime, PROMPT_CORE, 200)
  let result = parseAIResult(text)

  // Si image 2 disponible et champs critiques manquants, compléter
  if (buffers.length > 1 && (!result.num || !result.enName)) {
    const { b64: b2, mime: m2 } = buffers[1]
    const text2 = await raceAI(b2, m2, PROMPT_CORE, 200)
    const r2 = parseAIResult(text2)
    if (!result.num && r2.num)       { result.num = r2.num; result.total = r2.total }
    if (!result.enName && r2.enName) { result.enName = r2.enName; result.frName = r2.frName }
    if (!result.setName && r2.setName) result.setName = r2.setName
    if (!result.setId && r2.setId)   result.setId = r2.setId
  }

  console.log(`[scan] AI: num="${result.num}" total=${result.total} en="${result.enName}" fr="${result.frName}" set="${result.setName}"`)
  return result
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  // Auth + form parsing en parallèle
  const [{ userId: clerkId }, form] = await Promise.all([auth(), req.formData()])
  if (!clerkId) return NextResponse.json({ ok: false, error: 'Connexion requise', requiresAuth: true }, { status: 401 })

  const imageFiles: File[] = []
  for (const key of ['image', 'image2', 'image3']) {
    const f = form.get(key) as File | null
    if (f && f.size > 0) {
      if (f.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image trop grande (max 10MB)' }, { status: 400 })
      imageFiles.push(f)
    }
  }
  if (!imageFiles.length) return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 })

  try {
    // Buffers + user lookup + AI : tout en parallèle
    const buffersP = Promise.all(imageFiles.map(async f => ({
      b64:  Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type) ? f.type : 'image/jpeg',
    })))

    // User lookup pendant que les buffers se préparent
    const clerkUser = await currentUser()
    const email = clerkUser?.emailAddresses[0]?.emailAddress
    const user = await getUserWithTier(clerkId, email ?? undefined)

    const limits = getLimits(user.tier as any)
    if (limits.scansPerMonth !== Infinity) {
      const used = await getScanUsage(user.id)
      if (used >= limits.scansPerMonth) {
        return NextResponse.json({ ok: false, error: `Limite de ${limits.scansPerMonth} scans/mois atteinte.`, limitReached: true, used, limit: limits.scansPerMonth, upgradeUrl: '/pricing' }, { status: 429 })
      }
    }

    const buffers = await buffersP

    // ── Phase 1 : AI (race Gemini×3 + Groq) ─────────────────────
    const t0 = Date.now()
    const { num, total, enName, frName, setName, setId: setIdAI, language } = await extractCard(buffers)
    console.log(`[scan] AI ${Date.now() - t0}ms`)

    const cardNumber = num ? (total !== null ? `${num}/${total}` : num) : ''

    // ── Phase 2 : Résolution du set ───────────────────────────────
    const { setId, candidates: setCandidates } = await resolveSetId(setName, setIdAI, total)

    // ── Phase 3 : DB lookup ───────────────────────────────────────
    const hasInfo = !!(enName || frName || num)
    const t1 = Date.now()
    const [card0, rawCandidates] = await Promise.all([
      findCard(num, total, enName, frName, setId, setCandidates),
      findCandidates(num, enName, frName, setId, total),
    ])
    const dbScore = card0 ? matchScore(card0, num, enName, frName, setId, total) : 0
    console.log(`[scan] DB ${Date.now() - t1}ms score=${dbScore} card="${card0?.name ?? '-'}"`)

    let card: any = dbScore >= 30 ? card0 : null

    // ── Phase 4 : ptcgio seulement si DB insuffisant ──────────────
    if (!card && hasInfo) {
      const t2 = Date.now()
      const ptcgResult = await searchPtcgio(num, total, enName, frName, setId)
      let ptcgCard: any = ptcgResult?.dbCard ?? null
      if (!ptcgCard && ptcgResult?.ptcgCard) ptcgCard = await importCard(ptcgResult.ptcgCard)
      const ptcgScore = ptcgCard ? matchScore(ptcgCard, num, enName, frName, setId, total) : 0
      console.log(`[scan] ptcgio ${Date.now() - t2}ms score=${ptcgScore} card="${ptcgCard?.name ?? '-'}"`)
      if (ptcgScore >= 25) card = ptcgCard
      else if (dbScore >= 20) card = card0 // DB partielle vaut mieux que rien
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
    // ptcgCard n'est plus dans le scope ici — candidateList est alimentée par rawCandidates
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
