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

const PROMPT = `You are a Pokémon TCG card identification expert. The image can be:
- A direct photo of a card
- A screenshot from Vinted, eBay, LeBonCoin, Facebook Marketplace, Instagram, TikTok, or any platform
- A product listing with UI text, title, description, price visible around the card

STRATEGY — read in this priority order:
1. ALL TEXT VISIBLE IN THE IMAGE (listing title, description, watermarks, captions) — marketplace titles like "Dracaufeu ex 006/165 Extension 151" are extremely reliable
2. The card image itself (number at bottom, name at top, set symbol)
3. Any partially visible text or numbers

Extract from whichever source is clearest:
1. cardName: Pokémon name + variant EXACTLY as seen (French/English/Japanese/etc.)
2. englishName: English equivalent, preserve suffixes exactly: VMAX, VSTAR, V, ex, GX, EX, EX
3. cardNumber: FULL collector number with total: "006/165", "SV107/SV122", "TG01/TG30". CRITICAL: include the "/total" part.
4. setName: expansion name ("151", "Flammes Obsidiennes", "Surging Sparks", etc.)
5. setId: pokemontcg.io set ID ONLY if 100% certain. Leave "" if any doubt.
6. language: FR/EN/JP/DE/ES/IT/PT

EXAMPLES of marketplace title parsing:
- "Dracaufeu ex 006/165 sv3pt5" → cardName="Dracaufeu ex", cardNumber="006/165", setId="sv3pt5"
- "Pikachu VMAX 044/185 Épée et Bouclier" → cardName="Pikachu VMAX", cardNumber="044/185", setName="Épée et Bouclier"
- "Carte pokemon charizard ex full art 076/091" → cardName="Charizard ex", cardNumber="076/091"

RULES:
- A number like "006/165" in any text → use it as cardNumber
- Multiple cards → identify the most prominent or the one mentioned in the title
- Never invent a number you cannot read or find in text

Return ONLY valid JSON (no explanation):
{"cardName":"Dracaufeu ex","englishName":"Charizard ex","cardNumber":"006/165","setName":"151","setId":"sv3pt5","language":"FR"}`

const PROMPT_MARKETPLACE = `This image is a marketplace listing screenshot (Vinted, eBay, LeBonCoin, etc.).

READ ALL TEXT VISIBLE IN THE IMAGE — title, description, tags, seller notes.
Ignore prices, shipping info, seller profiles.

Find the Pokémon card being sold and extract:
1. cardName: Pokémon name + variant (ex, VMAX, GX, V, VSTAR, EX...)
2. englishName: English version
3. cardNumber: collector number format "XXX/YYY" or "SVXXX/SVYYY" — search in ALL visible text
4. setName: expansion/extension name
5. setId: pokemontcg.io ID if you recognize it (sv3pt5, sv3, swsh10...), else ""
6. language: FR/EN/JP/DE

Return ONLY valid JSON:
{"cardName":"Dracaufeu ex","englishName":"Charizard ex","cardNumber":"006/165","setName":"151","setId":"sv3pt5","language":"FR"}`

const PROMPT_RESCUE = `Look at this Pokémon card image or listing screenshot. Focus specifically on finding:
1. The collector number — look at the BOTTOM of the card AND in any visible text. Format: "006/165", "SV107/SV122", "044/185"
2. The set/expansion name — on the card or in text

Return ONLY valid JSON: {"cardNumber":"006/165","setName":"151"}`

const PROMPT_NAME_ONLY = `Find the Pokémon card in this image (direct photo or marketplace screenshot).
Read any visible text (listing title, card name area) to find:
1. Pokémon name + variant (Charizard ex, Pikachu VMAX, Mewtwo GX...)
2. Language (FR/EN/JP/DE)

Return ONLY valid JSON: {"cardName":"Charizard ex","englishName":"Charizard ex","language":"FR"}`

