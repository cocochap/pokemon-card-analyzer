/**
 * POST /api/ai/scan
 * Universal card scanner: works for all languages, all sets, all number formats.
 *
 * Strategy:
 * 1. Gemini: extract name (+ English translation) + exact number + set clues
 * 2. DB search by externalId (exact), then scored name+number search
 * 3. pokemontcg.io API fallback if score too low
 * 4. Auto-import if card found on API but not in DB
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

// ── Number format → set era hints ─────────────────────────────
// Helps narrow down the set when the AI struggles to identify it
function inferSetHints(cardNumber: string): string[] {
  const n = cardNumber.toUpperCase()
  if (n.startsWith('SV'))   return ['swsh45sv', 'swsh4sv', 'swsh35sv', 'pgo']  // Shiny Vault
  if (n.startsWith('TG'))   return ['swsh9', 'swsh10', 'swsh11', 'swsh12']      // Trainer Gallery
  if (n.startsWith('GG'))   return ['sv1', 'sv2', 'sv3', 'sv3pt5']              // Galarian Gallery
  if (n.startsWith('SWSH')) return ['swshp']                                    // SWSH Promos
  if (n.startsWith('SM'))   return ['smp']                                      // SM Promos
  if (n.startsWith('XY'))   return ['xyp']                                      // XY Promos
  return []
}

const PROMPT = `You are a Pokémon TCG expert. Identify this card precisely.

Read CAREFULLY:
1. The name at the TOP of the card (exactly as printed)
2. The ENGLISH name (translate if needed — examples: Dracaufeu→Charizard, Évoli→Eevee, Ronflex→Snorlax, Aquali→Vaporeon, Pyroli→Flareon, Mentali→Espeon, Noctali→Umbreon, Givrali→Glaceon, Phyllali→Leafeon, Voltali→Jolteon, Nymphali→Sylveon)
3. The card NUMBER at the bottom (copy EXACTLY — e.g: 4, 4/102, 025/165, SV107/SV122, SWSH092, TG01/TG30, GG01/GG70, 001/S-P)
4. The SET — look at: set symbol, copyright year, card layout, color borders, series logo

Return ONLY raw JSON:
{
  "cardName": "exact name as printed",
  "englishName": "English name always (translate Pokémon names)",
  "cardNumber": "FULL number EXACTLY as printed, including any letter prefix",
  "numberBase": "number before the slash, no leading zeros (e.g: 4, SV107, 25, SWSH92)",
  "setId": "pokemontcg.io ID — your best guess (e.g: base1, sv1, sv2, sv3, sv3pt5, sv4, sv4pt5, sv5, sv6, sv7, sv8, sv8pt5, pgo, swsh1, swsh3, swsh45sv, swsh12pt5, xy1, sm1, bw1, dp1, pl1, hgss1, ex1, neo1)",
  "setName": "set name as shown on card",
  "series": "Scarlet & Violet / Sword & Shield / Sun & Moon / XY / Black & White / HeartGold SoulSilver / Platinum / Diamond & Pearl / EX / e-Card / Neo / Base",
  "year": 2024,
  "language": "EN or FR or JP or DE or ES or IT or PT or KO or ZH",
  "isHolo": false,
  "confidence": 90
}`

interface AiHint {
  cardName:    string
  englishName: string
  cardNumber:  string
  numberBase:  string
  setId:       string
  setName:     string
  series:      string
  year:        number
  language:    string
  isHolo:      boolean
  confidence:  number
}

function extractJson(text: string): AiHint | null {
  const strategies = [
    () => { const m = text.match(/\{[\s\S]*\}/g); if (m) return JSON.parse(m[m.length - 1]); throw 0 },
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of strategies) {
    try { const p = fn(); if (p?.cardName) return p as AiHint } catch { /* next */ }
  }
  return null
}

