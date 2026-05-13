/**
 * Calcule les données de marché (ATH, variation, RSI, score) pour toutes les
 * cartes qui ont un prix mais pas encore de CardMarketData.
 * 
 * Usage: node scripts/compute-market-data.mjs
 */

import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: './apps/web/.env' })
config({ path: './apps/web/.env.local' })

const prisma = new PrismaClient()

const RARITY_RANK = {
  CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9,
  ILLUSTRATION_RARE: 8, RARE_SECRET: 8, RARE_ULTRA: 7, RARE_HOLO_V: 7,
  RARE_HOLO_VMAX: 7, RARE_HOLO_EX: 7, RARE_HOLO_GX: 7, RARE_HOLO_VSTAR: 7,
  RARE_HOLO: 5, RARE: 4, UNCOMMON: 2, COMMON: 1, PROMO: 6,
}

const COPIES_MAP = {
  CROWN_RARE: 800, HYPER_RARE: 1200, SPECIAL_ILLUSTRATION_RARE: 1500,
  ILLUSTRATION_RARE: 3000, RARE_SECRET: 2000, RARE_ULTRA: 4000,
  RARE_HOLO: 15000, RARE: 25000, UNCOMMON: 80000, COMMON: 200000,
}

function computeScore({ change7d, change30d, volatility, rarityRank, price }) {
  let score = 50
  score += change7d * 100
  score += change30d * 50
  score -= volatility * 30
  score += Math.min(rarityRank * 3, 20)
  score += price > 100 ? 15 : price > 20 ? 8 : price > 5 ? 3 : 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

async function main() {
  // Find cards with prices but no market data
  const cards = await prisma.card.findMany({
    where: {
      prices: { some: { source: 'cardmarket' } },
      marketData: null,
    },
    include: {
      prices: { where: { source: 'cardmarket', variant: 'NORMAL' }, take: 1 },
      priceHistory: { where: { source: 'cardmarket' }, orderBy: { recordedAt: 'asc' } },
    },
  })

  console.log(`📊 ${cards.length} cartes sans données de marché`)

  let created = 0, errors = 0

  for (const card of cards) {
    const price = card.prices[0]
    if (!price) continue

    const market = Number(price.market)
    const low = Number(price.low ?? market * 0.7)
    const high = Number(price.high ?? market * 1.35)

    // Compute changes from history
    const history = card.priceHistory.map(h => ({ date: h.recordedAt, price: Number(h.price) }))
    const now = new Date()
    const d7  = history.find(h => Math.abs(now.getTime() - h.date.getTime()) >= 6 * 86400000)
    const d30 = history.find(h => Math.abs(now.getTime() - h.date.getTime()) >= 29 * 86400000)

    const avg7  = d7?.price  ?? market
    const avg30 = d30?.price ?? market

    const change7d  = avg7  > 0 ? (market - avg7)  / avg7  : 0
    const change30d = avg30 > 0 ? (market - avg30) / avg30 : 0
    const volatility = Math.abs(change30d)

    const rarityRank = RARITY_RANK[card.rarity] ?? 2
    const score = computeScore({ change7d, change30d, volatility, rarityRank, price: market })
    const trend = volatility > 0.25 ? 'VOLATILE' : change7d > 0.05 ? 'BULLISH' : change7d < -0.05 ? 'BEARISH' : 'STABLE'
    const marketCap = market * (COPIES_MAP[card.rarity] ?? 10000)

    // ATH/ATL from history or current price
    const allPrices = [...history.map(h => h.price), market]
    const allTimeHigh = Math.max(...allPrices)
    const allTimeLow  = Math.min(...allPrices.filter(p => p > 0))

    try {
      await prisma.cardMarketData.create({
        data: {
          cardId: card.id,
          marketCap,
          priceChange24h: 0,
          priceChange7d: change7d,
          priceChange30d: change30d,
          volatility30d: volatility,
          rsi14: 50,
          investmentScore: score,
          rarityScore: Math.round(rarityRank * 10),
          liquidityScore: market > 50 ? 80 : market > 10 ? 60 : market > 2 ? 40 : 20,
          trendDirection: trend,
          allTimeHigh,
          allTimeLow,
        },
      })
      created++
    } catch { errors++ }

    if (created % 100 === 0 && created > 0) {
      process.stdout.write(`  ${created}/${cards.length}...\r`)
    }
  }

  console.log(`\n✅ ${created} CardMarketData créées | ${errors} erreurs`)

  // Also update existing market data for cards where ATH might be wrong
  console.log('\n📈 Mise à jour ATH/ATL pour cartes avec historique...')
  const withHistory = await prisma.card.findMany({
    where: {
      marketData: { isNot: null },
      priceHistory: { some: { source: 'cardmarket' } },
    },
    include: {
      prices: { where: { source: 'cardmarket', variant: 'NORMAL' }, take: 1 },
      priceHistory: { where: { source: 'cardmarket' }, orderBy: { recordedAt: 'asc' } },
      marketData: { select: { allTimeHigh: true, allTimeLow: true } },
    },
    take: 5000,
  })

  let athUpdated = 0
  for (const card of withHistory) {
    const price = card.prices[0]
    if (!price) continue
    const market = Number(price.market)
    const allPrices = [...card.priceHistory.map(h => Number(h.price)), market].filter(p => p > 0)
    const ath = Math.max(...allPrices)
    const atl = Math.min(...allPrices)
    const currentAth = Number(card.marketData?.allTimeHigh ?? 0)
    if (Math.abs(ath - currentAth) > 0.01) {
      await prisma.cardMarketData.update({
        where: { cardId: card.id },
        data: { allTimeHigh: ath, allTimeLow: atl },
      })
      athUpdated++
    }
  }
  console.log(`✅ ${athUpdated} ATH/ATL mis à jour`)

  const [totalPriced, totalMD] = await Promise.all([
    prisma.card.count({ where: { prices: { some: { source: 'cardmarket' } } } }),
    prisma.card.count({ where: { marketData: { isNot: null } } }),
  ])
  console.log(`\n✨ Total: ${totalMD}/${totalPriced} cartes pricées ont des données de marché`)
  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