interface AiResult {
  cardName: string; englishName: string; cardNumber: string
  setName: string; setId: string; language: string
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[''`]/g, '').replace(/\s+/g, ' ').trim()
}

function extractTotal(cardNumber: string): number | null {
  const raw = (cardNumber ?? '').split('/')[1]?.trim()
  if (!raw || /[A-Za-z]/.test(raw)) return null
  const n = parseInt(raw, 10)
  return n > 0 && n <= 500 ? n : null
}

function numberVariants(raw: string): string[] {
  const base = raw.split('/')[0].trim()
  if (!base) return []
  const vs = new Set<string>([base])
  const noZeros = base.replace(/^0+(?=[0-9])/, '')
  vs.add(noZeros)
  if (/^\d+$/.test(noZeros)) { vs.add(noZeros.padStart(2, '0')); vs.add(noZeros.padStart(3, '0')) }
  const alpha = base.match(/^([A-Z]+)(\d+)$/i)
  if (alpha) {
    const [, pfx, dig] = alpha
    const clean = dig.replace(/^0+(?=[0-9])/, '')
    vs.add(`${pfx.toUpperCase()}${dig}`)
    vs.add(`${pfx.toUpperCase()}${clean}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(2,'0')}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(3,'0')}`)
    vs.add(clean); vs.add(clean.padStart(3,'0'))
  }
  return [...vs].filter(Boolean)
}

function numberSetHints(num: string): string[] {
  const n = num.toUpperCase()
  if (n.match(/^SV\d/))   return ['swsh45sv','swsh4sv','swsh35sv','pgo','swsh1']
  if (n.match(/^TG\d/))   return ['swsh9','swsh10','swsh11','swsh12','swsh12pt5']
  if (n.match(/^GG\d/))   return ['sv1','sv2','sv3','sv3pt5','sv4']
  if (n.match(/^SWSH\d/)) return ['swshp']
  if (n.match(/^SM\d/))   return ['smp']
  if (n.match(/^XY\d/))   return ['xyp']
  return []
}

// ── Résolution du set ─────────────────────────────────────────────────────────

async function resolveSetId(hint: AiResult): Promise<string> {
  // 1. Total imprimé (le plus fiable) : "006/165" → 165 → sv3pt5
  const total = extractTotal(hint.cardNumber)
  if (total) {
    const sets = await prisma.pokemonSet.findMany({
      where: { OR: [{ printedTotal: total }, { totalCards: total }] },
      select: { externalId: true }, orderBy: { releaseDate: 'desc' }, take: 3,
    })
    if (sets.length === 1) { console.log(`[scan] set via total ${total} → ${sets[0].externalId}`); return sets[0].externalId }
  }
  // 2. Nom du set
  if (hint.setName) {
    const norm = normalizeName(hint.setName)
    const MAP: Record<string,string> = {
      '151':'sv3pt5','flammes obsidiennes':'sv3','obsidian flames':'sv3',
      'mascarade crepusculaire':'sv6','twilight masquerade':'sv6',
      'forces temporelles':'sv5','temporal forces':'sv5',
      'evolution celeste':'swsh7','evolving skies':'swsh7',
      'astres radieux':'swsh10','brilliant stars':'swsh9',
      'couronne zenith':'swsh12pt5','crown zenith':'swsh12pt5',
      'origine perdue':'swsh11','lost origin':'swsh11',
      'epee et bouclier':'swsh1','sword shield':'swsh1',
      'celebrations':'cel25','base':'base1','jungle':'jungle','fossil':'fossil',
      'scarlet violet':'sv1','ecarlate et violet':'sv1',
      'paldea evolved':'sv2','ecarlate et violet evolution paldea':'sv2',
      'pokemon go':'pgo','paldean fates':'sv4pt5','destinees de paldea':'sv4pt5',
      'shrouded fable':'sv6pt5','fable nebuleuse':'sv6pt5',
      'stellar crown':'sv7','couronne stellaire':'sv7',
      'surging sparks':'sv8','etincelles dechainantes':'sv8',
      'prismatic evolutions':'sv8pt5','evolutions prismatiques':'sv8pt5',
      'journey together':'sv9','voyage ensemble':'sv9',
      'paradox rift':'sv4','faille paradoxe':'sv4',
    }
    for (const [k,v] of Object.entries(MAP)) if (norm.includes(k) || k.includes(norm.substring(0,8))) return v
    const dbSet = await prisma.pokemonSet.findFirst({
      where: { name: { contains: hint.setName.substring(0,12), mode: 'insensitive' } },
      select: { externalId: true }, orderBy: { releaseDate: 'desc' },
    })
    if (dbSet?.externalId) return dbSet.externalId
  }
  return hint.setId || ''
}

// ── DB selects ────────────────────────────────────────────────────────────────
const SEL = {
  id:true, name:true, number:true, rarity:true, imageSmUrl:true, imageLgUrl:true,
  set: { select: { name:true, externalId:true, releaseDate:true, logoUrl:true } },
  prices: { where:{ source:'cardmarket' }, orderBy:{ updatedAt:'desc' } as any, take:1, select:{ market:true, low:true, high:true, currency:true, source:true } },
  marketData: { select:{ investmentScore:true, rarityScore:true, liquidityScore:true, trendDirection:true, priceChange7d:true, priceChange30d:true, priceChange1y:true, allTimeHigh:true, volatility30d:true } },
  aiAnalysis: { select:{ investmentScore:true, predictedRoi90d:true, trendDirection:true, bullishSignals:true, bearishSignals:true, keyInsight:true, predictions:{ select:{ horizonDays:true, predictedPrice:true, lowerBound:true, upperBound:true }, orderBy:{ horizonDays:'asc' } as any } } },
}
const CAND_SEL = {
  id:true, name:true, number:true, rarity:true, imageSmUrl:true, imageLgUrl:true,
  set: { select:{ name:true, externalId:true } },
  prices: { where:{ source:'cardmarket' }, orderBy:{ updatedAt:'desc' } as any, take:1, select:{ market:true } },
}

// ── Score de correspondance ───────────────────────────────────────────────────
function matchScore(card: any, hint: AiResult, setId: string): number {
  let s = 0
  const nums     = numberVariants(hint.cardNumber)
  const cn       = (card.number ?? '').split('/')[0].trim()
  const hintNorm = normalizeName(hint.englishName || hint.cardName)
  const cardNorm = normalizeName(card.name ?? '')
  const sid      = setId || hint.setId

  if (hint.cardNumber && nums.includes(cn))                                                     s += 50
  else if (hint.cardNumber && cn.replace(/^[A-Z]+/i,'') === hint.cardNumber.replace(/^[A-Z]+/i,'')) s += 20
  if (hintNorm && cardNorm === hintNorm)                                                         s += 40
  else if (hintNorm && cardNorm.startsWith(hintNorm.split(' ')[0]))                             s += 15
  if (sid && card.set?.externalId === sid)                                                       s += 30

  return s
}

// ── Recherche DB ──────────────────────────────────────────────────────────────
async function findCard(hint: AiResult, setId: string): Promise<any | null> {
  const numRaw = (hint.cardNumber ?? '').split('/')[0].trim()
  const nums   = numberVariants(numRaw)
  const frNorm = normalizeName(hint.cardName)
  const enNorm = normalizeName(hint.englishName)

  if (!hint.cardName && !hint.englishName && !numRaw) return null

  // S1 : externalId exact (batch — une seule requête)
  const setIds = new Set<string>([...[setId, hint.setId].filter(Boolean), ...numberSetHints(numRaw)])
  const extIds = [...setIds].flatMap(sid => nums.map(n => `${sid}-${n}`))
  if (extIds.length) {
    const found = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: SEL })
    if (found) { console.log(`[scan] ✅ S1 externalId`); return found }
  }

  if (numRaw) {
    // S2 : nom + numéro (en parallèle pour fr et en)
    const nameQueries = [hint.cardName, hint.englishName].filter((v,i,a) => v && a.indexOf(v) === i)
    const s2results = await Promise.all(nameQueries.map(name =>
      prisma.card.findMany({
        where: { name: { contains: name, mode:'insensitive' }, number: { in: nums } },
        select: SEL, orderBy: { set: { releaseDate:'desc' } } as any, take: 8,
      })
    ))
    const s2all = s2results.flat()
    if (s2all.length) {
      const exact = setId ? s2all.find(c => c.set.externalId === setId) : null
      const best  = exact ?? s2all[0]
      console.log(`[scan] ✅ S2 name+num → ${best.name} (${best.set.externalId})`)
      return best
    }

    // S3 : numéro + setId
    if (setId) {
      const s3 = await prisma.card.findFirst({ where: { number: { in: nums }, set: { externalId: setId } }, select: SEL })
      if (s3) { console.log(`[scan] ✅ S3 num+set`); return s3 }
    }

    // S4 : numéro seul — uniquement si résultat unique
    const byNum = await prisma.card.findMany({ where: { number: { in: nums } }, select: SEL, take: 30 })
    if (byNum.length === 1) { console.log(`[scan] ✅ S4 num unique`); return byNum[0] }
    if (byNum.length > 1) {
      for (const norm of [frNorm, enNorm].filter(Boolean)) {
        const exact = byNum.find(c => normalizeName(c.name) === norm)
        if (exact) {
          if (!setId || exact.set.externalId === setId) { console.log(`[scan] ✅ S4 num+name`); return exact }
        }
        const prefix = byNum.filter(c => normalizeName(c.name).startsWith(norm.split(' ')[0]))
        if (prefix.length === 1) { console.log(`[scan] ✅ S4 num+prefix`); return prefix[0] }
        if (prefix.length > 1 && setId) {
          const inSet = prefix.find(c => c.set.externalId === setId)
          if (inSet) { console.log(`[scan] ✅ S4 num+set`); return inSet }
        }
      }
    }
  }

  // S5 : nom + setId (sans numéro)
  if (setId && (hint.cardName || hint.englishName)) {
    const name = hint.englishName || hint.cardName
    const s5 = await prisma.card.findFirst({
      where: { name: { contains: name, mode:'insensitive' }, set: { externalId: setId } },
      select: SEL,
    })
    if (s5) { console.log(`[scan] ✅ S5 name+set`); return s5 }
  }

  return null
}

// ── Candidats ─────────────────────────────────────────────────────────────────
async function findCandidates(hint: AiResult, setId: string): Promise<any[]> {
  const numRaw = (hint.cardNumber ?? '').split('/')[0].trim()
  const nums   = numberVariants(numRaw)
  const seen   = new Map<string,any>()
  const add    = (cards: any[]) => cards.forEach(c => { if (!seen.has(c.id)) seen.set(c.id, c) })

  const setIds = new Set<string>([...[setId, hint.setId].filter(Boolean), ...numberSetHints(numRaw)])
  const extIds = [...setIds].flatMap(sid => nums.map(n => `${sid}-${n}`))
  if (extIds.length) add(await prisma.card.findMany({ where: { externalId: { in: extIds } }, select: CAND_SEL, take:5 }))

  if (numRaw && (hint.cardName || hint.englishName)) {
    const name = hint.englishName || hint.cardName
    add(await prisma.card.findMany({
      where: { name: { contains: name, mode:'insensitive' }, number: { in: nums } },
      select: CAND_SEL, take: 8,
    }))
  }
  if (hint.englishName || hint.cardName) {
    add(await prisma.card.findMany({
      where: { name: { contains: hint.englishName || hint.cardName, mode:'insensitive' } },
      select: CAND_SEL, orderBy: { set: { releaseDate:'desc' } } as any, take: 8,
    }))
  }

  return [...seen.values()]
    .map(c => ({ c, s: matchScore(c, hint, setId) }))
    .sort((a,b) => b.s - a.s)
    .slice(0, 5)
    .map(({c}) => c)
}

// ── pokemontcg.io ─────────────────────────────────────────────────────────────
async function searchPtcgio(hint: AiResult, setId: string): Promise<{ ptcgCard: any; dbCard: any | null } | null> {
  try {
    const headers: Record<string,string> = process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    const name  = (hint.englishName || hint.cardName || '').trim()
    const num   = (hint.cardNumber ?? '').split('/')[0].trim()
    const total = extractTotal(hint.cardNumber)

    const queries: string[] = []
    if (num && total)  queries.push(`number:"${num}" set.printedTotal:"${total}"`)
    else if (setId && num) queries.push(`number:"${num}" set.id:${setId}`)
    if (name && num)   queries.push(`name:"${name}" number:"${num}"`)
    if (name && total) queries.push(`name:"${name}" set.printedTotal:"${total}"`)
    if (name && setId) queries.push(`name:"${name}" set.id:${setId}`)
    if (num)           queries.push(`number:"${num}"`)
    if (name)          queries.push(`name:"${name}"`)

    for (const q of queries.slice(0, 4)) {
      try {
        const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`, { headers, signal: AbortSignal.timeout(5000) })
        if (!res.ok) continue
        const cards: any[] = (await res.json()).data ?? []
        if (!cards.length) continue
        const numClean = num.replace(/^0+(?=[0-9])/, '')
        const match = cards.find(c => c.number === num || c.number === numClean)
          ?? cards.find(c => c.name.toLowerCase().includes((name.split(' ')[0] || '').toLowerCase()))
          ?? cards[0]
        console.log(`[scan] ptcgio: ${match.id} (${match.name} #${match.number})`)
        const dbCard = await prisma.card.findUnique({ where: { externalId: match.id }, select: SEL })
        return { ptcgCard: match, dbCard }
      } catch { /* timeout → essayer query suivante */ }
    }
  } catch (e: any) { console.warn('[scan] ptcgio:', e?.message) }
  return null
}

