import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'
import { scoreCard, ScoringInput } from '@/lib/ai/scorer'
import { charTier, RARITY_W, scarcityScore, detectEra, buildTargets, investmentScoreFromProfile } from '@/lib/investment/helpers'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'

const RARITY_MAP: Record<string, number> = {
  CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9, ILLUSTRATION_RARE: 8,
  RARE_SECRET: 8, RARE_RAINBOW: 7, RARE_SHINY_GX: 7, LEGEND: 7,
  RARE_ULTRA: 7, RARE_HOLO_VSTAR: 6, RARE_HOLO_VMAX: 6, RARE_HOLO_EX: 6, RARE_HOLO_GX: 6,
  AMAZING_RARE: 6, RARE_HOLO_V: 5, RARE_HOLO: 5, RARE: 4, UNCOMMON: 3, COMMON: 2,
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const cached = await withCache(`ai:analysis:${id}`, 300, async () => {
    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        set: { select: { releaseDate: true, externalId: true, series: true, name: true } },
        aiAnalysis: { include: { predictions: { orderBy: { horizonDays: 'asc' } } } },
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
        marketData: { select: { priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, allTimeLow: true, volatility30d: true, rsi14: true, investmentScore: true } },
      },
    })
    if (!card) return null
    return computeAnalysis(card)
  })

  if (!cached) return NextResponse.json({ error: 'Card not found' }, { status: 404 })
  return NextResponse.json(cached)
}

