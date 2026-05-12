/**
 * POST /api/ai/scan
 *
 * Flow:
 * 1. Gemini reads card name + number from image
 * 2. Multi-strategy DB search (we have all pokemontcg.io sets)
 * 3. pokemontcg.io API as fallback if DB search fails
 * 4. Return price + investment projections
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

const PROMPT = `You are a Pokémon TCG expert fluent in all languages.

Look at this card carefully and extract:

Return ONLY raw JSON (no markdown):
{
  "cardName": "exact name as printed on the card",
  "englishName": "English name (translate if needed — Dracaufeu→Charizard, Évoli→Eevee, Ronflex→Snorlax)",
  "cardNumber": "FULL number as printed including prefix, e.g: 4, 4/102, SV107/SV122, SWSH092, TG01/TG30",
  "setId": "pokemontcg.io set ID if you recognize it (e.g. base1, sv1, pgo, swsh45sv, swsh3), else empty",
  "setName": "set name if visible, else empty",
  "language": "EN or FR or JP or DE or ES",
  "confidence": 90
}

IMPORTANT for cardNumber: copy it EXACTLY as printed. If it says SV107/SV122, write SV107/SV122. Never strip letters.`

interface AiHint {
  cardName:    string
  englishName: string
  cardNumber:  string
  setId:       string
  setName:     string
  language:    string
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
            generationConfig: { temperature: 0.0, maxOutputTokens: 256 },
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) continue
      const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const hint = extractJson(text)
      if (hint?.cardName) {
        console.log(`[scan] AI: "${hint.cardName}" #${hint.cardNumber} set=${hint.setId}`)
        return hint
      }
    } catch (e: any) { console.warn(`[scan] ${model}:`, e?.message) }
  }
  return null
}

const DB_SELECT = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
  prices:     { orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true } },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}

type DbCard = Awaited<ReturnType<typeof prisma.card.findUnique>> & Record<string, any>

function scoreCard(card: any, hint: AiHint): number {
  let score = 0

  // Extract number parts — keep full prefix (SV107, SWSH092, TG01, etc.)
  const hintNumFull  = hint.cardNumber.split('/')[0].trim()           // "SV107"
  const hintNumDigit = hintNumFull.replace(/^[A-Z]+/, '')             // "107" (digits only)
  const hintNumClean = hintNumFull.replace(/^0+(?=[0-9])/, '')        // strip leading zeros

  const cardNumFull  = card.number.split('/')[0].trim()
  const cardNumDigit = cardNumFull.replace(/^[A-Z]+/, '')
  const cardNumClean = cardNumFull.replace(/^0+(?=[0-9])/, '')

  // Number match — full prefix must match if present
  if (cardNumFull === hintNumFull) score += 20                        // SV107 === SV107
  else if (cardNumClean === hintNumClean && hintNumFull.match(/^[A-Z]/)) score += 5  // digits only, prefix present
  else if (cardNumClean === hintNumClean) score += 15                 // 4 === 4 (no prefix)
  else if (cardNumDigit === hintNumDigit && hintNumDigit.length > 0) score += 3   // coincidental digit match

  // English name match (required to avoid false positives)
  const enName = (hint.englishName || hint.cardName).toLowerCase()
  if (card.name.toLowerCase() === enName) score += 20               // exact match
  else if (card.name.toLowerCase().startsWith(enName.split(' ')[0])) score += 8 // same Pokémon
  else if (enName.startsWith(card.name.toLowerCase().split(' ')[0])) score += 5

  // Set match
  if (hint.setId && card.set.externalId === hint.setId) score += 10
  else if (hint.setId && card.set.externalId.startsWith(hint.setId.replace(/\d+$/, ''))) score += 5

  // Set name match
  if (hint.setName && card.set.name.toLowerCase().includes(hint.setName.toLowerCase().slice(0, 10))) score += 3

  // Prefer cards with prices
  if (card.prices?.length > 0 && Number(card.prices[0].market) > 0) score += 2

  return score
}

async function findInDb(hint: AiHint): Promise<any | null> {
  // Use English name first (more reliable in DB), fall back to card name
  const name     = (hint.englishName || hint.cardName).trim()
  const altName  = hint.englishName ? hint.cardName.trim() : ''
  const numFull  = hint.cardNumber.split('/')[0].trim()   // "SV107" — keep prefix
  const numClean = numFull.replace(/^0+(?=[0-9])/, '')    // strip leading zeros only

  // Strategy 1: exact externalId (setId-number)
  if (hint.setId && numFull) {
    for (const extId of [
      `${hint.setId}-${numFull}`,
      `${hint.setId}-${numClean}`,
      `${hint.setId}-0${numClean}`,
    ]) {
      const r = await prisma.card.findUnique({ where: { externalId: extId }, select: DB_SELECT })
      if (r) { console.log(`[scan] DB hit: externalId=${extId}`); return r }
    }
  }

  // Strategy 2: exact name + number + set
  if (hint.setId) {
    const r = await prisma.card.findFirst({
      where: {
        name: { equals: name, mode: 'insensitive' },
        set:  { externalId: hint.setId },
      },
      select: DB_SELECT,
    })
    if (r) { console.log(`[scan] DB hit: exact name+set`); return r }
  }

  // Strategy 3: search by English name (primary) + French name via ILIKE
  const searchNames = [name, altName].filter(Boolean)
  const allCandidates: Map<string, any> = new Map()

  for (const searchName of searchNames) {
    // English DB name search
    const byEn = await prisma.card.findMany({
      where: { name: { contains: searchName, mode: 'insensitive' } },
      select: DB_SELECT,
      take: 20,
    })
    byEn.forEach(c => allCandidates.set(c.id, c))

    // French name via raw SQL ILIKE (accent + case insensitive)
    const frIds = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Card" WHERE "localeName"->>'fr' ILIKE ${`%${searchName}%`} LIMIT 15
    `
    if (frIds.length > 0) {
      const byFr = await prisma.card.findMany({
        where: { id: { in: frIds.map(r => r.id) } }, select: DB_SELECT,
      })
      byFr.forEach(c => allCandidates.set(c.id, c))
    }
  }

  const candidates = Array.from(allCandidates.values())

  if (candidates.length === 0) {
    // Strategy 4: first word of each name (Charizard from "Charizard VMAX", Dracaufeu from "Dracaufeu VMAX")
    const firstWords = [...new Set(searchNames.map(n => n.split(' ')[0]).filter(w => w.length >= 3))]
    for (const word of firstWords) {
      const byFirst = await prisma.card.findMany({
        where: { name: { startsWith: word, mode: 'insensitive' } },
        select: DB_SELECT, take: 20,
      })
      byFirst.forEach(c => allCandidates.set(c.id, c))

      const frFirstIds = await prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM "Card" WHERE "localeName"->>'fr' ILIKE ${`${word}%`} LIMIT 15
      `
      if (frFirstIds.length > 0) {
        const byFrFirst = await prisma.card.findMany({
          where: { id: { in: frFirstIds.map(r => r.id) } }, select: DB_SELECT,
        })
        byFrFirst.forEach(c => allCandidates.set(c.id, c))
      }
    }
    candidates.push(...Array.from(allCandidates.values()))
  }

  if (candidates.length === 0) return null

  // Score and pick best
  const scored = candidates.map(c => ({ c, score: scoreCard(c, hint) }))
  scored.sort((a, b) => b.score - a.score)

  const best = scored[0]
  // Reject if score too low — prevents returning completely wrong cards
  if (best.score < 8) {
    console.log(`[scan] best score too low (${best.score}) for "${best.c.name}" — rejecting`)
    return null
  }
  console.log(`[scan] DB scored match: "${best.c.name}" #${best.c.number} set=${best.c.set.externalId} score=${best.score}`)
  return best.c
}

// pokemontcg.io API as last resort
async function findViaPtcgApi(hint: AiHint): Promise<any | null> {
  try {
    const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY
      ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}

    const num = hint.cardNumber.split('/')[0].trim()
    const queries = [
      hint.setId ? `name:"${hint.cardName}" number:"${num}" set.id:${hint.setId}` : null,
      hint.setId ? `name:"${hint.cardName}" set.id:${hint.setId}` : null,
      `name:"${hint.cardName}" number:"${num}"`,
      `name:"${hint.cardName}"`,
    ].filter(Boolean) as string[]

    for (const q of queries) {
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`,
        { headers, signal: AbortSignal.timeout(5000) },
      )
      if (!res.ok) continue
      const d = await res.json()
      if (!d.data?.length) continue

      const ptcgCard = d.data[0]
      console.log(`[scan] ptcg.io found: ${ptcgCard.id}`)

      // Look up in our DB by externalId
      const dbCard = await prisma.card.findUnique({ where: { externalId: ptcgCard.id }, select: DB_SELECT })
      if (dbCard) return dbCard

      // Try to auto-import the set
      console.log(`[scan] ${ptcgCard.id} not in DB, triggering set import...`)
      break
    }
  } catch (e: any) { console.warn('[scan] ptcg.io API:', e?.message) }
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
    const hint = await aiIdentify(b64, mimeType)
    if (!hint?.cardName) {
      return NextResponse.json({ ok: false, error: 'Carte non reconnue — essaie avec une photo plus nette' }, { status: 422 })
    }

    // Step 2: DB search (primary — we have all sets)
    let best = await findInDb(hint)

    // Step 3: pokemontcg.io API fallback (if DB search fails)
    if (!best) {
      console.log('[scan] DB search failed, trying pokemontcg.io API...')
      best = await findViaPtcgApi(hint)
    }

    // Step 4: if still not found, auto-import the set and retry
    if (!best && hint.setId) {
      try {
        const origin = new URL(req.url).origin
        await fetch(`${origin}/api/admin/sync-sets?setId=${hint.setId}&limit=1`, {
          method: 'POST', signal: AbortSignal.timeout(40000),
        })
        best = await findInDb(hint)
      } catch { /* ignore */ }
    }

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
      identification: hint,
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
