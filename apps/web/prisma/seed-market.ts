/**
 * seed-market.ts — Génère des données de marché réalistes pour toutes les cartes
 * Run: cd apps/web && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-market.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Prix de base par rareté [min, max] en EUR ─────────────────────────────
const RARITY_PRICES: Record<string, [number, number]> = {
  CROWN_RARE: [120, 480],
  HYPER_RARE: [50, 180],
  SPECIAL_ILLUSTRATION_RARE: [22, 95],
  ILLUSTRATION_RARE: [7, 42],
  RARE_SECRET: [8, 35],
  RARE_RAINBOW: [6, 28],
  RARE_ULTRA: [4, 20],
  AMAZING_RARE: [3, 14],
  RARE_HOLO_VSTAR: [2.5, 12],
  RARE_HOLO_VMAX: [2, 12],
  RARE_HOLO_GX: [1.5, 10],
  RARE_HOLO_EX: [1.5, 8],
  RARE_HOLO_V: [1, 8],
  TRAINER_GALLERY_HOLO_VMAX: [3, 20],
  TRAINER_GALLERY_HOLO_V: [1.5, 10],
  TRAINER_GALLERY_HOLO: [1, 6],
  RARE_HOLO: [0.4, 5],
  RARE_SHINY_GX: [3, 24],
  RARE_SHINY: [1, 8],
  RARE_PRISM: [2, 12],
  RARE: [0.2, 2.5],
  LEGEND: [5, 40],
  PROMO: [1.5, 25],
  UNCOMMON: [0.04, 0.70],
  COMMON: [0.02, 0.35],
  UNKNOWN: [0.08, 1.5],
}

// Volatilité journalière par rareté
const RARITY_VOLATILITY: Record<string, number> = {
  CROWN_RARE: 0.055,
  HYPER_RARE: 0.048,
  SPECIAL_ILLUSTRATION_RARE: 0.044,
  ILLUSTRATION_RARE: 0.040,
  RARE_SECRET: 0.038,
  RARE_RAINBOW: 0.035,
  RARE_ULTRA: 0.032,
  AMAZING_RARE: 0.028,
  RARE_HOLO_VSTAR: 0.026,
  RARE_HOLO_VMAX: 0.024,
  RARE_HOLO_GX: 0.024,
  RARE_HOLO_EX: 0.024,
  RARE_HOLO_V: 0.022,
  TRAINER_GALLERY_HOLO_VMAX: 0.034,
  TRAINER_GALLERY_HOLO_V: 0.030,
  TRAINER_GALLERY_HOLO: 0.024,
  RARE_HOLO: 0.020,
  RARE_SHINY_GX: 0.040,
  RARE_SHINY: 0.034,
  RARE_PRISM: 0.028,
  RARE: 0.016,
  LEGEND: 0.038,
  PROMO: 0.028,
  UNCOMMON: 0.010,
  COMMON: 0.007,
  UNKNOWN: 0.014,
}

const RARITY_RANK: Record<string, number> = {
  CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9, ILLUSTRATION_RARE: 8,
  RARE_SECRET: 8, RARE_RAINBOW: 7, RARE_ULTRA: 7, AMAZING_RARE: 6,
  RARE_HOLO_VSTAR: 6, RARE_HOLO_VMAX: 6, RARE_HOLO_GX: 5, RARE_HOLO_EX: 5,
  RARE_HOLO_V: 5, TRAINER_GALLERY_HOLO_VMAX: 7, TRAINER_GALLERY_HOLO_V: 6,
  TRAINER_GALLERY_HOLO: 5, RARE_HOLO: 4, RARE_SHINY_GX: 8, RARE_SHINY: 6,
  RARE_PRISM: 6, RARE: 3, LEGEND: 7, PROMO: 5, UNCOMMON: 2, COMMON: 1, UNKNOWN: 2,
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function rand(min: number, max: number) {
  return min + Math.random() * (max - min)
}

function randn(): number {
  const u = 1 - Math.random()
  const v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function generatePriceSeries(basePrice: number, days: number, vol: number, drift = 0.0005): number[] {
  const prices: number[] = [basePrice]
  for (let i = 1; i < days; i++) {
    const ret = drift + vol * randn()
    prices.push(Math.max(0.01, Number((prices[i - 1] * (1 + ret)).toFixed(3))))
  }
  return prices
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

// Scoring inline (miroir de src/lib/ai/scorer.ts)
function scoreCard(rarity: string, change7d: number, change30d: number, vol30d: number, rsi: number, setAgeDays: number): {
  investmentScore: number
  rarityScore: number
  liquidityScore: number
  riskLevel: number
  trendDirection: string
  bullishSignals: string[]
  bearishSignals: string[]
  keyInsight: string
  predictedRoi30d: number
  predictedRoi90d: number
} {
  const rank = RARITY_RANK[rarity] ?? 3

  // Momentum
  let momentum = 50
  momentum += change7d > 20 ? 15 : change7d > 10 ? 10 : change7d > 5 ? 5 : change7d < -20 ? -15 : change7d < -10 ? -10 : change7d < -5 ? -5 : 0
  momentum += change30d > 30 ? 12 : change30d > 15 ? 8 : change30d > 5 ? 4 : change30d < -30 ? -12 : change30d < -15 ? -8 : 0
  momentum = clamp(momentum, 0, 100)

  // Scarcity
  let scarcity = rank * 10
  if (rarity === 'FIRST_EDITION') scarcity += 20
  scarcity = clamp(scarcity, 0, 100)

  // Technical
  let technical = 50
  technical += rsi < 30 ? 20 : rsi < 40 ? 10 : rsi > 70 ? -15 : rsi > 80 ? -25 : 0
  technical -= vol30d > 1.5 ? 15 : vol30d > 1.0 ? 8 : 0
  technical = clamp(technical, 0, 100)

  // Fundamental
  let fundamental = 40 + rank * 3
  fundamental += setAgeDays > 7300 ? 20 : setAgeDays > 3650 ? 12 : setAgeDays > 1825 ? 6 : setAgeDays < 90 ? -5 : 0
  fundamental = clamp(fundamental, 0, 100)

  // Liquidity
  let liquidity = 20 + rank * 4
  liquidity = clamp(liquidity, 0, 100)

  // Social
  const social = 40

  const raw = momentum * 0.25 + scarcity * 0.20 + fundamental * 0.20 + social * 0.15 + technical * 0.10 + liquidity * 0.10
  const investmentScore = clamp(Math.round(raw), 0, 100)
  const rarityScore = clamp(Math.round(scarcity), 0, 100)
  const liquidityScore = clamp(Math.round(liquidity), 0, 100)

  let riskLevel = 30 + Math.min(30, vol30d * 20)
  if (change30d < -30) riskLevel += 20
  if (rsi > 75) riskLevel += 15
  if (setAgeDays < 60) riskLevel += 10
  riskLevel = clamp(Math.round(riskLevel), 0, 100)

  const baseMom = change7d * 0.4 + change30d * 0.6
  const predictedRoi30d = clamp(baseMom * 0.7 / 100, -0.8, 3.0)
  const predictedRoi90d = clamp(baseMom * 0.4 / 100, -0.8, 3.0)

  const trendDirection = vol30d > 0.8 ? 'VOLATILE' : predictedRoi30d > 0.05 ? 'BULLISH' : predictedRoi30d < -0.05 ? 'BEARISH' : 'STABLE'

  const bullishSignals: string[] = []
  const bearishSignals: string[] = []
  if (change7d > 15) bullishSignals.push(`Fort momentum : +${change7d.toFixed(1)}% sur 7j`)
  if (change30d > 20) bullishSignals.push(`Hausse soutenue : +${change30d.toFixed(1)}% sur 30j`)
  if (rsi < 30) bullishSignals.push(`RSI oversold (${rsi.toFixed(0)}) — rebond probable`)
  if (rank >= 8) bullishSignals.push('Rareté élevée — offre limitée')
  if (setAgeDays > 7300) bullishSignals.push('Carte vintage — prime collecteur')

  if (change7d < -15) bearishSignals.push(`Chute : ${change7d.toFixed(1)}% sur 7j`)
  if (rsi > 70) bearishSignals.push(`RSI overbought (${rsi.toFixed(0)}) — correction possible`)
  if (vol30d > 1.5) bearishSignals.push(`Volatilité élevée (${vol30d.toFixed(2)} annualisé)`)

  const keyInsight = investmentScore >= 80
    ? `Opportunité forte (${investmentScore}/100) — rareté et momentum positif.`
    : investmentScore >= 65
    ? `Profil au-dessus de la moyenne (${investmentScore}/100). Perf 30j : ${change30d > 0 ? '+' : ''}${change30d.toFixed(1)}%.`
    : investmentScore >= 50
    ? `Profil neutre (${investmentScore}/100). ${vol30d > 1 ? 'Volatilité élevée — attention.' : 'Stable.'}`
    : `Profil défavorable (${investmentScore}/100). ${bearishSignals[0] ?? 'Conditions difficiles.'}`

  return { investmentScore, rarityScore, liquidityScore, riskLevel, trendDirection, bullishSignals, bearishSignals, keyInsight, predictedRoi30d, predictedRoi90d }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Seeding market data...\n')

  // Nettoyage des données existantes
  await prisma.pricePrediction.deleteMany()
  await prisma.cardAiAnalysis.deleteMany()
  await prisma.cardMarketData.deleteMany()
  await prisma.priceHistory.deleteMany()
  await prisma.cardPrice.deleteMany()
  await prisma.saleEvent.deleteMany()
  await prisma.marketIndex.deleteMany()
  console.log('🗑  Tables vidées')

  const cards = await prisma.card.findMany({ include: { set: true } })
  console.log(`📦 ${cards.length} cartes à traiter\n`)

  const now = new Date()
  const DAYS = 90

  // ── Index de marché (90 jours) ───────────────────────────────────────────
  console.log('📈 Génération des indices de marché...')
  const indices = [
    { type: 'GLOBAL', base: 1000, vol: 0.012, drift: 0.0008 },
    { type: 'VINTAGE', base: 2500, vol: 0.008, drift: 0.0006 },
    { type: 'MODERN', base: 750, vol: 0.015, drift: 0.001 },
    { type: 'SEALED', base: 1200, vol: 0.010, drift: 0.0007 },
  ]

  for (const idx of indices) {
    const series = generatePriceSeries(idx.base, DAYS, idx.vol, idx.drift)
    await prisma.marketIndex.createMany({
      data: series.map((value, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (DAYS - 1 - i))
        return {
          indexType: idx.type,
          value: Number(value.toFixed(4)),
          change24h: i === 0 ? 0 : Number(((series[i] - series[i - 1]) / series[i - 1]).toFixed(6)),
          change7d: i < 7 ? 0 : Number(((series[i] - series[i - 7]) / series[i - 7]).toFixed(6)),
          change30d: i < 30 ? 0 : Number(((series[i] - series[i - 30]) / series[i - 30]).toFixed(6)),
          recordedAt: date,
        }
      }),
    })
  }
  console.log('✅ Indices de marché créés\n')

  // ── Données par carte ────────────────────────────────────────────────────
  let processed = 0

  for (const card of cards) {
    const rarity = card.rarity as string
    const [minP, maxP] = RARITY_PRICES[rarity] ?? [0.10, 2]
    const vol = RARITY_VOLATILITY[rarity] ?? 0.015

    // Prix actuel
    const currentPrice = rand(minP, maxP)

    // Série historique 90j
    const startPrice = currentPrice * rand(0.65, 1.45)
    const raw = generatePriceSeries(startPrice, DAYS, vol)
    const scale = currentPrice / raw[raw.length - 1]
    const prices = raw.map((p) => Math.max(0.01, Number((p * scale).toFixed(2))))

    // Variations
    const p0 = prices[DAYS - 1]
    const p1 = prices[DAYS - 2]
    const p7 = prices[DAYS - 8]
    const p30 = prices[DAYS - 31]

    const change24h = (p0 - p1) / (p1 + 1e-8)
    const change7d = (p0 - p7) / (p7 + 1e-8)
    const change30d = (p0 - p30) / (p30 + 1e-8)
    const change1y = change30d * 12

    const ath = Math.max(...prices)
    const atl = Math.min(...prices)

    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / (prices[i] + 1e-8))
    const avgRet = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / returns.length
    const vol30d = Math.sqrt(variance) * Math.sqrt(365)
    const vol7d = vol30d * 0.9

    const rsi = computeRSI(prices)

    // ── PriceHistory ─────────────────────────────────────────────────────
    await prisma.priceHistory.createMany({
      data: prices.map((price, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (DAYS - 1 - i))
        return {
          cardId: card.id,
          source: 'cardmarket',
          variant: 'NORMAL',
          price,
          volume: Math.floor(rand(1, 25)),
          currency: 'EUR',
          recordedAt: date,
        }
      }),
    })

    // ── CardPrice ─────────────────────────────────────────────────────────
    await prisma.cardPrice.createMany({
      data: [
        {
          cardId: card.id,
          source: 'cardmarket',
          variant: 'NORMAL',
          low: Number((p0 * 0.78).toFixed(2)),
          mid: Number(p0.toFixed(2)),
          high: Number((p0 * 1.32).toFixed(2)),
          market: Number(p0.toFixed(2)),
          directLow: Number((p0 * 0.72).toFixed(2)),
          currency: 'EUR',
        },
        {
          cardId: card.id,
          source: 'tcgplayer',
          variant: 'NORMAL',
          low: Number((p0 * 0.80 * 1.08).toFixed(2)),
          mid: Number((p0 * 1.08).toFixed(2)),
          high: Number((p0 * 1.40 * 1.08).toFixed(2)),
          market: Number((p0 * 1.08).toFixed(2)),
          currency: 'USD',
        },
      ],
    })

    // ── CardMarketData ────────────────────────────────────────────────────
    const rank = RARITY_RANK[rarity] ?? 3
    const estCopies = rank >= 8 ? rand(500, 3000) : rank >= 5 ? rand(2000, 20000) : rand(10000, 200000)
    const marketCap = p0 * estCopies

    const trendDirection = vol30d > 0.8 ? 'VOLATILE' : change30d > 0.05 ? 'BULLISH' : change30d < -0.05 ? 'BEARISH' : 'STABLE'

    const scored = scoreCard(rarity, change7d * 100, change30d * 100, vol30d, rsi,
      card.set?.releaseDate ? Math.floor((Date.now() - new Date(card.set.releaseDate).getTime()) / 86400000) : 365)

    await prisma.cardMarketData.create({
      data: {
        cardId: card.id,
        marketCap: Number(marketCap.toFixed(2)),
        volume24h: Number(Math.abs(change24h * marketCap * 0.01).toFixed(2)),
        volume7d: Number(Math.abs(change7d * marketCap * 0.05).toFixed(2)),
        priceChange24h: Number(change24h.toFixed(4)),
        priceChange7d: Number(change7d.toFixed(4)),
        priceChange30d: Number(change30d.toFixed(4)),
        priceChange1y: Number(clamp(change1y, -0.99, 10).toFixed(4)),
        allTimeHigh: Number(ath.toFixed(2)),
        allTimeLow: Number(atl.toFixed(2)),
        volatility7d: Number(clamp(vol7d, 0, 10).toFixed(4)),
        volatility30d: Number(clamp(vol30d, 0, 10).toFixed(4)),
        rsi14: Number(rsi.toFixed(2)),
        investmentScore: scored.investmentScore,
        rarityScore: scored.rarityScore,
        liquidityScore: scored.liquidityScore,
        trendDirection: trendDirection as any,
      },
    })

    // ── CardAiAnalysis ────────────────────────────────────────────────────
    const confBase = Math.max(0.3, Math.min(0.9, 1 - vol30d * 0.3))
    await prisma.cardAiAnalysis.create({
      data: {
        cardId: card.id,
        investmentScore: scored.investmentScore,
        rarityScore: scored.rarityScore,
        liquidityScore: scored.liquidityScore,
        riskLevel: scored.riskLevel,
        predictedRoi30d: Number(clamp(scored.predictedRoi30d, -0.8, 3.0).toFixed(4)),
        predictedRoi90d: Number(clamp(scored.predictedRoi90d, -0.8, 3.0).toFixed(4)),
        trendDirection: scored.trendDirection as any,
        confidenceScore: Number(confBase.toFixed(4)),
        bullishSignals: scored.bullishSignals,
        bearishSignals: scored.bearishSignals,
        keyInsight: scored.keyInsight,
        modelVersion: 'scorer-ts-v1',
        predictions: {
          create: [7, 30, 90].map((days) => {
            const decay = days === 7 ? 0.9 : days === 30 ? 0.7 : 0.5
            const roi = scored.predictedRoi30d * decay * (days / 30)
            const predicted = p0 * (1 + roi)
            const uncertainty = p0 * (0.05 + vol30d * 0.05 * (days / 30))
            return {
              horizonDays: days,
              predictedPrice: Math.max(0.01, Number(predicted.toFixed(2))),
              lowerBound: Math.max(0.01, Number((predicted - uncertainty).toFixed(2))),
              upperBound: Number((predicted + uncertainty).toFixed(2)),
              confidence: Number(Math.max(0.3, Math.min(0.9, confBase - days / 500)).toFixed(4)),
              modelName: 'scorer-ts-v1',
            }
          }),
        },
      },
    })

    // ── SaleEvents (ventes récentes) ──────────────────────────────────────
    const salesCount = Math.floor(rand(2, 9))
    const salesData = []
    for (let s = 0; s < salesCount; s++) {
      const daysAgo = Math.floor(rand(0, 30))
      const saleDate = new Date(now)
      saleDate.setDate(saleDate.getDate() - daysAgo)
      const salePrice = Math.max(0.01, p0 * rand(0.82, 1.18))
      salesData.push({
        cardId: card.id,
        source: 'ebay',
        variant: 'NORMAL' as const,
        salePrice: Number(salePrice.toFixed(2)),
        currency: 'EUR',
        platform: Math.random() > 0.4 ? 'eBay' : 'Cardmarket',
        condition: ['Near Mint', 'Lightly Played', 'Moderately Played'][Math.floor(Math.random() * 3)],
        soldAt: saleDate,
      })
    }
    await prisma.saleEvent.createMany({ data: salesData })

    processed++
    if (processed % 50 === 0) {
      process.stdout.write(`  ⚡ ${processed}/${cards.length} cartes...\r`)
    }
  }

  console.log(`\n✅ ${processed} cartes traitées`)

  // Résumé
  const [priceCount, histCount, mdCount, aiCount, saleCount, idxCount] = await Promise.all([
    prisma.cardPrice.count(),
    prisma.priceHistory.count(),
    prisma.cardMarketData.count(),
    prisma.cardAiAnalysis.count(),
    prisma.saleEvent.count(),
    prisma.marketIndex.count(),
  ])

  console.log('\n📊 Résumé :')
  console.log(`  CardPrice       : ${priceCount}`)
  console.log(`  PriceHistory    : ${histCount}`)
  console.log(`  CardMarketData  : ${mdCount}`)
  console.log(`  CardAiAnalysis  : ${aiCount}`)
  console.log(`  SaleEvent       : ${saleCount}`)
  console.log(`  MarketIndex     : ${idxCount}`)
  console.log('\n🎉 Seeding terminé !')
}

main().catch(console.error).finally(() => prisma.$disconnect())