async function computeAnalysis(card: any) {
  const now = new Date()

  // ── Historique de prix 90j ────────────────────────────────────────────────
  const history = await prisma.priceHistory.findMany({
    where: { cardId: card.id, source: 'cardmarket', recordedAt: { gte: subDays(now, 90) } },
    orderBy: { recordedAt: 'asc' },
    select: { price: true, recordedAt: true },
  })
  const prices = history.map(h => Number(h.price))
  const currentPrice = prices.at(-1) ?? Number(card.prices[0]?.market ?? 0)

  // ── Ventes réelles (SaleEvent) ────────────────────────────────────────────
  const salesAll = await prisma.saleEvent.findMany({
    where: { cardId: card.id, soldAt: { gte: subDays(now, 90) } },
    orderBy: { soldAt: 'asc' },
    select: { salePrice: true, soldAt: true, platform: true },
  })
  const sales30d = salesAll.filter(s => s.soldAt >= subDays(now, 30))
  const sales60_90d = salesAll.filter(s => s.soldAt < subDays(now, 30))

  const salesCount30d = sales30d.length
  const salesCount90d = salesAll.length
  const avgSale30d = salesCount30d > 0
    ? sales30d.reduce((s, e) => s + Number(e.salePrice), 0) / salesCount30d : 0
  const avgSale60_90d = sales60_90d.length > 0
    ? sales60_90d.reduce((s, e) => s + Number(e.salePrice), 0) / sales60_90d.length : 0
  // Tendance : prix moyen 30d vs période précédente
  const saleTrend30d = avgSale30d > 0 && avgSale60_90d > 0
    ? ((avgSale30d - avgSale60_90d) / avgSale60_90d) * 100 : 0

  // Dernier prix de vente connu
  const lastSalePrice = salesAll.length > 0 ? Number(salesAll.at(-1)!.salePrice) : 0

  // ── Variations de prix ────────────────────────────────────────────────────
  const md = card.marketData
  const pct = (days: number): number => {
    if (prices.length >= days + 1) {
      const past = prices[prices.length - days - 1]
      return past > 0 ? ((currentPrice - past) / past) * 100 : 0
    }
    if (days <= 7)  return Number(md?.priceChange7d  ?? 0)
    if (days <= 30) return Number(md?.priceChange30d ?? 0)
    return Number(md?.priceChange1y ?? 0)
  }
  const change7d  = pct(7)
  const change30d = pct(30)
  const change90d = pct(90)

  // Utiliser la tendance des ventes si plus fiable que l'historique de prix
  const effectiveChange30d = salesCount30d >= 3 ? saleTrend30d : change30d

  // ── Volatilité et RSI ─────────────────────────────────────────────────────
  // Volatilité annualisée correcte : écart-type des rendements journaliers × √252
  const slice = prices.slice(-31)
  const rawReturns: number[] = []
  for (let i = 1; i < slice.length; i++) {
    if (slice[i - 1] > 0) rawReturns.push((slice[i] - slice[i - 1]) / slice[i - 1])
  }
  let vol30: number
  if (rawReturns.length >= 3) {
    const meanR = rawReturns.reduce((s, r) => s + r, 0) / rawReturns.length
    const variance = rawReturns.reduce((s, r) => s + (r - meanR) ** 2, 0) / (rawReturns.length - 1)
    vol30 = Math.sqrt(variance) * Math.sqrt(252)
  } else {
    vol30 = md?.volatility30d ? Number(md.volatility30d) : 0.35
  }

  // Priorité : RSI calculé sur l'historique réel > valeur DB > 50 (neutre)
  const rsiComputed = prices.length >= 15 ? computeRSI(prices) : null
  const rsi = rsiComputed ?? (md?.rsi14 ? Number(md.rsi14) : 50)

  // ── Population PSA 10 ─────────────────────────────────────────────────────
  const psaPop = await prisma.psaPopulation.findFirst({
    where: { cardId: card.id, company: 'PSA', grade: 10 },
    select: { population: true },
  })
  const populationPsa10 = psaPop?.population ?? 999

  // ── Profil structurel ─────────────────────────────────────────────────────
  const setAgeDays = card.set?.releaseDate
    ? Math.floor((Date.now() - new Date(card.set.releaseDate).getTime()) / 86400000) : 365

  const rarityW  = RARITY_W[card.rarity ?? ''] ?? 0.05
  const exId     = card.set?.externalId ?? ''
  const scarce   = scarcityScore(exId, card.rarity ?? '')
  const era      = detectEra(exId, card.set?.series ?? null)
  const cTier    = charTier(card.name)
  const ath      = md?.allTimeHigh ? Number(md.allTimeHigh) : currentPrice
  const athDrop  = ath > currentPrice ? +(((ath - currentPrice) / ath) * 100).toFixed(1) : 0
  // Set OOP : vintage/old/swsh ont cessé d'être imprimés ; SV sets arrêtés après ~14 mois
  const isOOP    = era === 'vintage' || era === 'old' || era === 'swsh' || (era === 'sv' && setAgeDays > 420)

  // ── Scorer momentum ───────────────────────────────────────────────────────
  const inp: ScoringInput = {
    priceChange7d: change7d,
    priceChange30d: effectiveChange30d,
    priceChange90d: change90d,
    volatility30d: vol30,
    rsi14: rsi,
    ebayCount30d: salesCount30d,
    rarityRank: RARITY_MAP[card.rarity] ?? 3,
    populationPsa10,
    setAgeDays,
    isVintage: setAgeDays > 7300,
    isFirstEdition: card.variant === 'FIRST_EDITION',
    isShadowless: card.variant === 'SHADOWLESS',
    isPromo: card.variant === 'PROMO',
    isOOP,
    pokemonPopularity: cTier === 'S' ? 90 : cTier === 'A' ? 60 : 30,
    athDropPct: athDrop,
  }
  const result = scoreCard(inp)

  // ── Score d'investissement blendé ─────────────────────────────────────────
  // Pondération dynamique : plus on a de données réelles, plus le momentum compte
  const profileScore  = investmentScoreFromProfile(cTier, rarityW, scarce, era, athDrop, change7d, effectiveChange30d)
  const dataRichness  = Math.min(1, (prices.length + salesCount30d * 3) / 45)
  const momentumWeight = dataRichness * 0.45  // 0% (pas de données) → 45% (données riches)
  const rawScore = Math.round(result.investmentScore * momentumWeight + profileScore * (1 - momentumWeight))

  // ── Targets structurels ───────────────────────────────────────────────────
  const targets = buildTargets(currentPrice, ath, cTier, rarityW, scarce, era, athDrop, isOOP, card.variant === 'PROMO')

  // ── Plafonnement du score par le CAGR 3 ans ───────────────────────────────
  // Les cartes Pokémon sont des actifs 3-5 ans, pas 1 an.
  // On utilise le CAGR 3 ans comme vérité : une carte qui perd sur 3 ans est un mauvais investissement.
  // Exemple : SIR Pikachu SV en impression → mult1y=0.97 (attente OOP) mais mult3y=1.28 (bon)
  // → CAGR3 ≈ 8.6%/an → score plafonné à 78, pas 52.
  const cagr3y = Math.pow(targets.mult3y, 1 / 3) - 1
  const scoreCap =
    cagr3y < -0.05 ? 30 :  // perte >5%/an sur 3 ans → mauvais investissement
    cagr3y < -0.01 ? 42 :  // perte 1-5%/an → faible
    cagr3y < 0.03  ? 55 :  // flat → neutre
    cagr3y < 0.07  ? 67 :  // 3-7%/an → marché
    cagr3y < 0.12  ? 78 :  // 7-12%/an → bon
    cagr3y < 0.18  ? 87 :  // 12-18%/an → très bon (SIR OOP S-tier)
    92                      // 18%+/an → excellent (vintage S-tier)
  const investmentScore = Math.min(rawScore, scoreCap)

  // ── Prédictions enrichies ─────────────────────────────────────────────────
  // roi30d réel : priorité aux ventes > historique > 0
  const roi30dReal = salesCount30d >= 3
    ? saleTrend30d / 100
    : prices.length >= 30
      ? change30d / 100
      : Number(md?.priceChange30d ?? 0) / 100

  // Pour les cartes de qualité en correction temporaire, ne pas extrapoler la chute indéfiniment.
  // Une carte OOP S-tier qui baisse de 25%/30j reviendra — mean-reversion documentée.
  const boundedRoi30d = investmentScore > 55 && roi30dReal < -0.15
    ? Math.max(roi30dReal, -0.15)
    : roi30dReal

  const predictions = buildPredictions(currentPrice, boundedRoi30d, vol30, targets, {
    lastSalePrice,
    salesCount30d,
    avgSale30d,
  }, investmentScore)

  // ── Signaux enrichis ──────────────────────────────────────────────────────
  const bullishSignals = [...result.bullishSignals]
  const bearishSignals = [...result.bearishSignals]

  // Signal de cohérence score/timing : bonne carte mais mauvais moment d'achat
  if (result.trendDirection === 'BEARISH' && investmentScore > 55 && change7d < -5) {
    bearishSignals.unshift('Tendance baissière en cours — qualité élevée mais attendre la stabilisation avant d\'acheter')
  } else if (result.trendDirection === 'BEARISH' && investmentScore > 55) {
    bearishSignals.unshift('Légère pression vendeuse — surveiller le retournement pour optimiser le point d\'entrée')
  }

  // Signaux depuis les ventes réelles
  if (salesCount30d >= 5 && saleTrend30d > 10) {
    bullishSignals.unshift(`${salesCount30d} ventes en 30j — prix moyen en hausse de +${saleTrend30d.toFixed(1)}%`)
  }
  if (salesCount30d >= 5 && saleTrend30d < -10) {
    bearishSignals.unshift(`${salesCount30d} ventes en 30j — prix moyen en baisse de ${saleTrend30d.toFixed(1)}%`)
  }
  if (avgSale30d > 0 && currentPrice > 0) {
    const diff = ((avgSale30d - currentPrice) / currentPrice) * 100
    if (diff > 15) bullishSignals.push(`Prix de vente moyen (${avgSale30d.toFixed(2)}€) > prix affiché de +${diff.toFixed(0)}%`)
    if (diff < -15) bearishSignals.push(`Prix de vente moyen (${avgSale30d.toFixed(2)}€) en dessous du prix affiché de ${Math.abs(diff).toFixed(0)}%`)
  }
  if (era === 'vintage' && !bullishSignals.some(s => s.includes('vintage'))) {
    bullishSignals.push('Carte vintage — offre fixe, demande collector en croissance constante')
  }
  if (targets.conviction === 'FORTE') {
    bullishSignals.push(`Conviction forte : objectif ${targets.horizon} à ${targets.t1y.toFixed(2)}€ (+${((targets.mult1y - 1) * 100).toFixed(0)}%)`)
  }
  if (athDrop > 30) {
    bullishSignals.push(`${athDrop.toFixed(0)}% sous ATH (${ath.toFixed(2)}€) — potentiel de recovery élevé`)
  }

  // ── Confidence globale ────────────────────────────────────────────────────
  const dataQuality = Math.min(1, (prices.length / 30) * 0.5 + (salesCount90d > 0 ? 0.3 : 0) + (populationPsa10 < 999 ? 0.2 : 0))
  const confidenceScore = +(0.35 + dataQuality * 0.40).toFixed(4)

  // ── Insight enrichi ───────────────────────────────────────────────────────
  const keyInsight = generateEnrichedInsight({
    card, investmentScore, cTier, era, targets, currentPrice,
    change30d: effectiveChange30d, salesCount30d, avgSale30d,
    athDrop, populationPsa10, bullishSignals, bearishSignals,
  })

  return {
    cardId: card.id,
    investmentScore,
    rarityScore: result.rarityScore,
    liquidityScore: salesCount90d > 0
      ? Math.min(100, 30 + salesCount90d * 4)
      : result.liquidityScore,
    riskLevel: result.riskLevel,
    trendDirection: result.trendDirection,
    confidenceScore,
    bullishSignals: bullishSignals.slice(0, 5),
    bearishSignals: bearishSignals.slice(0, 5),
    keyInsight,
    // ROI dérivé de buildPredictions() — plus fiable que la formule simpliste du scorer
    predictedRoi30d: (() => {
      const p30 = predictions.find(p => p.horizonDays === 30)
      return p30 && currentPrice > 0
        ? +((p30.predictedPrice - currentPrice) / currentPrice).toFixed(4)
        : result.predictedRoi30d
    })(),
    predictedRoi90d: (() => {
      const p90 = predictions.find(p => p.horizonDays === 90)
      return p90 && currentPrice > 0
        ? +((p90.predictedPrice - currentPrice) / currentPrice).toFixed(4)
        : result.predictedRoi90d
    })(),
    predictions,
    currentPrice,
    priceChange7d: +change7d.toFixed(2),
    priceChange30d: +effectiveChange30d.toFixed(2),
    salesData: {
      count30d: salesCount30d,
      count90d: salesCount90d,
      avgPrice30d: +avgSale30d.toFixed(2),
      trend30d: +saleTrend30d.toFixed(2),
      lastSalePrice: +lastSalePrice.toFixed(2),
    },
    targets: {
      t1y: targets.t1y, t3y: targets.t3y, t5y: targets.t5y,
      conviction: targets.conviction, horizon: targets.horizon,
    },
    modelVersion: 'scorer-ts-v3',
    updatedAt: new Date().toISOString(),
  }
}

