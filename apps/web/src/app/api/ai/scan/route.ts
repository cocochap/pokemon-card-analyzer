/**
 * POST /api/ai/scan
 *
 * Flow:
 * 1. Gemini extracts card name + number from image
 * 2. pokemontcg.io API finds the exact card (authoritative IDs)
 * 3. Our DB lookup by externalId → price + investment data
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

// ── Step 1: AI reads name + number off the card ───────────────
const PROMPT = `You are a Pokémon TCG expert. Look very carefully at this card image.

Read these values EXACTLY as printed on the card:
- The name at the TOP of the card
- The number at the BOTTOM (format varies: "4", "4/102", "025/165", "TG01/TG30", "SWSH092")
- The set name if visible

Return ONLY raw JSON (no markdown):
{
  "cardName": "name exactly as printed (e.g. Charizard, Pikachu V, Umbreon VMAX, Gardevoir ex)",
  "cardNumber": "number exactly as printed at bottom",
  "setName": "set name if visible, else empty string",
  "setId": "pokemontcg.io set ID if you know it (e.g. base1, sv1, sv3pt5, swsh12pt5), else empty string",
  "language": "EN or FR or JP or DE or ES",
  "confidence": 90
}`

interface AiHint {
  cardName:   string
  cardNumber: string
  setName:    string
  setId:      string
  language:   string
  confidence: number
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
            generationConfig: { temperature: 0.0, maxOutputTokens: 300 },
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) continue
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const hint = extractJson(text)
      if (hint?.cardName) {
        console.log(`[scan] AI (${model}): name="${hint.cardName}" number="${hint.cardNumber}" setId="${hint.setId}"`)
        return hint
      }
    } catch (e: any) { console.warn(`[scan] ${model}:`, e?.message) }
  }
  return null
}

// ── Step 2: pokemontcg.io finds the exact card ────────────────
interface PtcgCard { id: string; name: string; number: string; set: { id: string; name: string } }

async function findOnPtcgIo(hint: AiHint): Promise<PtcgCard | null> {
  const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY
    ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY }
    : {}
  const timeout = AbortSignal.timeout(6000)

  const numClean = hint.cardNumber.split('/')[0].replace(/^0+/, '').trim()

  // Queries to try in order of specificity
  const queries: string[] = []

  // 1. name + number + set (most specific)
  if (hint.setId)      queries.push(`name:"${hint.cardName}" number:"${hint.cardNumber}" set.id:${hint.setId}`)
  if (hint.setId)      queries.push(`name:"${hint.cardName}" number:"${numClean}" set.id:${hint.setId}`)
  // 2. name + number (across all sets)
  if (hint.cardNumber) queries.push(`name:"${hint.cardName}" number:"${hint.cardNumber}"`)
  if (numClean)        queries.push(`name:"${hint.cardName}" number:"${numClean}"`)
  // 3. name + set
  if (hint.setId)      queries.push(`name:"${hint.cardName}" set.id:${hint.setId}`)
  // 4. name only
                       queries.push(`name:"${hint.cardName}"`)

  for (const q of queries) {
    try {
      const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=10&orderBy=-set.releaseDate`
      const res = await fetch(url, { headers, signal: timeout })
      if (!res.ok) continue
      const data = await res.json()
      if (!data.data?.length) continue

      // Prefer matching number if we have multiple results
      const cards: PtcgCard[] = data.data
      if (hint.cardNumber) {
        const exact = cards.find(c =>
          c.number === hint.cardNumber ||
          c.number === numClean ||
          c.number === hint.cardNumber.split('/')[0]
        )
        if (exact) { console.log(`[scan] ptcg.io: ${exact.id} (${exact.name})`); return exact }
      }

      console.log(`[scan] ptcg.io: ${cards[0].id} (${cards[0].name})`)
      return cards[0]
    } catch { /* next query */ }
  }

  return null
}

// ── Step 3: find in our DB ────────────────────────────────────
const DB_SELECT = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
  prices:     { orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true } },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}

async function findInDb(ptcgCard: PtcgCard | null, hint: AiHint) {
  // Primary: exact externalId from pokemontcg.io
  if (ptcgCard) {
    const r = await prisma.card.findUnique({ where: { externalId: ptcgCard.id }, select: DB_SELECT })
    if (r) return r
  }

  // Fallback: search by name in DB
  const numClean = hint.cardNumber.split('/')[0].replace(/^0+/, '')
  const results = await prisma.card.findMany({
    where: { name: { contains: hint.cardName, mode: 'insensitive' } },
    select: DB_SELECT,
    take: 20,
  })
  if (!results.length) return null

  // Score each result
  const scored = results.map(r => {
    let score = 0
    if (r.number === hint.cardNumber || r.number === numClean) score += 10
    if (ptcgCard && r.set.externalId === ptcgCard.set.id) score += 5
    if (hint.setId && r.set.externalId.startsWith(hint.setId.replace(/\d+$/, ''))) score += 3
    return { r, score }
  })
  scored.sort((a, b) => b.score - a.score)
  return scored[0].r
}

function project(price: number, rate: number, years: number) {
  return Math.round(price * Math.pow(1 + rate / 100, years) * 100) / 100
}

// ── Main handler ──────────────────────────────────────────────
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

    // Step 1: AI
    const hint = await aiIdentify(b64, mimeType)
    if (!hint?.cardName) {
      return NextResponse.json({ ok: false, error: 'Card not recognized — try a clearer photo with better lighting' }, { status: 422 })
    }

    // Steps 2 + 3: run in parallel
    const [ptcgCard, _] = await Promise.all([
      findOnPtcgIo(hint),
      Promise.resolve(),
    ])
    const best = await findInDb(ptcgCard, hint)

    // Projections
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
      identification: { ...hint, resolvedName: ptcgCard?.name ?? hint.cardName, resolvedId: ptcgCard?.id },
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
