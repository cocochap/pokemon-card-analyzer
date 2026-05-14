import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

const PROMPT = `You are an expert in Pokémon TCG sealed products (booster boxes, Elite Trainer Boxes, collections, tins, coffrets, etc.).

Look at this image and identify the Pokémon TCG sealed product.

Return ONLY this JSON (no markdown, no explanation):
{
  "productName": "Full name of the product as it appears on the packaging (in the language of the packaging)",
  "productNameFr": "French name of the product (translate if needed)",
  "type": "BOOSTER_BOX | ETB | COFFRET | COLLECTION | TIN | BUNDLE | BLISTER",
  "setName": "The Pokémon set name (e.g. 151, Couronne Zénith, Astres Radieux, Évolutions Prismatiques)",
  "series": "The series (e.g. Écarlate & Violet, Épée & Bouclier, XY, Base Set)",
  "language": "FR | EN | JP | DE | IT | ES",
  "confidence": 0.95
}

If you cannot identify the product, return: {"error": "not_identified"}`

interface AiResult {
  productName: string
  productNameFr: string
  type: string
  setName: string | null
  series: string | null
  language: string
  confidence: number
  error?: string
}

function extractJson(text: string): AiResult | null {
  const tries = [
    () => { const m = text.match(/\{[\s\S]*\}/g); if (m) return JSON.parse(m[m.length - 1]); throw 0 },
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of tries) {
    try {
      const p = fn()
      if (p?.productName || p?.error) return p as AiResult
    } catch { /* next */ }
  }
  return null
}

async function runVision(b64: string, mimeType: string): Promise<AiResult | null> {
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
      const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const result = extractJson(raw)
      if (result && !result.error) {
        console.log(`[sealed-scan] AI(${model}): "${result.productName}" type=${result.type}`)
        return result
      }
    } catch (e: any) { console.warn(`[sealed-scan] ${model}: ${e?.message}`) }
  }
  return null
}

// ── Inline identify logic (mirrors /api/sealed/identify) ─────────────────────
function makeSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

function estimateRetail(type: string, series: string | null): number {
  if (type === 'BOOSTER_BOX') { if (series === 'Base Set' || series === 'Neo') return 90; if (series === 'XY') return 100; return 140 }
  if (type === 'ETB') return 55
  if (type === 'COFFRET' || type === 'COLLECTION') return 35
  if (type === 'TIN') return 22
  if (type === 'BUNDLE') return 25
  if (type === 'BLISTER') return 15
  return 30
}

const S_TIER_NAMES = ['dracaufeu','charizard','pikachu','mewtwo','mew','evoli','eevee','lucario','ronflex','snorlax','lugia','ho-oh','rayquaza','arceus','umbreon','noctali','ectoplasma','gengar']
const A_TIER_NAMES = ['alakazam','dracolosse','dragonite','gyarados','sylveon','salamèche','charmander','bulbizarre','carapuce','celebi','darkrai','giratina','regieleki','regidrago']

function detectCharacterTier(name: string): 'S' | 'A' | 'B' {
  const n = name.toLowerCase()
  if (S_TIER_NAMES.some(c => n.includes(c))) return 'S'
  if (A_TIER_NAMES.some(c => n.includes(c))) return 'A'
  return 'B'
}