async function aiIdentify(b64: string, mimeType: string): Promise<AiHint | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType, data: b64 } },
              { text: PROMPT },
            ]}],
            generationConfig: { temperature: 0.0, maxOutputTokens: 400 },
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) continue
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const hint = extractJson(text)
      if (hint?.cardName) {
        console.log(`[scan] AI: "${hint.cardName}" → EN:"${hint.englishName}" #${hint.cardNumber} set=${hint.setId} series="${hint.series}"`)
        return hint
      }
    } catch (e: any) { console.warn(`[scan] ${model}:`, e?.message) }
  }
  return null
}

// ── DB select fields ───────────────────────────────────────────
const DB_SELECT = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
  prices:     { orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true } },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}

// ── Scoring ─────────────────────────────────────────────────────
function scoreCard(card: any, hint: AiHint): number {
  let score = 0
  const enName = (hint.englishName || hint.cardName).toLowerCase().trim()

  // ── Name matching (0-25 pts) ───────────────────────────────
  const cardNameLow = card.name.toLowerCase()
  if (cardNameLow === enName) score += 25
  else if (cardNameLow === enName.split(' ')[0]) score += 15  // base Pokémon name matches
  else if (enName.startsWith(cardNameLow.split(' ')[0]) || cardNameLow.startsWith(enName.split(' ')[0])) score += 8
  else return 0  // completely different Pokémon — reject immediately

  // ── Number matching (0-25 pts) ────────────────────────────
  const hNum  = hint.numberBase || hint.cardNumber.split('/')[0].replace(/^0+(?=[0-9])/, '')
  const cNum  = card.number.split('/')[0].trim()
  const hFull = hint.cardNumber.split('/')[0].trim().toUpperCase()
  const cFull = card.number.split('/')[0].trim().toUpperCase()

  if (cFull === hFull) score += 25
  else if (cNum.replace(/^0+/, '') === hNum.replace(/^0+/, '') && !hFull.match(/^[A-Z]{2,}/)) score += 20
  else if (cNum === hNum) score += 15

  // ── Set matching (0-15 pts) ────────────────────────────────
  if (hint.setId && card.set.externalId === hint.setId) score += 15
  else if (hint.setId && card.set.externalId.startsWith(hint.setId.replace(/\d+$/, '').replace(/pt\d+$/, ''))) score += 8
  // Match by series
  if (hint.series) {
    const s = hint.series.toLowerCase()
    const e = card.set.externalId.toLowerCase()
    if (s.includes('scarlet') && e.startsWith('sv')) score += 5
    else if (s.includes('sword') && e.startsWith('swsh')) score += 5
    else if (s.includes('sun') && e.startsWith('sm')) score += 5
    else if (s.includes('xy') && e.startsWith('xy')) score += 5
    else if (s.includes('black') && e.startsWith('bw')) score += 5
    else if (s.includes('heartgold') && e.startsWith('hgss')) score += 5
    else if (s.includes('diamond') && e.startsWith('dp')) score += 5
    else if (s.includes('base') && ['base1','base2','base3','base4','base5','base6'].includes(e)) score += 5
  }

  // ── Prefer cards with prices ──────────────────────────────
  if (card.prices?.length > 0 && Number(card.prices[0].market) > 0) score += 2

  return score
}

