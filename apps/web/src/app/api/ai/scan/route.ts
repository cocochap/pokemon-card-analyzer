/**
 * POST /api/ai/scan
 * Tries multiple Gemini models in order until one works.
 * No SDK dependency — direct REST calls.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

// Models to try in order (first available wins)
const MODELS_TO_TRY = [
  { model: 'gemini-2.5-flash',      api: 'v1beta' }, // ✅ free tier confirmed
  { model: 'gemini-flash-latest',   api: 'v1beta' }, // ✅ free tier fallback
  { model: 'gemini-2.5-flash-lite', api: 'v1beta' }, // ✅ free tier fallback
]

const PROMPT = `You are an expert Pokémon TCG authentication and grading specialist.

Analyze this Pokémon card image and return ONLY valid JSON (no markdown, no code fences):
{
  "cardName": "exact Pokémon or Trainer name",
  "setName": "full English set name",
  "setId": "pokemontcg.io set ID (e.g. base1, sv1, swsh1)",
  "cardNumber": "number on card",
  "rarity": "Common / Uncommon / Rare / Holo Rare / Ultra Rare / Secret Rare",
  "variant": "NORMAL or HOLO or REVERSE_HOLO or FIRST_EDITION",
  "condition": "Mint / Near Mint / Excellent / Good / Light Played / Played / Poor",
  "conditionDetails": {
    "centering": "Centered / Slightly Off / Off",
    "surface": "Clean / Minor Scratches / Heavy Scratches",
    "corners": "Sharp / Minor Wear / Heavy Wear",
    "edges": "Clean / Minor Wear / Heavy Wear"
  },
  "estimatedPsaGrade": 9,
  "psaGradeRationale": "1-sentence explanation",
  "confidence": 92,
  "isFirstEdition": false,
  "isShadowless": false,
  "language": "EN or FR or JP or DE",
  "notes": "any notable observations"
}`

interface CardAnalysis {
  cardName:          string
  setName:           string
  setId:             string
  cardNumber:        string
  rarity:            string
  variant:           string
  condition:         string
  conditionDetails?: { centering: string; surface: string; corners: string; edges: string }
  estimatedPsaGrade: number
  psaGradeRationale: string
  confidence:        number
  isFirstEdition:    boolean
  isShadowless:      boolean
  language:          string
  notes:             string
}

async function callGemini(
  imageBase64: string,
  mimeType: string,
  model: string,
  api: string,
): Promise<{ ok: boolean; data?: CardAnalysis; error?: string; status?: number }> {
  const url = `https://generativelanguage.googleapis.com/${api}/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`

  // gemini-pro-vision uses a different parts format
  const imagePart = model === 'gemini-pro-vision'
    ? { inline_data: { mime_type: mimeType, data: imageBase64 } }
    : { inline_data: { mime_type: mimeType, data: imageBase64 } }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [imagePart, { text: PROMPT }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    return { ok: false, error: err?.error?.message ?? `HTTP ${res.status}`, status: res.status }
  }

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

  if (!clean) return { ok: false, error: 'Empty response' }

  try {
    return { ok: true, data: JSON.parse(clean) as CardAnalysis }
  } catch {
    return { ok: false, error: 'Invalid JSON from model' }
  }
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

    const buffer   = await file.arrayBuffer()
    const base64   = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    // Try models in sequence until one works
    let analysis: CardAnalysis | null = null
    const errors: string[] = []

    for (const { model, api } of MODELS_TO_TRY) {
      const result = await callGemini(base64, mimeType, model, api)
      if (result.ok && result.data) {
        analysis = result.data
        console.log(`[scan] success with ${model} (${api})`)
        break
      }
      errors.push(`${model}: ${result.error}`)
      console.warn(`[scan] ${model} failed: ${result.error}`)
      // Don't retry on 404 (model doesn't exist), skip immediately
      // On 429 (quota), try next model
    }

    if (!analysis) {
      return NextResponse.json({
        ok: false,
        error: 'All Gemini models failed. Enable billing at console.cloud.google.com or check your API key.',
        details: errors,
      }, { status: 503 })
    }

    // Look up card in DB
    const candidates = await prisma.card.findMany({
      where: {
        OR: [
          { name: { contains: analysis.cardName, mode: 'insensitive' } },
          { localeName: { path: ['fr'], string_contains: analysis.cardName } },
        ],
        ...(analysis.setId
          ? { set: { externalId: { contains: analysis.setId.replace(/\d+$/, ''), mode: 'insensitive' } } }
          : {}),
      },
      select: {
        id:         true,
        name:       true,
        number:     true,
        rarity:     true,
        imageSmUrl: true,
        imageLgUrl: true,
        set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
        prices:     { orderBy: { updatedAt: 'desc' }, take: 1, select: { market: true, low: true, high: true, currency: true, source: true } },
        marketData: { select: { investmentScore: true, rarityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, allTimeHigh: true } },
      },
      take: 5,
    })

    let best = candidates[0] ?? null
    if (analysis.cardNumber && candidates.length > 1) {
      const num   = analysis.cardNumber.replace(/^0+/, '')
      const exact = candidates.find(c => c.number === analysis.cardNumber || c.number === num)
      if (exact) best = exact
    }

    const p  = best?.prices?.[0] ?? null
    const md = best?.marketData   ?? null

    return NextResponse.json({
      ok: true,
      analysis,
      dbMatch: best ? {
        id:       best.id,
        name:     best.name,
        number:   best.number,
        rarity:   best.rarity,
        imageUrl: best.imageLgUrl ?? best.imageSmUrl,
        set:      best.set,
        price:    p  ? { market: Number(p.market ?? 0), low: Number(p.low ?? 0), high: Number(p.high ?? 0), currency: p.currency, source: p.source } : null,
        market:   md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, trendDirection: md.trendDirection, priceChange7d: Number(md.priceChange7d ?? 0), priceChange30d: Number(md.priceChange30d ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0) } : null,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] error:', err?.message)
    if (err instanceof SyntaxError) return NextResponse.json({ ok: false, error: 'Invalid JSON — try a clearer photo' }, { status: 422 })
    return NextResponse.json({ ok: false, error: err.message ?? 'Scan failed' }, { status: 500 })
  }
}