// ── TCGdex ────────────────────────────────────────────────────────────────────
async function searchTcgdex(hint: AiResult): Promise<{ ptcgCard: any; dbCard: any | null } | null> {
  try {
    const name = (hint.englishName || hint.cardName || '').trim()
    const num  = (hint.cardNumber ?? '').split('/')[0].trim()
    if (!name && !num) return null
    const res = await fetch(
      `https://api.tcgdex.net/v2/en/cards?name=${encodeURIComponent(name)}&number=${encodeURIComponent(num || '')}`,
      { signal: AbortSignal.timeout(5000) }
    )
    if (!res.ok) return null
    const cards: any[] = await res.json()
    if (!cards?.length) return null
    const match = cards.find(c => c.localId === num || c.localId === num.replace(/^0+/,'')) ?? cards[0]
    const externalId = match.id?.replace('/', '-')
    const dbCard = externalId ? await prisma.card.findFirst({ where: { OR: [{ externalId }, { externalId: externalId.toLowerCase() }] }, select: SEL }) : null
    return {
      ptcgCard: { id: match.id, name: match.name, number: match.localId ?? num, rarity: match.rarity ?? null, images: { large: match.image ? `${match.image}/high.webp` : null, small: match.image ? `${match.image}/low.webp` : null }, set: { id: match.set?.id, name: match.set?.name, series: null, total: match.set?.cardCount?.total ?? 0 } },
      dbCard,
    }
  } catch { return null }
}

