/**
 * POST /api/ai/scan
 * Accepts a card image, runs Gemini vision analysis, looks up real DB prices.
 *
 * Body: multipart/form-data with field "image" (File)
 * Requires: GEMINI_API_KEY env variable (from aistudio.google.com)
 */
import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const PROMPT = `You are an expert Pokémon TCG authentication and grading specialist with 20 years of experience.

Analyze this Pokémon card image carefully and return ONLY valid JSON (no markdown, no code fences, no explanation):
{
  "cardName": "exact Pokémon or Trainer name",
  "setName": "full English set name (e.g. Base Set, Scarlet & Violet)",
  "setId": "pokemontcg.io set ID (e.g. base1, sv1, swsh1, xy1) — best guess",
  "cardNumber": "number printed on card (e.g. 4, 025/165)",
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

async function analyzeWithGemini(imageBase64: string, mimeType: string): Promise<CardAnalysis> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        parts: [
          {
            inlineData: {
              data:     imageBase64,
              mimeType: mimeType,
            },
          },
          { text: PROMPT },
        ],
      },
    ],
  })

  const text  = response.text ?? ''
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
  return JSON.parse(clean) as CardAnalysis
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const form = await req.formData()
    const file = form.get('image') as File | null

    if (!file) {
      return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 })
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: 'Image too large (max 10MB)' }, { status: 400 })
    }

    const buffer   = await file.arrayBuffer()
    const base64   = Buffer.from(buffer).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const analysis = await analyzeWithGemini(base64, mimeType)

    // Find matching card in DB
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
        set: {
          select: { name: true, externalId: true, releaseDate: true, logoUrl: true },
        },
        prices: {
          orderBy: { updatedAt: 'desc' },
          take:    1,
          select:  { market: true, low: true, high: true, currency: true, source: true },
        },
        marketData: {
          select: {
            investmentScore: true,
            rarityScore:     true,
            trendDirection:  true,
            priceChange7d:   true,
            priceChange30d:  true,
            allTimeHigh:     true,
          },
        },
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
        price: p ? {
          market:   Number(p.market ?? 0),
          low:      Number(p.low    ?? 0),
          high:     Number(p.high   ?? 0),
          currency: p.currency,
          source:   p.source,
        } : null,
        market: md ? {
          investmentScore: md.investmentScore ?? 0,
          rarityScore:     md.rarityScore     ?? 0,
          trendDirection:  md.trendDirection,
          priceChange7d:   Number(md.priceChange7d  ?? 0),
          priceChange30d:  Number(md.priceChange30d ?? 0),
          allTimeHigh:     Number(md.allTimeHigh    ?? 0),
        } : null,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] error:', err)
    if (err instanceof SyntaxError) {
      return NextResponse.json({ ok: false, error: 'AI returned invalid JSON — try a clearer photo' }, { status: 422 })
    }
    return NextResponse.json({ ok: false, error: err.message ?? 'Scan failed' }, { status: 500 })
  }
}