function buildQuickAnalysis(params: { type: string; series: string | null; language: string; charTier: 'S' | 'A' | 'B'; retailPrice: number; name: string }) {
  const { type, series, charTier, retailPrice, name } = params
  const n = name.toLowerCase()
  const isVintage = series === 'Base Set' || series === 'Neo'
  const isSV = series === 'Écarlate & Violet'
  const isSWSH = series === 'Épée & Bouclier' || series === 'Célébrations'
  const isXY = series === 'XY'
  const isDiscontinued = isVintage || isXY || (isSWSH && !n.includes('épée'))

  let score = 55
  if (isVintage) score = 90
  else if (isXY && n.includes('évolutions')) score = 92
  else if (isSWSH && isDiscontinued) score = 76
  else if (isSWSH) score = 68
  else if (isSV && isDiscontinued) score = 72
  else if (isSV) score = 62
  if (charTier === 'S') score = Math.min(100, score + 12)
  else if (charTier === 'A') score = Math.min(100, score + 6)
  if (isDiscontinued) score = Math.min(100, score + 7)
  if (type === 'BOOSTER_BOX') score = Math.min(100, score + 4)

  let mult = 1.05
  if (isVintage) mult = 5 + Math.random() * 3
  else if (isXY && n.includes('évolutions')) mult = 3.8
  else if (isSWSH && isDiscontinued && charTier === 'S') mult = 1.5
  else if (isSWSH && isDiscontinued) mult = 1.3
  else if (isSV && isDiscontinued) mult = 1.2

  const marketPrice = Math.round(retailPrice * mult)
  const horizon = isVintage ? '5-10 ans' : isXY ? '2-5 ans' : isSWSH && isDiscontinued ? '1-3 ans' : '2-4 ans'
  const riskLevel = isVintage ? 'Faible' : score >= 80 ? 'Faible' : 'Modéré'

  const bullish: string[] = []
  if (isDiscontinued) bullish.push('Discontinué — supply définitivement figé')
  if (charTier === 'S') bullish.push('Personnage Tier S — demande mondiale permanente')
  if (isVintage) bullish.push('Vintage — usure naturelle réduit le stock qualité chaque année')
  if (type === 'BOOSTER_BOX') bullish.push('Display complet — meilleur format pour l\'investissement scellé')
  bullish.push('Marché TCG Pokémon en institutionnalisation continue')

  const bearish: string[] = []
  if (!isDiscontinued) bearish.push('Encore disponible au retail — premium limité à court terme')
  bearish.push('Risque de correction générale du marché TCG')

  const narrative = isVintage
    ? `Coffret vintage de la génération ${series}. Les scellés de cette époque sont extrêmement rares — la quasi-totalité a été ouverte. Actif de collection premium à horizon long terme.`
    : charTier === 'S' && isDiscontinued
    ? `Coffret discontinued mettant en vedette un personnage Tier S. Le stock est figé face à une demande permanente — trajectoire haussière structurelle.`
    : `Coffret ${isDiscontinued ? 'discontinued' : 'disponible'} de la génération ${series ?? 'Pokémon TCG'}. ${isDiscontinued ? 'Premium en hausse progressive.' : 'À accumuler au retail avant la discontinuation.'}`

  return {
    investmentScore: score,
    scarcityScore: isVintage ? 92 : isDiscontinued ? 72 : 45,
    popularityScore: charTier === 'S' ? 90 : charTier === 'A' ? 75 : 58,
    trendDirection: score >= 78 ? 'BULLISH' : 'STABLE',
    riskLevel, horizon, isDiscontinued,
    bullish: bullish.slice(0, 4), bearish: bearish.slice(0, 2),
    narrative, marketPrice,
    target1y: Math.round(marketPrice * (isVintage ? 1.4 : isDiscontinued ? 1.25 : 1.08)),
    target3y: Math.round(marketPrice * (isVintage ? 2.5 : isDiscontinued ? 1.75 : 1.4)),
  }
}

export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY non configuré' }, { status: 500 })
  }

  const form = await req.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ ok: false, error: 'Aucune image fournie' }, { status: 400 })
  if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image trop grande (max 10 Mo)' }, { status: 400 })

  const b64  = Buffer.from(await file.arrayBuffer()).toString('base64')
  const mime = file.type || 'image/jpeg'

  // 1. Vision AI
  const vision = await runVision(b64, mime)
  if (!vision) {
    return NextResponse.json({ ok: false, error: 'Coffret non reconnu — essaie avec une photo plus nette' }, { status: 422 })
  }

  const identifiedName = vision.productNameFr ?? vision.productName

  // 2. Search in DB
  const existing = await prisma.sealedProduct.findFirst({
    where: {
      OR: [
        { name:   { contains: identifiedName, mode: 'insensitive' } },
        { nameFr: { contains: identifiedName, mode: 'insensitive' } },
      ],
    },
    include: {
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 1, select: { price: true } },
    },
  })

  if (existing) {
    return NextResponse.json({
      ok: true, inDb: true, slug: existing.slug,
      identification: { name: identifiedName, type: vision.type, confidence: vision.confidence },
      product: { ...existing, currentMarketPrice: existing.priceHistory[0]?.price ?? existing.retailPrice },
    })
  }

  // 3. Generate analysis
  const retailPrice = estimateRetail(vision.type, vision.series)
  const charTier = detectCharacterTier(identifiedName)
  const analysis = buildQuickAnalysis({
    type: vision.type, series: vision.series, language: vision.language,
    charTier, retailPrice, name: identifiedName,
  })

  const slug = makeSlug(identifiedName)

  return NextResponse.json({
    ok: true, inDb: false, slug,
    identification: { name: identifiedName, type: vision.type, confidence: vision.confidence },
    product: {
      id: null, slug,
      name: identifiedName, nameFr: vision.productNameFr ?? identifiedName,
      type: vision.type, setName: vision.setName, series: vision.series,
      language: vision.language, retailPrice,
      currentMarketPrice: analysis.marketPrice,
      isDiscontinued: analysis.isDiscontinued,
      investmentScore: analysis.investmentScore,
      scarcityScore: analysis.scarcityScore,
      popularityScore: analysis.popularityScore,
      trendDirection: analysis.trendDirection,
      riskLevel: analysis.riskLevel,
      horizon: analysis.horizon,
      bullish: analysis.bullish,
      bearish: analysis.bearish,
      narrative: analysis.narrative,
      target1y: analysis.target1y,
      target3y: analysis.target3y,
      description: null, imageUrl: null,
    },
  })
}
