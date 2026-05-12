/**
 * POST /api/ai/scan
 * Gemini vision via direct REST API (no SDK).
 * Body: multipart/form-data with field "image" (File)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const MODELS_TO_TRY = [
  'gemini-2.5-flash',
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
]
const API = 'v1beta'

const PROMPT = `You are an expert Pokémon TCG grading specialist. Analyze this card image.

Return ONLY a raw JSON object — no markdown, no code fences, no explanation, just the JSON:
{"cardName":"Charizard","setName":"Base Set","setId":"base1","cardNumber":"4","rarity":"Holo Rare","variant":"HOLO","condition":"Near Mint","conditionDetails":{"centering":"Centered","surface":"Clean","corners":"Sharp","edges":"Clean"},"estimatedPsaGrade":9,"psaGradeRationale":"Near mint condition with sharp corners","confidence":92,"isFirstEdition":false,"isShadowless":false,"language":"EN","notes":""}`

interface CardAnalysis {
  cardName: string; setName: string; setId: string; cardNumber: string
  rarity: string; variant: string; condition: string
  conditionDetails?: { centering: string; surface: string; corners: string; edges: string }
  estimatedPsaGrade: number; psaGradeRationale: string; confidence: number
  isFirstEdition: boolean; isShadowless: boolean; language: string; notes: string
}

function extractJson(text: string): CardAnalysis | null {
  // gemini-2.5-flash can include thinking tokens — always try regex first
  const strategies = [
    // 1. Extract last { ... } block (thinking models put JSON at end)
    () => { const m = text.match(/\{[\s\S]*\}/g); if (m) return JSON.parse(m[m.length - 1]); throw new Error('no match') },
    // 2. Strip markdown fences then parse
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    // 3. Direct parse
    () => JSON.parse(text.trim()),
  ]

  for (const fn of strategies) {
    try {
      const parsed = fn()
      if (parsed && typeof parsed === 'object') return parsed as CardAnalysis
    } catch { /* try next */ }
  }
  return null
}

async function callGemini(b64: string, mimeType: string, model: string): Promise<{ ok: boolean; data?: CardAnalysis; rawText?: string; error?: string }> {
  try {
    const url = `https://generativelanguage.googleapis.com/${API}/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [
          { inline_data: { mime_type: mimeType, data: b64 } },
          { text: PROMPT },
        ]}],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
      }),
    })

    const json = await res.json()

    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}: ${json?.error?.message?.slice(0, 120) ?? 'unknown'}` }
    }

    const rawText: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    if (!rawText) return { ok: false, error: 'Empty response from model', rawText }

    const data = extractJson(rawText)
    if (!data) return { ok: false, error: `JSON parse failed. Raw: ${rawText.slice(0, 200)}`, rawText }

    return { ok: true, data, rawText }
  } catch (e: any) {
    return { ok: false, error: `Exception: ${e?.message?.slice(0, 120)}` }
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

    let analysis: CardAnalysis | null = null
    const errors: string[] = []

    for (const model of MODELS_TO_TRY) {
      const result = await callGemini(base64, mimeType, model)
      console.log(`[scan] ${model}: ok=${result.ok} error=${result.error ?? '-'}`)
      if (result.ok && result.data) { analysis = result.data; break }
      errors.push(`${model}: ${result.error}`)
    }

    if (!analysis) {
      return NextResponse.json({ ok: false, error: 'Scan failed', details: errors }, { status: 503 })
    }

    // DB lookup
    const candidates = await prisma.card.findMany({
      where: {
        OR: [
          { name: { contains: analysis.cardName, mode: 'insensitive' } },
          { localeName: { path: ['fr'], string_contains: analysis.cardName } },
        ],
        ...(analysis.setId ? { set: { externalId: { contains: analysis.setId.replace(/\d+$/, ''), mode: 'insensitive' } } } : {}),
      },
      select: {
        id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
        set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
        prices:     { orderBy: { updatedAt: 'desc' }, take: 1, select: { market: true, low: true, high: true, currency: true, source: true } },
        marketData: { select: { investmentScore: true, rarityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, allTimeHigh: true } },
      },
      take: 5,
    })

    let best = candidates[0] ?? null
    if (analysis.cardNumber && candidates.length > 1) {
      const num = analysis.cardNumber.replace(/^0+/, '')
      const exact = candidates.find(c => c.number === analysis.cardNumber || c.number === num)
      if (exact) best = exact
    }

    const p  = best?.prices?.[0] ?? null
    const md = best?.marketData   ?? null

    return NextResponse.json({
      ok: true, analysis,
      dbMatch: best ? {
        id: best.id, name: best.name, number: best.number, rarity: best.rarity,
        imageUrl: best.imageLgUrl ?? best.imageSmUrl,
        set: best.set,
        price:  p  ? { market: Number(p.market ?? 0), low: Number(p.low ?? 0), high: Number(p.high ?? 0), currency: p.currency, source: p.source } : null,
        market: md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, trendDirection: md.trendDirection, priceChange7d: Number(md.priceChange7d ?? 0), priceChange30d: Number(md.priceChange30d ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0) } : null,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