// ── Import ────────────────────────────────────────────────────────────────────
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

// ── Gemini ────────────────────────────────────────────────────────────────────
function extractJson(text: string): AiResult | null {
  const tries = [
    () => { const m = text.match(/\{[\s\S]*?\}/g); if (m) { for (let i=m.length-1; i>=0; i--) { try { return JSON.parse(m[i]) } catch {} } } throw 0 },
    () => JSON.parse(text.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of tries) {
    try {
      const p = fn()
      if (!p || typeof p !== 'object') continue
      if (!p.cardName && !p.englishName && !p.cardNumber && !p.setName) continue
      p.cardName    = (p.cardName    ?? '').trim()
      p.englishName = (p.englishName ?? '').trim()
      p.cardNumber  = (p.cardNumber  ?? '').trim()
      p.setName     = (p.setName     ?? '').trim()
      p.setId       = (p.setId       ?? '').trim()
      p.language    = (p.language    ?? 'FR').trim()
      if (!p.englishName && p.cardName) p.englishName = p.cardName
      if (!p.cardName && p.englishName) p.cardName = p.englishName
      return p as AiResult
    } catch {}
  }
  return null
}

async function callGemini(b64: string, mime: string, prompt: string, maxTokens = 300): Promise<{ text: string | null; rateLimited: boolean }> {
  const safeMime = ['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif'].includes(mime) ? mime : 'image/jpeg'
  let anyRateLimit = false
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method:'POST', headers:{ 'Content-Type':'application/json' },
          body: JSON.stringify({ contents:[{ parts:[{ inline_data:{ mime_type:safeMime, data:b64 } },{ text:prompt }] }], generationConfig:{ temperature:0.1, maxOutputTokens:maxTokens } }),
          signal: AbortSignal.timeout(20000) }
      )
      if (res.status === 429) { console.warn(`[scan] gemini ${model} rate-limited`); anyRateLimit = true; continue }
      if (!res.ok) { console.warn(`[scan] gemini ${model} ${res.status}`); continue }
      const json = await res.json()
      const candidate = json?.candidates?.[0]
      if (candidate?.finishReason === 'SAFETY') continue
      const text = candidate?.content?.parts?.[0]?.text ?? ''
      if (text) { console.log(`[scan] gemini ${model} ok`); return { text, rateLimited: false } }
    } catch (e: any) { console.warn(`[scan] gemini ${model}: ${e?.name ?? 'error'}`) }
  }
  return { text: null, rateLimited: anyRateLimit }
}