// ── DB lookup ───────────────────────────────────────────────────
async function findInDb(hint: AiHint): Promise<any | null> {
  const enName   = (hint.englishName || hint.cardName).trim()
  const altName  = hint.englishName ? hint.cardName.trim() : ''
  const numFull  = hint.cardNumber.split('/')[0].trim().toUpperCase()
  const numBase  = hint.numberBase || numFull.replace(/^0+(?=[0-9])/, '')
  const numPad   = numFull.replace(/^([A-Z]*)(\d+)/, (_, l, n) => l + n.padStart(3, '0'))
  const setHints = inferSetHints(numFull)

  // Strategy 1: exact externalId
  const tryIds = [
    hint.setId && `${hint.setId}-${numFull}`,
    hint.setId && `${hint.setId}-${numBase}`,
    hint.setId && `${hint.setId}-${numPad}`,
    ...setHints.flatMap(s => [`${s}-${numFull}`, `${s}-${numBase}`]),
  ].filter(Boolean) as string[]

  for (const extId of [...new Set(tryIds)]) {
    const r = await prisma.card.findUnique({ where: { externalId: extId }, select: DB_SELECT })
    if (r) { console.log(`[scan] hit externalId=${extId}`); return r }
  }

  // Strategy 2: exact name + set
  if (hint.setId) {
    const r = await prisma.card.findFirst({
      where: { name: { equals: enName, mode: 'insensitive' }, set: { externalId: hint.setId } },
      select: DB_SELECT,
    })
    if (r) { console.log(`[scan] hit name+set`); return r }
  }

  // Strategy 3: name search (English + French ILIKE) → score results
  const allCandidates = new Map<string, any>()
  for (const searchName of [enName, altName].filter(Boolean)) {
    const byEn = await prisma.card.findMany({
      where: { name: { contains: searchName, mode: 'insensitive' } },
      select: DB_SELECT, take: 30,
    })
    byEn.forEach(c => allCandidates.set(c.id, c))

    const frIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Card" WHERE "localeName"->>'fr' ILIKE ${`%${searchName}%`} LIMIT 15
    `
    if (frIds.length) {
      const byFr = await prisma.card.findMany({ where: { id: { in: frIds.map(r => r.id) } }, select: DB_SELECT })
      byFr.forEach(c => allCandidates.set(c.id, c))
    }
  }

  let candidates = Array.from(allCandidates.values())

  // Strategy 4: first Pokémon name word if still empty
  if (!candidates.length) {
    const firstWord = enName.split(' ')[0]
    if (firstWord.length >= 3) {
      const byFirst = await prisma.card.findMany({
        where: { name: { startsWith: firstWord, mode: 'insensitive' } },
        select: DB_SELECT, take: 30,
      })
      byFirst.forEach(c => allCandidates.set(c.id, c))
      const frIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Card" WHERE "localeName"->>'fr' ILIKE ${`${firstWord}%`} LIMIT 15
      `
      if (frIds.length) {
        const byFr = await prisma.card.findMany({ where: { id: { in: frIds.map(r => r.id) } }, select: DB_SELECT })
        byFr.forEach(c => allCandidates.set(c.id, c))
      }
      candidates = Array.from(allCandidates.values())
    }
  }

  if (!candidates.length) return null

  const scored = candidates.map(c => ({ c, score: scoreCard(c, hint) }))
  scored.sort((a, b) => b.score - a.score)
  const best = scored[0]

  // Minimum score: must have both some name AND some number relevance
  const MIN_SCORE = 15
  if (best.score < MIN_SCORE) {
    console.log(`[scan] score ${best.score} < ${MIN_SCORE} for "${best.c.name}" — rejecting`)
    return null
  }

  console.log(`[scan] best: "${best.c.name}" #${best.c.number} set=${best.c.set.externalId} score=${best.score}`)
  return best.c
}

