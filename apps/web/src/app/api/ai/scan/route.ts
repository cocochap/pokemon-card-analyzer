/**
 * POST /api/ai/scan
 * Step 1: Gemini identifies the card (name, set, number)
 * Step 2: Multi-strategy DB lookup (number > name+set > name > API fallback)
 * Step 3: Return price + investment projections
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

// Prompt focused on extracting precise identifiers
const PROMPT = `You are a Pokémon TCG card identification expert. Study this card image carefully.

Extract the EXACT information printed on the card. The card number (bottom right/left) and set symbol are the most important.

Return ONLY a raw JSON object (no markdown, no code fences):
{
  "cardName": "exact name printed at top of card",
  "setName": "full English set name",
  "setId": "pokemontcg.io set ID (e.g. base1, sv1, sv8pt5, swsh1, xy1, sm1, bw1, dp1, pl1, hgss1, ex1, neo1, base2)",
  "cardNumber": "number at bottom of card, exactly as printed (e.g. 4, 4/102, 025/165, SWSH092, TG01/TG30)",
  "rarity": "rarity symbol description: Common=circle, Uncommon=diamond, Rare=star, Holo Rare=star+holo, Ultra Rare, Secret Rare, Special Illustration Rare, Hyper Rare, Crown Rare",
  "hp": 120,
  "types": ["Fire"],
  "isFirstEdition": false,
  "isShadowless": false,
  "language": "EN",
  "confidence": 95,
  "alternativeNames": ["other possible spellings or French name if visible"]
}`

interface CardId {
  cardName:         string
  setName:          string
  setId:            string
  cardNumber:       string
  rarity:           string
  hp:               number | null
  types:            string[]
  isFirstEdition:   boolean
  isShadowless:     boolean
  language:         string
  confidence:       number
  alternativeNames: string[]
}

function extractJson(text: string): CardId | null {
  const strategies = [
    () => { const m = text.match(/\{[\s\S]*\}/g); if (m) return JSON.parse(m[m.length - 1]); throw new Error('no match') },
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of strategies) {
    try { const p = fn(); if (p && typeof p === 'object') return p as CardId } catch { /* next */ }
  }
  return null
}

async function identifyWithGemini(b64: string, mimeType: string): Promise<CardId | null> {
  for (const model of MODELS) {
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
            generationConfig: { temperature: 0.05, maxOutputTokens: 512 },
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) continue
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const data = extractJson(text)
      if (data?.cardName) { console.log(`[scan] ${model}: "${data.cardName}" #${data.cardNumber} set=${data.setId}`); return data }
    } catch (e: any) { console.warn(`[scan] ${model}:`, e?.message) }
  }
  return null
}

// ── pokemontcg.io API fallback ─────────────────────────────────
async function searchPokemonTcgApi(id: CardId): Promise<{ externalId: string; name: string; number: string; setId: string } | null> {
  try {
    // Try exact externalId format first: "setId-number"
    const numClean = id.cardNumber.split('/')[0].replace(/^0+/, '')
    const candidates = [`${id.setId}-${numClean}`, `${id.setId}-${id.cardNumber}`]

    for (const extId of candidates) {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards/${extId}`, {
        headers: process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {},
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        const d = await res.json()
        if (d.data) return { externalId: d.data.id, name: d.data.name, number: d.data.number, setId: d.data.set.id }
      }
    }

    // Search by name + set
    const q = encodeURIComponent(`name:"${id.cardName}" set.id:${id.setId}`)
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=5`, {
      headers: process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {},
      signal: AbortSignal.timeout(5000),
    })
    if (res.ok) {
      const d = await res.json()
      if (d.data?.length > 0) {
        const card = d.data[0]
        return { externalId: card.id, name: card.name, number: card.number, setId: card.set.id }
      }
    }

    // Search by name only
    const q2 = encodeURIComponent(`name:"${id.cardName}"`)
    const res2 = await fetch(`https://api.pokemontcg.io/v2/cards?q=${q2}&pageSize=3`, {
      headers: process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {},
      signal: AbortSignal.timeout(5000),
    })
    if (res2.ok) {
      const d = await res2.json()
      if (d.data?.length > 0) return { externalId: d.data[0].id, name: d.data[0].name, number: d.data[0].number, setId: d.data[0].set.id }
    }
  } catch (e: any) { console.warn('[scan] pokemontcg.io fallback:', e?.message) }
  return null
}

