import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'
import { scoreCard, ScoringInput } from '@/lib/ai/scorer'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // Sert le cache DB en priorité (mis à jour par un cron)
  const cached = await withCache(`ai:analysis:${id}`, 300, async () => {
    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        set: { select: { releaseDate: true } },
        aiAnalysis: { include: { predictions: { orderBy: { horizonDays: 'asc' } } } },
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
      },
    })
    if (!card) return null

    // Si une analyse récente existe en base, la servir directement
    if (card.aiAnalysis?.updatedAt && card.aiAnalysis.updatedAt > subDays(new Date(), 1)) {
      return {
        ...card.aiAnalysis,
        currentPrice: Number(card.prices[0]?.market ?? 0),
        modelVersion: card.aiAnalysis.modelVersion,
        updatedAt: card.aiAnalysis.updatedAt,
      }
    }

    // Sinon : calcule en temps réel
    return computeAnalysis(card)
  })

  if (!cached) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  return NextResponse.json(cached)
}

async function computeAnalysis(card: any) {
  // Récupère l'historique de prix
  const history = await prisma.priceHistory.findMany({
    where: { cardId: card.id, source: 'cardmarket', recordedAt: { gte: subDays(new Date(), 90) } },
    orderBy: { recordedAt: 'asc' },
    select: { price: true, recordedAt: true },
  })

  const prices = history.map((h) => Number(h.price))
  const currentPrice = prices.at(-1) ?? Number(card.prices[0]?.market ?? 0)

  const pct = (days: number) => {
    if (prices.length < days + 1) return 0
    const past = prices[prices.length - days - 1]
    return ((currentPrice - past) / (past + 1e-8)) * 100
  }

  // Volatilité 30j
  const returns30 = prices.slice(-30).map((p, i, a) => i === 0 ? 0 : (p - a[i - 1]) / (a[i - 1] + 1e-8))
  const vol30 = returns30.length > 1
    ? Math.sqrt(returns30.reduce((s, r) => s + r * r, 0) / returns30.length) * Math.sqrt(365)
    : 0.5

  // RSI
  const rsi = computeRSI(prices)

  // Population PSA
  const psaPop = await prisma.psaPopulation.findFirst({
    where: { cardId: card.id, company: 'PSA', grade: 10 },
    select: { population: true },
  })

  const setAgeDays = card.set?.releaseDate
    ? Math.floor((Date.now() - new Date(card.set.releaseDate).getTime()) / 86400000)
    : 365

  const rarityMap: Record<string, number> = {
    CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9, ILLUSTRATION_RARE: 8,
    RARE_SECRET: 8, RARE_RAINBOW: 7, RARE_ULTRA: 7, RARE_HOLO_VSTAR: 6, RARE_HOLO_VMAX: 6,
    RARE_HOLO_V: 5, RARE_HOLO: 5, RARE: 4, UNCOMMON: 3, COMMON: 2,
  }

  const inp: ScoringInput = {
    priceChange7d: pct(7),
    priceChange30d: pct(30),
    priceChange90d: pct(90),
    volatility30d: vol30,
    rsi14: rsi,
    volume7d: 0,
    volumeAvg90d: 0,
    rarityRank: rarityMap[card.rarity] ?? 3,
    populationPsa10: psaPop?.population ?? 999,
    setAgeDays,
    isVintage: setAgeDays > 7300,
    isFirstEdition: card.variant === 'FIRST_EDITION',
    isShadowless: card.variant === 'SHADOWLESS',
    isPromo: card.variant === 'PROMO',
    pokemonPopularity: 50,
    watchlistGrowth7d: 0,
    socialMentions7d: 0,
    ebayCount30d: 0,
    listingsCount: 10,
  }

  const result = scoreCard(inp)

  // Prédictions simples basées sur la tendance
  const predictions = [7, 30, 90].map((days) => {
    const decay = days === 7 ? 0.9 : days === 30 ? 0.7 : 0.5
    const roi = result.predictedRoi30d * decay * (days / 30)
    const predicted = currentPrice * (1 + roi)
    const uncertainty = currentPrice * (0.05 + vol30 * 0.05 * (days / 30))
    return {
      horizonDays: days,
      predictedPrice: Math.max(0.01, +predicted.toFixed(2)),
      lowerBound: Math.max(0.01, +(predicted - uncertainty).toFixed(2)),
      upperBound: +(predicted + uncertainty).toFixed(2),
      confidence: +Math.max(0.3, Math.min(0.9, 1 - vol30 * 0.3 - days / 500)).toFixed(4),
    }
  })

  const confidence = predictions.reduce((s, p) => s + p.confidence, 0) / predictions.length

  return {
    cardId: card.id,
    investmentScore: result.investmentScore,
    rarityScore: result.rarityScore,
    liquidityScore: result.liquidityScore,
    riskLevel: result.riskLevel,
    trendDirection: result.trendDirection,
    confidenceScore: +confidence.toFixed(4),
    bullishSignals: result.bullishSignals,
    bearishSignals: result.bearishSignals,
    keyInsight: result.keyInsight,
    predictedRoi30d: result.predictedRoi30d,
    predictedRoi90d: result.predictedRoi90d,
    predictions,
    currentPrice,
    modelVersion: 'scorer-ts-v1',
    updatedAt: new Date().toISOString(),
  }
}

function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  const changes = prices.slice(1).map((p, i) => p - prices[i])
  const gains = changes.map((c) => Math.max(0, c))
  const losses = changes.map((c) => Math.max(0, -c))
  const avgGain = gains.slice(-period).reduce((s, v) => s + v, 0) / period
  const avgLoss = losses.slice(-period).reduce((s, v) => s + v, 0) / period
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}
