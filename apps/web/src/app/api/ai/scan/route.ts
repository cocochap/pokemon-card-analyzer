/**
 * POST /api/ai/scan
 * Identifies a Pokémon card from an image, then returns market price + investment projections.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

// Focused prompt: identify only, no grading
const PROMPT = `You are a Pokémon TCG card identification expert. Look at this card image.

Return ONLY a raw JSON object (no markdown, no code fences, no explanation):
{
  "cardName": "exact Pokémon or Trainer name on the card",
  "setName": "full English set name (e.g. Base Set, Scarlet & Violet, Prismatic Evolutions)",
  "setId": "pokemontcg.io set ID best guess (e.g. base1, sv1, sv8pt5, swsh1)",
  "cardNumber": "number shown on card (e.g. 4, 025/165, SWSH092)",
  "rarity": "Common / Uncommon / Rare / Holo Rare / Ultra Rare / Secret Rare / Special Illustration Rare / Hyper Rare / Crown Rare",
  "variant": "NORMAL or HOLO or REVERSE_HOLO",
  "language": "EN or FR or JP or DE or ES",
  "isFirstEdition": false,
  "confidence": 90
}`

interface CardIdentification {
  cardName:       string
  setName:        string
  setId:          string
  cardNumber:     string
  rarity:         string
  variant:        string
  language:       string
  isFirstEdition: boolean
  confidence:     number
}

function extractJson(text: string): CardIdentification | null {
  const strategies = [
    () => { const m = text.match(/\{[\s\S]*\}/g); if (m) return JSON.parse(m[m.length - 1]); throw new Error('no match') },
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of strategies) {
    try {
      const p = fn()
      if (p && typeof p === 'object') return p as CardIdentification
    } catch { /* next */ }
  }
  return null
}

async function identifyCard(b64: string, mimeType: string): Promise<{ ok: boolean; data?: CardIdentification; error?: string }> {
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
            generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
          }),
        },
      )

      const json = await res.json()
      if (!res.ok) { console.warn(`[scan] ${model} HTTP ${res.status}`); continue }

      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const data = extractJson(text)
      if (data) { console.log(`[scan] identified with ${model}: ${data.cardName}`); return { ok: true, data } }
      console.warn(`[scan] ${model} JSON parse failed. Raw: ${text.slice(0, 100)}`)
    } catch (e: any) {
      console.warn(`[scan] ${model} exception: ${e?.message}`)
    }
  }
  return { ok: false, error: 'Could not identify card — try a clearer photo with better lighting' }
}

/** Estimate long-term value based on annual growth rate */
function project(currentPrice: number, annualGrowthPct: number, years: number): number {
  return Math.round(currentPrice * Math.pow(1 + annualGrowthPct / 100, years) * 100) / 100
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

    // Step 1: identify card
    const identified = await identifyCard(b64, mimeType)
    if (!identified.ok || !identified.data) {
      return NextResponse.json({ ok: false, error: identified.error }, { status: 422 })
    }
    const id = identified.data

    // Step 2: find card in DB with full market data
    const candidates = await prisma.card.findMany({
      where: {
        OR: [
          { name: { contains: id.cardName, mode: 'insensitive' } },
          { localeName: { path: ['fr'], string_contains: id.cardName } },
        ],
        ...(id.setId ? { set: { externalId: { contains: id.setId.replace(/\d+$/, ''), mode: 'insensitive' } } } : {}),
      },
      select: {
        id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
        set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
        prices:     { orderBy: { updatedAt: 'desc' }, take: 1, select: { market: true, low: true, high: true, currency: true } },
        marketData: {
          select: {
            investmentScore: true, rarityScore: true, liquidityScore: true,
            trendDirection: true, priceChange7d: true, priceChange30d: true,
            priceChange1y: true, allTimeHigh: true, volatility30d: true,
          },
        },
        aiAnalysis: {
          select: {
            investmentScore: true, predictedRoi30d: true, predictedRoi90d: true,
            trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true,
            predictions: {
              select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true, confidence: true },
              orderBy: { horizonDays: 'asc' },
            },
          },
        },
      },
      take: 5,
    })

    // Prefer exact number match
    let best = candidates[0] ?? null
    if (id.cardNumber && candidates.length > 1) {
      const num = id.cardNumber.replace(/^0+/, '')
      const exact = candidates.find(c => c.number === id.cardNumber || c.number === num)
      if (exact) best = exact
    }

    const price   = Number(best?.prices?.[0]?.market ?? 0)
    const md      = best?.marketData ?? null
    const ai      = best?.aiAnalysis ?? null

    // Step 3: build investment projections
    // Annual growth rate from AI analysis or market data
    const roi1y  = Number(md?.priceChange1y ?? 0)           // actual 1y change
    const roi90d = Number(ai?.predictedRoi90d ?? 0) * 4    // annualized from 90d
    const annualRate = roi1y !== 0 ? roi1y : roi90d !== 0 ? roi90d : 8 // 8% default

    const projections = price > 0 ? {
      y1:  { value: project(price, annualRate, 1),  rate: annualRate },
      y3:  { value: project(price, annualRate, 3),  rate: annualRate },
      y5:  { value: project(price, annualRate, 5),  rate: annualRate },
      y10: { value: project(price, annualRate, 10), rate: annualRate },
    } : null

    // AI 365d prediction from DB if available
    const pred365 = ai?.predictions?.find(p => p.horizonDays === 365)

    return NextResponse.json({
      ok: true,
      identification: id,
      dbMatch: best ? {
        id:       best.id,
        name:     best.name,
        number:   best.number,
        rarity:   best.rarity,
        imageUrl: best.imageLgUrl ?? best.imageSmUrl,
        set:      best.set,
        price: price > 0 ? {
          market:   price,
          low:      Number(best.prices[0].low    ?? 0),
          high:     Number(best.prices[0].high   ?? 0),
          currency: best.prices[0].currency,
        } : null,
        market: md ? {
          investmentScore: md.investmentScore ?? 0,
          rarityScore:     md.rarityScore     ?? 0,
          liquidityScore:  md.liquidityScore  ?? 0,
          trendDirection:  md.trendDirection,
          change7d:        Number(md.priceChange7d  ?? 0),
          change30d:       Number(md.priceChange30d ?? 0),
          change1y:        Number(md.priceChange1y  ?? 0),
          allTimeHigh:     Number(md.allTimeHigh    ?? 0),
          volatility:      Number(md.volatility30d  ?? 0),
        } : null,
        ai: ai ? {
          investmentScore: ai.investmentScore,
          trendDirection:  ai.trendDirection,
          bullishSignals:  ai.bullishSignals.slice(0, 3),
          bearishSignals:  ai.bearishSignals.slice(0, 2),
          keyInsight:      ai.keyInsight,
          pred1y:          pred365 ? { value: Number(pred365.predictedPrice), low: Number(pred365.lowerBound), high: Number(pred365.upperBound) } : null,
        } : null,
        projections,
        annualGrowthRate: annualRate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