// ── DB lookup — cascade of 5 strategies ───────────────────────
async function findInDb(id: CardId) {
  const numClean = id.cardNumber.split('/')[0].replace(/^0+/, '')
  const allNames = [id.cardName, ...(id.alternativeNames ?? [])].filter(Boolean)

  const selectFields = {
    id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
    set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
    prices:     { orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true } },
    marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
    aiAnalysis: { select: { investmentScore: true, predictedRoi30d: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
  }

  // Strategy 1: exact externalId (setId-number)
  for (const extId of [`${id.setId}-${numClean}`, `${id.setId}-${id.cardNumber}`]) {
    const r = await prisma.card.findUnique({ where: { externalId: extId }, select: selectFields })
    if (r) { console.log(`[scan] DB match: externalId=${extId}`); return r }
  }

  // Strategy 2: number + set
  if (id.setId) {
    const r = await prisma.card.findFirst({
      where: { OR: [{ number: numClean }, { number: id.cardNumber }], set: { externalId: id.setId } },
      select: selectFields,
    })
    if (r) { console.log(`[scan] DB match: number+set`); return r }
  }

  // Strategy 3: name + set (all name variants)
  if (id.setId) {
    for (const name of allNames) {
      const r = await prisma.card.findFirst({
        where: { name: { contains: name, mode: 'insensitive' }, set: { externalId: { contains: id.setId.replace(/\d+$/, ''), mode: 'insensitive' } } },
        select: selectFields,
      })
      if (r) { console.log(`[scan] DB match: name+set for "${name}"`); return r }
    }
  }

  // Strategy 4: name only (all variants) — prefer exact number match
  for (const name of allNames) {
    const results = await prisma.card.findMany({
      where: { name: { contains: name, mode: 'insensitive' } },
      select: selectFields,
      take: 10,
    })
    if (results.length > 0) {
      const exact = results.find(c => c.number === numClean || c.number === id.cardNumber)
      const best  = exact ?? results[0]
      console.log(`[scan] DB match: name only for "${name}"`)
      return best
    }
  }

  // Strategy 5: pokemontcg.io API → find by externalId in our DB
  console.log('[scan] trying pokemontcg.io API fallback...')
  const apiCard = await searchPokemonTcgApi(id)
  if (apiCard) {
    const r = await prisma.card.findUnique({ where: { externalId: apiCard.externalId }, select: selectFields })
    if (r) { console.log(`[scan] DB match via API: ${apiCard.externalId}`); return r }
    // Card exists in API but not in our DB — still useful
    console.log(`[scan] API found "${apiCard.name}" (${apiCard.externalId}) but not in our DB`)
  }

  return null
}

function project(price: number, rate: number, years: number) {
  return Math.round(price * Math.pow(1 + rate / 100, years) * 100) / 100
}

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
    const identified = await identifyWithGemini(b64, mimeType)
    if (!identified?.cardName) {
      return NextResponse.json({ ok: false, error: 'Card not recognized — try a clearer photo with better lighting' }, { status: 422 })
    }

    // Step 2: find in DB (5-strategy cascade)
    const best = await findInDb(identified)

    // Step 3: projections
    const price   = Number(best?.prices?.[0]?.market ?? 0)
    const md      = best?.marketData ?? null
    const ai      = best?.aiAnalysis ?? null
    const roi1y   = Number(md?.priceChange1y ?? 0)
    const roi90d  = Number(ai?.predictedRoi90d ?? 0) * 4
    const annualRate = roi1y !== 0 ? roi1y : roi90d !== 0 ? roi90d : 8

    const projections = price > 0 ? {
      y1:  { value: project(price, annualRate, 1) },
      y3:  { value: project(price, annualRate, 3) },
      y5:  { value: project(price, annualRate, 5) },
      y10: { value: project(price, annualRate, 10) },
    } : null

    const pred365 = ai?.predictions?.find((p: any) => p.horizonDays === 365)

    return NextResponse.json({
      ok: true,
      identification: identified,
      dbMatch: best ? {
        id: best.id, name: best.name, number: best.number, rarity: best.rarity,
        imageUrl: best.imageLgUrl ?? best.imageSmUrl,
        set: best.set,
        price: price > 0 ? { market: price, low: Number(best.prices[0].low ?? 0), high: Number(best.prices[0].high ?? 0), currency: best.prices[0].currency } : null,
        market: md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, liquidityScore: md.liquidityScore ?? 0, trendDirection: md.trendDirection, change7d: Number(md.priceChange7d ?? 0), change30d: Number(md.priceChange30d ?? 0), change1y: Number(md.priceChange1y ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0), volatility: Number(md.volatility30d ?? 0) } : null,
        ai: ai ? { investmentScore: ai.investmentScore, trendDirection: ai.trendDirection, bullishSignals: ai.bullishSignals.slice(0, 3), bearishSignals: ai.bearishSignals.slice(0, 2), keyInsight: ai.keyInsight, pred1y: pred365 ? { value: Number(pred365.predictedPrice), low: Number(pred365.lowerBound), high: Number(pred365.upperBound) } : null } : null,
        projections,
        annualGrowthRate: annualRate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