// ── Prédictions multi-horizon cohérentes ──────────────────────────────────────
function buildPredictions(
  currentPrice: number,
  roi30d: number,
  vol30: number,
  targets: { t1y: number; t3y: number; t5y: number },
  sales?: { lastSalePrice: number; salesCount30d: number; avgSale30d: number },
  investmentScore = 50,
) {
  if (currentPrice <= 0) return []

  // Taux annuel structurel depuis les targets
  const annualRate = (targets.t1y / currentPrice) - 1

  // Ancre court-terme : si des ventes existent, on les utilise
  const shortAnchor = sales && sales.salesCount30d >= 3 && sales.avgSale30d > 0
    ? sales.avgSale30d : null

  const horizons = [
    { days: 7,   mw: 0.80, sw: 0.20 },
    { days: 30,  mw: 0.60, sw: 0.40 },
    { days: 90,  mw: 0.30, sw: 0.70 },
    { days: 180, mw: 0.10, sw: 0.90 },
    { days: 365, mw: 0.00, sw: 1.00 },
  ]

  // Pour les cartes de qualité, le momentum négatif s'attenue plus vite (mean-reversion).
  // Une bonne carte qui baisse de 30%/an ne continue pas à baisser de 30%/an indéfiniment.
  const momentumAnnualRaw = roi30d * 12
  const momentumAnnual = investmentScore > 55 && momentumAnnualRaw < 0
    ? Math.max(momentumAnnualRaw, annualRate > 0.08 ? -annualRate * 1.5 : -0.25)
    : momentumAnnualRaw

  return horizons.map(({ days, mw, sw }) => {
    // Composante momentum : projection annualisée avec décroissance
    const momentumRoi = momentumAnnual * (days / 365) * Math.exp(-days / 90)

    // Composante structurelle : interpolation linéaire du taux annuel
    const structuralRoi = annualRate * (days / 365)

    // Blend selon l'horizon
    let blendedRoi = Math.abs(roi30d) > 0.005
      ? momentumRoi * mw + structuralRoi * sw
      : structuralRoi

    let base = currentPrice * (1 + blendedRoi)

    // Pour 7j et 30j, ancrer sur le prix de vente moyen récent si disponible
    if (shortAnchor && days <= 30) {
      const anchorWeight = days === 7 ? 0.6 : 0.4
      base = base * (1 - anchorWeight) + shortAnchor * (1 + structuralRoi * (days / 365)) * anchorWeight
    }

    // Incertitude proportionnelle à la volatilité et l'horizon
    const uncertainty = currentPrice * (0.04 + vol30 * 0.035 * Math.sqrt(days / 30))

    // Confidence décroissante avec l'horizon
    const baseConf = 0.82 - vol30 * 0.18 - (days / 365) * 0.28
    const confidence = Math.max(0.22, Math.min(0.82, baseConf))

    return {
      horizonDays: days,
      predictedPrice: Math.max(0.01, +base.toFixed(2)),
      lowerBound:     Math.max(0.01, +(base - uncertainty).toFixed(2)),
      upperBound:     +(base + uncertainty).toFixed(2),
      confidence:     +confidence.toFixed(4),
    }
  })
}

