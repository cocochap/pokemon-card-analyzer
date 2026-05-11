/**
 * Prix normalisés depuis les données Cardmarket réelles.
 *
 * pokemontcg.io fournit gratuitement :
 *   avg1  = moyenne des ventes sur 1 jour  (≈ prix d'hier)
 *   avg7  = moyenne des ventes sur 7 jours  (tendance semaine)
 *   avg30 = moyenne des ventes sur 30 jours (tendance mois)
 *   trendPrice = prix de tendance actuel (smoothed)
 *   averageSellPrice = dernier prix de vente moyen
 *   lowPriceExPlus = prix bas (condition Ex+)
 *
 * Ces données permettent des vraies variations % et un historique réaliste.
 */

export interface CardmarketPrices {
  trendPrice?: number
  averageSellPrice?: number
  lowPrice?: number
  lowPriceExPlus?: number
  avg1?: number
  avg7?: number
  avg30?: number
  reverseHoloTrend?: number
  reverseHoloAvg1?: number
  reverseHoloAvg7?: number
  reverseHoloAvg30?: number
  reverseHoloSell?: number
  reverseHoloLow?: number
}

export interface TcgplayerPrices {
  normal?: { low?: number; mid?: number; high?: number; market?: number }
  holofoil?: { low?: number; mid?: number; high?: number; market?: number }
  reverseHolofoil?: { low?: number; mid?: number; high?: number; market?: number }
}

export interface NormalizedPrice {
  // Cardmarket EUR
  market: number   // trendPrice (meilleur indicateur du prix actuel)
  mid: number      // averageSellPrice
  low: number      // lowPriceExPlus
  high: number     // estimé : market + (market - low)
  // Moyennes temporelles RÉELLES
  avg1: number     // hier
  avg7: number     // semaine
  avg30: number    // mois
  // Variations RÉELLES
  change24h: number  // (market - avg1) / avg1
  change7d: number   // (avg1 - avg7) / avg7
  change30d: number  // (avg7 - avg30) / avg30
  // Volatilité approximée
  volatility: number
  // Confiance (0-1) selon la complétude des données
  confidence: number
}

export function normalizeCardmarketPrices(cm: CardmarketPrices): NormalizedPrice | null {
  const trend = cm.trendPrice ?? cm.averageSellPrice ?? 0
  if (trend <= 0) return null

  const avg1 = cm.avg1 ?? trend
  const avg7 = cm.avg7 ?? avg1
  const avg30 = cm.avg30 ?? avg7
  const low = cm.lowPriceExPlus ?? cm.lowPrice ?? trend * 0.7
  const mid = cm.averageSellPrice ?? trend
  // High = trend + même écart qu'entre trend et low (symétrique)
  const spread = Math.max(0, trend - low)
  const high = trend + spread * 0.8

  const change24h = avg1 > 0 ? (trend - avg1) / avg1 : 0
  const change7d = avg7 > 0 ? (avg1 - avg7) / avg7 : 0
  const change30d = avg30 > 0 ? (avg7 - avg30) / avg30 : 0

  // Volatilité : amplitude normalisée des 3 périodes
  const prices = [avg30, avg7, avg1, trend].filter(Boolean)
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const volatility = max > 0 ? (max - min) / max : 0.1

  // Confiance basée sur la disponibilité des données
  let confidence = 0.4
  if (cm.avg1) confidence += 0.2
  if (cm.avg7) confidence += 0.2
  if (cm.avg30) confidence += 0.2

  return { market: trend, mid, low, high, avg1, avg7, avg30, change24h, change7d, change30d, volatility, confidence }
}

/**
 * Reconstruit 90 jours d'historique réaliste depuis les 3 vraies moyennes.
 * Utilise avg30 → avg7 → avg1 → trend comme ancres, avec interpolation + bruit faible.
 */