async function callGroq(b64: string, mime: string, prompt: string, maxTokens = 300): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null
  const safeMime = mime.startsWith('image/') ? mime : 'image/jpeg'
  for (const model of ['meta-llama/llama-4-scout-17b-16e-instruct']) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: [
            { type: 'image_url', image_url: { url: `data:${safeMime};base64,${b64}` } },
            { type: 'text', text: prompt },
          ]}],
          max_tokens: maxTokens, temperature: 0.1,
        }),
        signal: AbortSignal.timeout(20000),
      })
      if (!res.ok) { console.warn(`[scan] groq ${model} ${res.status}`); continue }
      const json = await res.json()
      const text = json?.choices?.[0]?.message?.content ?? ''
      if (text) { console.log(`[scan] groq ${model} ok`); return text }
    } catch (e: any) { console.warn(`[scan] groq ${model}: ${e?.name ?? 'error'}`) }
  }
  return null
}

function isResultComplete(h: AiResult | null): boolean {
  if (!h) return false
  return !!(h.cardNumber && h.cardNumber.includes('/') && (h.cardName || h.englishName))
}

function isResultPartial(h: AiResult | null): boolean {
  if (!h) return false
  return !!(h.cardName || h.englishName || h.cardNumber)
}

async function runAI(b64: string, mime: string): Promise<{ result: AiResult | null; rateLimited: boolean }> {
  // Pass 1 : prompt principal (carte + texte visible)
  const { text: t1, rateLimited } = await callGemini(b64, mime, PROMPT)
  if (t1) {
    const h = extractJson(t1)
    if (isResultComplete(h)) { console.log(`[scan] AI(gemini+main): "${h!.englishName}" #${h!.cardNumber}`); return { result: h, rateLimited: false } }

    // Pass 2 : prompt spécifique marketplace si résultat incomplet
    const { text: t2 } = await callGemini(b64, mime, PROMPT_MARKETPLACE, 200)
    if (t2) {
      const h2 = extractJson(t2)
      const merged = mergeHints(h, h2)
      if (isResultComplete(merged)) { console.log(`[scan] AI(gemini+marketplace): "${merged!.englishName}" #${merged!.cardNumber}`); return { result: merged, rateLimited: false } }
      if (isResultPartial(merged)) { console.log(`[scan] AI(gemini+partial): "${merged!.englishName}" #${merged!.cardNumber}`); return { result: merged, rateLimited: false } }
    }

    if (isResultPartial(h)) { console.log(`[scan] AI(gemini+partial): "${h!.englishName}" #${h!.cardNumber}`); return { result: h, rateLimited: false } }
  }

  // Fallback Groq — essai prompt principal puis marketplace
  const t3 = await callGroq(b64, mime, PROMPT)
  if (t3) {
    const h3 = extractJson(t3)
    if (isResultComplete(h3)) { console.log(`[scan] AI(groq+main): "${h3!.englishName}" #${h3!.cardNumber}`); return { result: h3, rateLimited: false } }

    const t4 = await callGroq(b64, mime, PROMPT_MARKETPLACE, 200)
    if (t4) {
      const h4 = extractJson(t4)
      const merged = mergeHints(h3, h4)
      if (isResultPartial(merged)) { console.log(`[scan] AI(groq+marketplace): "${merged!.englishName}" #${merged!.cardNumber}`); return { result: merged, rateLimited: false } }
    }
    if (isResultPartial(h3)) return { result: h3, rateLimited: false }
  }

  return { result: null, rateLimited }
}