// ── pokemontcg.io API fallback ─────────────────────────────────
async function findViaPtcgApi(hint: AiHint): Promise<any | null> {
  try {
    const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY
      ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    const enName = hint.englishName || hint.cardName
    const num    = hint.cardNumber.split('/')[0].trim()

    const queries = [
      hint.setId ? `name:"${enName}" number:"${num}" set.id:${hint.setId}` : null,
      hint.setId ? `name:"${enName}" set.id:${hint.setId}` : null,
      `name:"${enName}" number:"${num}"`,
      `name:"${enName}"`,
    ].filter(Boolean) as string[]

    for (const q of queries) {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5&orderBy=-set.releaseDate`,
        { headers, signal: AbortSignal.timeout(5000) },
      )
      if (!res.ok) continue
      const d = await res.json()
      if (!d.data?.length) continue

      // Prefer number match
      const cards = d.data as any[]
      const best  = cards.find(c => c.number === num || c.number === num.replace(/^0+/, '')) ?? cards[0]
      console.log(`[scan] ptcg.io: ${best.id}`)

      const dbCard = await prisma.card.findUnique({ where: { externalId: best.id }, select: DB_SELECT })
      if (dbCard) return dbCard
      break // found on API but not in DB → will trigger auto-import
    }
  } catch (e: any) { console.warn('[scan] ptcg.io:', e?.message) }
  return null
}

// ── Projections ────────────────────────────────────────────────
function project(price: number, rate: number, years: number) {
  return Math.round(price * Math.pow(1 + rate / 100, years) * 100) / 100
}

// ── Main handler ───────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }
  try {
    const form = await req.formData()
    const file = form.get('image') as File | null
    if (!file) return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image too large (max 10MB)' }, { status: 400 })

    const b64      = Buffer.from(await file.arrayBuffer()).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Step 1: AI identification
    const hint = await aiIdentify(b64, mimeType)
    if (!hint?.cardName) {
      return NextResponse.json({ ok: false, error: 'Carte non reconnue — essaie avec une photo plus nette et bien éclairée' }, { status: 422 })
    }

    // Step 2: DB search
    let best = await findInDb(hint)

    // Step 3: pokemontcg.io API fallback
    if (!best) {
      console.log('[scan] DB miss, trying pokemontcg.io API...')
      best = await findViaPtcgApi(hint)
    }

    // Step 4: auto-import set if API found card but DB didn't have it
    if (!best && hint.setId) {
      try {
        const origin = new URL(req.url).origin
        await fetch(`${origin}/api/admin/sync-sets?setId=${hint.setId}&limit=1`, {
          method: 'POST', signal: AbortSignal.timeout(40000),
        })
        best = await findInDb(hint)
      } catch { /* ignore */ }
    }

    // Build response
    const price      = Number(best?.prices?.[0]?.market ?? 0)
    const md         = best?.marketData ?? null
    const ai         = best?.aiAnalysis ?? null
    const roi1y      = Number(md?.priceChange1y ?? 0)
    const roi90d     = Number(ai?.predictedRoi90d ?? 0) * 4
    const annualRate = roi1y !== 0 ? roi1y : roi90d !== 0 ? roi90d : 8
    const projections = price > 0 ? {
      y1:  { value: project(price, annualRate, 1)  },
      y3:  { value: project(price, annualRate, 3)  },
      y5:  { value: project(price, annualRate, 5)  },
      y10: { value: project(price, annualRate, 10) },
    } : null
    const pred365 = ai?.predictions?.find((p: any) => p.horizonDays === 365)

    return NextResponse.json({
      ok: true,
      identification: hint,
      dbMatch: best ? {
        id: best.id, name: best.name, number: best.number, rarity: best.rarity,
        imageUrl: best.imageLgUrl ?? best.imageSmUrl,
        set: best.set,
        price:  price > 0 ? { market: price, low: Number(best.prices[0].low ?? 0), high: Number(best.prices[0].high ?? 0), currency: best.prices[0].currency } : null,
        market: md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, liquidityScore: md.liquidityScore ?? 0, trendDirection: md.trendDirection, change7d: Number(md.priceChange7d ?? 0), change30d: Number(md.priceChange30d ?? 0), change1y: Number(md.priceChange1y ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0), volatility: Number(md.volatility30d ?? 0) } : null,
        ai:     ai ? { investmentScore: ai.investmentScore, trendDirection: ai.trendDirection, bullishSignals: ai.bullishSignals.slice(0, 3), bearishSignals: ai.bearishSignals.slice(0, 2), keyInsight: ai.keyInsight, pred1y: pred365 ? { value: Number(pred365.predictedPrice), low: Number(pred365.lowerBound), high: Number(pred365.upperBound) } : null } : null,
        projections,
        annualGrowthRate: annualRate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