export function buildRealisticHistory(
  market: number,
  avg1: number,
  avg7: number,
  avg30: number,
  days = 90,
): { daysAgo: number; price: number }[] {
  const anchors = [
    { daysAgo: 0, price: market },
    { daysAgo: 1, price: avg1 },
    { daysAgo: 7, price: avg7 },
    { daysAgo: 30, price: avg30 },
  ]

  // Pour les jours au-delà de 30, extrapoler doucement depuis avg30
  if (days > 30) {
    // Prix 60 jours avant ≈ avg30 ± légère variation
    anchors.push({ daysAgo: 60, price: avg30 * (0.92 + Math.random() * 0.16) })
    anchors.push({ daysAgo: days, price: avg30 * (0.85 + Math.random() * 0.30) })
  }

  anchors.sort((a, b) => b.daysAgo - a.daysAgo)

  const result: { daysAgo: number; price: number }[] = []
  const volatilityFactor = Math.min(0.015, Math.abs(market - avg30) / avg30 / 30)

  for (let d = days; d >= 0; d--) {
    // Trouver les deux ancres encadrant ce jour
    let lower = anchors[0]
    let upper = anchors[anchors.length - 1]

    for (let i = 0; i < anchors.length - 1; i++) {
      if (anchors[i].daysAgo >= d && anchors[i + 1].daysAgo <= d) {
        lower = anchors[i + 1]
        upper = anchors[i]
        break
      }
    }

    const range = upper.daysAgo - lower.daysAgo
    const t = range > 0 ? (d - lower.daysAgo) / range : 0
    const interpolated = lower.price + (upper.price - lower.price) * t

    // Bruit gaussien faible basé sur la volatilité réelle
    const noise = (Math.random() - 0.5) * 2 * volatilityFactor * interpolated
    const price = Math.max(0.01, interpolated + noise)

    result.push({ daysAgo: d, price: +price.toFixed(2) })
  }

  return result
}

/**
 * Calcule le RSI sur une série de prix.
 */
export function computeRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  const changes = prices.slice(1).map((p, i) => p - prices[i])
  const gains = changes.map((c) => Math.max(0, c))
  const losses = changes.map((c) => Math.max(0, -c))
  const avgGain = gains.slice(-period).reduce((s, v) => s + v, 0) / period
  const avgLoss = losses.slice(-period).reduce((s, v) => s + v, 0) / period
  if (avgLoss === 0) return 100
  return +Math.min(100, Math.max(0, 100 - 100 / (1 + avgGain / avgLoss))).toFixed(1)
}

/**
 * Score d'investissement basé sur les vraies données marché.
 */
export function computeInvestmentScore(params: {
  change7d: number
  change30d: number
  volatility: number
  rarityRank: number   // 1-10
  price: number
  rsi: number
}): number {
  const { change7d, change30d, volatility, rarityRank, price, rsi } = params

  // Momentum (30 pts max)
  const momentum7 = Math.min(15, Math.max(-15, change7d * 100))
  const momentum30 = Math.min(15, Math.max(-15, change30d * 60))

  // Rareté (25 pts max)
  const rarityScore = (rarityRank / 10) * 25

  // Liquidité proxy (prix) (15 pts max)
  const liquidityScore = price > 50 ? 15 : price > 10 ? 10 : price > 2 ? 6 : 2

  // RSI score (15 pts max) — RSI entre 45-65 = optimal
  const rsiScore = rsi >= 30 && rsi <= 70
    ? 15 - Math.abs(rsi - 50) * 0.3
    : rsi < 30 ? 8 : 5  // oversold légèrement positif, overbought négatif

  // Faible volatilité = meilleur (10 pts max)
  const volScore = Math.max(0, 10 - volatility * 20)

  // Base
  const base = 40

  const total = base + momentum7 + momentum30 + rarityScore + liquidityScore + rsiScore + volScore
  return Math.round(Math.min(100, Math.max(0, total)))
}

export const RARITY_RANK: Record<string, number> = {
  CROWN_RARE: 10,
  HYPER_RARE: 9,
  SPECIAL_ILLUSTRATION_RARE: 9,
  ILLUSTRATION_RARE: 8,
  RARE_SECRET: 8,
  RARE_RAINBOW: 7,
  RARE_ULTRA: 7,
  RARE_HOLO_VSTAR: 6,
  RARE_HOLO_VMAX: 6,
  RARE_HOLO_V: 5,
  RARE_HOLO_EX: 5,
  RARE_HOLO_GX: 5,
  RARE_HOLO: 4,
  TRAINER_GALLERY_HOLO: 5,
  RARE: 3,
  UNCOMMON: 2,
  COMMON: 1,
  UNKNOWN: 2,
}