// Fusionne deux résultats partiels en prenant le meilleur de chaque champ
function mergeHints(a: AiResult | null, b: AiResult | null): AiResult | null {
  if (!a && !b) return null
  if (!a) return b
  if (!b) return a
  return {
    cardName:    a.cardName    || b.cardName,
    englishName: a.englishName || b.englishName,
    cardNumber:  (a.cardNumber?.includes('/') ? a.cardNumber : null) || (b.cardNumber?.includes('/') ? b.cardNumber : null) || a.cardNumber || b.cardNumber,
    setName:     a.setName     || b.setName,
    setId:       a.setId       || b.setId,
    language:    a.language    || b.language || 'FR',
  }
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok:false, error:'GEMINI_API_KEY not configured' }, { status:500 })

  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ ok:false, error:'Connexion requise', requiresAuth:true }, { status:401 })

  const clerkUser = await currentUser()
  const email     = clerkUser?.emailAddresses[0]?.emailAddress
  const user      = await getUserWithTier(clerkId, email ?? undefined)

  const limits = getLimits(user.tier as any)
  if (limits.scansPerMonth !== Infinity) {
    const used = await getScanUsage(user.id)
    if (used >= limits.scansPerMonth) {
      return NextResponse.json({ ok:false, error:`Limite de ${limits.scansPerMonth} scans/mois atteinte.`, limitReached:true, used, limit:limits.scansPerMonth, upgradeUrl:'/pricing' }, { status:429 })
    }
  }

  try {
    const form = await req.formData()
    const imageFiles: File[] = []
    for (const key of ['image','image2','image3']) {
      const f = form.get(key) as File | null
      if (f && f.size > 0) {
        if (f.size > 10*1024*1024) return NextResponse.json({ ok:false, error:'Image trop grande (max 10MB)' }, { status:400 })
        imageFiles.push(f)
      }
    }
    if (!imageFiles.length) return NextResponse.json({ ok:false, error:'No image provided' }, { status:400 })

    // Mettre en cache les buffers
    const buffers = await Promise.all(imageFiles.map(async f => ({
      b64:  Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: ['image/jpeg','image/png','image/webp','image/gif'].includes(f.type) ? f.type : 'image/jpeg',
    })))

    // ── Phase 1 : Extraction AI ───────────────────────────────────
    const aiResults = await Promise.all(buffers.map(({ b64, mime }) => runAI(b64, mime)))
    const anyRateLimit = aiResults.some(r => r.rateLimited)

    function aiScore(r: AiResult | null): number {
      if (!r) return 0
      return (extractTotal(r.cardNumber) ? 4:0) + (r.cardNumber ? 3:0) + (r.setName ? 2:0) + (r.cardName||r.englishName ? 1:0)
    }
    const sorted = aiResults.map(r => r.result).sort((a,b) => aiScore(b) - aiScore(a))

    // Si rien → essai name-only
    if (!sorted[0]?.cardName && !sorted[0]?.englishName && !sorted[0]?.cardNumber) {
      const { text: rawName } = await callGemini(buffers[0].b64, buffers[0].mime, PROMPT_NAME_ONLY, 100)
      if (rawName) { const nh = extractJson(rawName); if (nh?.cardName||nh?.englishName) sorted[0] = nh }
    }

    const hint: AiResult = {
      cardName:    sorted[0]?.cardName    ?? '',
      englishName: sorted[0]?.englishName ?? '',
      cardNumber:  sorted[0]?.cardNumber  ?? '',
      setName:     sorted[0]?.setName     ?? '',
      setId:       sorted[0]?.setId       ?? '',
      language:    sorted[0]?.language    ?? 'FR',
    }
    for (const r of sorted.slice(1)) {
      if (!hint.cardNumber && r?.cardNumber) hint.cardNumber = r.cardNumber
      if (!hint.setName   && r?.setName)    hint.setName    = r.setName
      if (!hint.setId     && r?.setId)      hint.setId      = r.setId
    }
    if (!hint.englishName && hint.cardName) hint.englishName = hint.cardName
    if (!hint.cardName && hint.englishName) hint.cardName    = hint.englishName

    console.log(`[scan] hint: "${hint.englishName}" #${hint.cardNumber} total=${extractTotal(hint.cardNumber)} set="${hint.setName}"`)

    // ── Phase 2 : Résolution du set ───────────────────────────────
    const setId = await resolveSetId(hint)

    // ── Phase 3 : Recherches parallèles ──────────────────────────
    const hasInfo = !!(hint.englishName || hint.cardName || hint.cardNumber)
    const [card0, rawCandidates, ptcgResult] = await Promise.all([
      findCard(hint, setId),
      findCandidates(hint, setId),
      hasInfo ? searchPtcgio(hint, setId) : Promise.resolve(null),
    ])

    // ── Phase 4 : Sélection avec scoring ─────────────────────────
    const dbScore   = card0 ? matchScore(card0, hint, setId) : 0
    let ptcgCard: any = ptcgResult?.dbCard ?? null
    if (!ptcgCard && ptcgResult?.ptcgCard) ptcgCard = await importCard(ptcgResult.ptcgCard)
    const ptcgScore = ptcgCard ? matchScore(ptcgCard, hint, setId) : 0

    console.log(`[scan] DB:${dbScore}(${card0?.name??'-'}) ptcg:${ptcgScore}(${ptcgCard?.name??'-'})`)

    let card: any = null
    if (dbScore >= 50 && dbScore >= ptcgScore)      card = card0
    else if (ptcgScore > 0 && ptcgScore > dbScore)  card = ptcgCard
    else if (dbScore >= 30)                         card = card0
    else if (ptcgScore > 0)                         card = ptcgCard

    // ── Phase 5 : TCGdex si toujours rien ────────────────────────
    if (!card && hasInfo) {
      const tcgdex = await searchTcgdex(hint)
      const tCard  = tcgdex?.dbCard ?? (tcgdex?.ptcgCard ? await importCard(tcgdex.ptcgCard) : null)
      if (tCard) { const ts = matchScore(tCard, hint, setId); if (ts >= 25) card = tCard }
    }

    // ── Phase 6 : Rescue Gemini si score insuffisant ──────────────
    if (!card && buffers.length > 0) {
      console.log(`[scan] 🔄 rescue (number focus)`)
      const { text: geminiRescue } = await callGemini(buffers[0].b64, buffers[0].mime, PROMPT_RESCUE, 100)
      const raw2 = geminiRescue ?? await callGroq(buffers[0].b64, buffers[0].mime, PROMPT_RESCUE, 100)
      if (raw2) {
        const rh = extractJson(raw2) as Partial<AiResult> | null
        if (rh?.cardNumber || rh?.setName) {
          const rHint: AiResult = { ...hint, cardNumber: rh.cardNumber || hint.cardNumber, setName: rh.setName || hint.setName, setId:'' }
          const rSetId = await resolveSetId(rHint)
          console.log(`[scan] rescue num="${rHint.cardNumber}" set="${rSetId}"`)
          const [rDb, rPtcg_] = await Promise.all([findCard(rHint, rSetId), searchPtcgio(rHint, rSetId)])
          const rPtcg = rPtcg_?.dbCard ?? (rPtcg_?.ptcgCard ? await importCard(rPtcg_!.ptcgCard) : null)
          const rDbS  = rDb   ? matchScore(rDb,   rHint, rSetId) : 0
          const rPtcgS= rPtcg ? matchScore(rPtcg, rHint, rSetId) : 0
          if (rPtcgS >= rDbS && rPtcg) card = rPtcg
          else if (rDbS >= 25) card = rDb
          if (card) hint.cardNumber = rHint.cardNumber
        }
      }
    }

    // ── Phase 7 : Construire la réponse ──────────────────────────
    const buildCand = (c: any, src?: string) => ({
      id: c.id, name: c.name, number: c.number, rarity: c.rarity ?? '',
      imageUrl: c.imageLgUrl ?? c.imageSmUrl ?? null,
      setName: c.set?.name ?? '', setId: c.set?.externalId ?? '',
      price: Number(c.prices?.[0]?.market ?? 0) || null,
      ...(src ? { source:src } : {}),
    })

    const candIds = new Set<string>()
    const candidateList: ReturnType<typeof buildCand>[] = []
    if (card) { candIds.add(card.id); candidateList.push(buildCand(card)) }
    for (const c of rawCandidates) {
      if (!candIds.has(c.id)) { candIds.add(c.id); candidateList.push(buildCand(c)); if (candidateList.length >= 5) break }
    }
    if (candidateList.length === 0 && ptcgCard && !candIds.has(ptcgCard.id)) {
      candidateList.push(buildCand(ptcgCard, 'ptcgio'))
    }
    if (candidateList.length === 0 && (hint.cardName || hint.englishName)) {
      candidateList.push({ id:`ai:${hint.cardNumber||'unknown'}`, name:hint.cardName||hint.englishName, number:hint.cardNumber||'?', rarity:'', imageUrl:null, setName:hint.setName||'Extension inconnue', setId:hint.setId||'', price:null, source:'ai' })
    }

    const price = Number(card?.prices?.[0]?.market ?? 0)
    const md    = card?.marketData ?? null
    const ai    = card?.aiAnalysis ?? null
    const pred365 = ai?.predictions?.find((p: any) => p.horizonDays === 365)
    let proj = null, annualGrowthRate = 0
    if (price > 0 && card) {
      const rarityW = RARITY_W[card.rarity ?? ''] ?? 0.05
      const exId    = card.set?.externalId ?? ''
      const era     = detectEra(exId, card.set?.name ?? null)
      const cTier   = charTier(card.name)
      const ath     = md?.allTimeHigh ? Number(md.allTimeHigh) : price
      const athDrop = ath > price ? +(((ath - price) / ath) * 100).toFixed(1) : 0
      const targets = buildTargets(price, ath, cTier, rarityW, scarcityScore(exId, card.rarity ?? ''), era, athDrop)
      proj = { y1:{ value:targets.t1y }, y3:{ value:targets.t3y }, y5:{ value:targets.t5y }, y10:{ value:targets.t10y } }
      annualGrowthRate = +(((targets.t1y / price) - 1) * 100).toFixed(1)
    }

    await incrementScanUsage(user.id)
    ph.capture({ distinctId: clerkId, event: 'card_scanned', properties: { card_name: card?.name ?? hint.englishName, card_found: !!card, tier: user.tier } })

    return NextResponse.json({
      ok: true,
      identification: hint,
      candidates: candidateList,
      dbMatch: card ? {
        id:card.id, name:card.name, number:card.number, rarity:card.rarity,
        imageUrl: card.imageLgUrl ?? card.imageSmUrl,
        set: card.set,
        price: price > 0 ? { market:price, low:Number(card.prices[0].low??0), high:Number(card.prices[0].high??0), currency:card.prices[0].currency } : null,
        market: md ? { investmentScore:md.investmentScore??0, rarityScore:md.rarityScore??0, liquidityScore:md.liquidityScore??0, trendDirection:md.trendDirection, change7d:Number(md.priceChange7d??0), change30d:Number(md.priceChange30d??0), change1y:Number(md.priceChange1y??0), allTimeHigh:Number(md.allTimeHigh??0), volatility:Number(md.volatility30d??0) } : null,
        ai: ai ? { investmentScore:ai.investmentScore, trendDirection:ai.trendDirection, bullishSignals:ai.bullishSignals.slice(0,3), bearishSignals:ai.bearishSignals.slice(0,2), keyInsight:ai.keyInsight, pred1y: pred365 ? { value:Number(pred365.predictedPrice), low:Number(pred365.lowerBound), high:Number(pred365.upperBound) } : null } : null,
        projections: proj,
        annualGrowthRate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok:false, error: err?.message ?? 'Scan failed' }, { status:500 })
  }
}