// ── Insight enrichi ───────────────────────────────────────────────────────────
function generateEnrichedInsight(p: {
  card: any; investmentScore: number; cTier: string; era: string
  targets: any; currentPrice: number; change30d: number
  salesCount30d: number; avgSale30d: number; athDrop: number
  populationPsa10: number; bullishSignals: string[]; bearishSignals: string[]
}): string {
  const { investmentScore, cTier, era, targets, currentPrice, change30d,
    salesCount30d, avgSale30d, athDrop, populationPsa10 } = p

  const name = p.card.name ?? 'Cette carte'
  const growthPct = ((targets.mult1y - 1) * 100).toFixed(0)
  const salesInfo = salesCount30d > 0
    ? ` ${salesCount30d} ventes récentes à ${avgSale30d.toFixed(2)}€ en moyenne.` : ''

  if (investmentScore >= 80) {
    if (era === 'vintage') {
      return `${name} est un actif vintage de premier ordre (score ${investmentScore}/100). Offre définitivement limitée, demande collector structurelle. Objectif 1 an : ${targets.t1y.toFixed(2)}€ (+${growthPct}%).${salesInfo}`
    }
    if (cTier === 'S' && targets.conviction === 'FORTE') {
      return `Très forte opportunité (score ${investmentScore}/100). ${name} combine popularité S-tier et rareté élevée. Objectif ${targets.horizon} : +${growthPct}% annuel.${salesInfo}`
    }
    return `Opportunité d'achat forte (score ${investmentScore}/100). ${name} — momentum positif${athDrop > 20 ? `, ${athDrop.toFixed(0)}% sous ATH` : ''}. Objectif 1 an : ${targets.t1y.toFixed(2)}€.${salesInfo}`
  }

  if (investmentScore >= 60) {
    const perfStr = change30d !== 0 ? ` Performance 30j : ${change30d > 0 ? '+' : ''}${change30d.toFixed(1)}%.` : ''
    return `Profil au-dessus de la moyenne (score ${investmentScore}/100).${perfStr} Potentiel ${targets.horizon} estimé à ${targets.t1y.toFixed(2)}€.${salesInfo}`
  }

  if (investmentScore >= 40) {
    const popStr = populationPsa10 < 200 ? ` Population PSA 10 faible (${populationPsa10}).` : ''
    return `Profil neutre (score ${investmentScore}/100).${popStr} Adapté aux collectionneurs. Croissance estimée : +${growthPct}% sur 1 an.${salesInfo}`
  }

  const mainRisk = p.bearishSignals[0] ?? 'Conditions de marché peu favorables actuellement.'
  return `Profil prudent (score ${investmentScore}/100). ${mainRisk} Cible 1 an conservative : ${targets.t1y.toFixed(2)}€.${salesInfo}`
}

// ── RSI ───────────────────────────────────────────────────────────────────────
function computeRSI(prices: number[], period = 14): number {
  if (!prices?.length || prices.length < period + 1) return 50
  const changes = prices.slice(1).map((p, i) => p - prices[i])
  const gains = changes.map(c => Math.max(0, c))
  const losses = changes.map(c => Math.max(0, -c))
  const avgGain = gains.slice(-period).reduce((s, v) => s + v, 0) / period
  const avgLoss = losses.slice(-period).reduce((s, v) => s + v, 0) / period
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}
