/**
 * seed-real-prices.ts — Remplace les prix simulés par les vrais prix Cardmarket via pokemontcg.io
 * Run: cd apps/web && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-real-prices.ts
 */
import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()

// Mapping: externalId prefix → pokemontcg.io set ID
const SET_MAPPING: Record<string, string> = {
  'sv10.5w': 'rsv10pt5',
  'sv10.5b': 'zsv10pt5',
}

interface PtcgCard {
  id: string
  name: string
  number: string
  cardmarket?: {
    url?: string
    updatedAt?: string
    prices?: {
      averageSellPrice?: number
      lowPrice?: number
      trendPrice?: number
      avg1?: number
      avg7?: number
      avg30?: number
      reverseHoloSell?: number
      reverseHoloLow?: number
      reverseHoloTrend?: number
      reverseHoloAvg1?: number
      reverseHoloAvg7?: number
      reverseHoloAvg30?: number
    }
  }
  tcgplayer?: {
    prices?: {
      normal?: { low?: number; mid?: number; high?: number; market?: number }
      holofoil?: { low?: number; mid?: number; high?: number; market?: number }
      reverseHolofoil?: { low?: number; mid?: number; high?: number; market?: number }
    }
  }
}

async function fetchPtcgSet(setId: string): Promise<PtcgCard[]> {
  const res = await axios.get(`https://api.pokemontcg.io/v2/cards`, {
    params: {
      q: `set.id:${setId}`,
      pageSize: 250,
      select: 'id,name,number,cardmarket,tcgplayer',
    },
    timeout: 15000,
  })
  return res.data?.data ?? []
}

async function main() {
  console.log('💰 Mise à jour des prix réels depuis pokemontcg.io...\n')

  // Vider les anciennes données de prix
  await prisma.priceHistory.deleteMany()
  await prisma.cardPrice.deleteMany()
  await prisma.cardMarketData.deleteMany()
  await prisma.saleEvent.deleteMany()
  console.log('🗑  Anciens prix supprimés\n')

  // Charger toutes les cartes de notre DB
  const dbCards = await prisma.card.findMany({
    select: { id: true, externalId: true, name: true, rarity: true },
  })
  console.log(`📦 ${dbCards.length} cartes dans la DB\n`)

  // Construire index: "sv10.5w-009" → dbCard
  const cardIndex = new Map<string, typeof dbCards[0]>()
  for (const card of dbCards) {
    cardIndex.set(card.externalId, card)
  }

  let totalUpdated = 0
  let totalMissing = 0

  for (const [ourSetId, ptcgSetId] of Object.entries(SET_MAPPING)) {
    console.log(`🔄 Récupération de ${ourSetId} (${ptcgSetId})...`)

    const ptcgCards = await fetchPtcgSet(ptcgSetId)
    console.log(`   ${ptcgCards.length} cartes récupérées`)

    let setUpdated = 0

    for (const ptcgCard of ptcgCards) {
      // Normaliser le numéro: "001" ou "1" → "001"
      const rawNum = ptcgCard.number.padStart(3, '0')
      const ourExternalId = `${ourSetId}-${rawNum}`

      const dbCard = cardIndex.get(ourExternalId)
      if (!dbCard) {
        // Essayer sans le zéro de gauche ou avec
        const altExternalId = `${ourSetId}-${ptcgCard.number}`
        const altCard = cardIndex.get(altExternalId)
        if (!altCard) {
          totalMissing++
          continue
        }
        // Utiliser le alt
        await updateCardPrices(altCard, ptcgCard)
        setUpdated++
        totalUpdated++
        continue
      }

      await updateCardPrices(dbCard, ptcgCard)
      setUpdated++
      totalUpdated++
    }

    console.log(`   ✅ ${setUpdated} cartes mises à jour\n`)
  }

  // Seed aussi l'historique de prix et les données de marché
  await seedHistoryAndMarket(dbCards)

  console.log(`\n📊 Résultat final:`)
  console.log(`  Cartes avec vrais prix: ${totalUpdated}`)
  console.log(`  Cartes sans correspondance: ${totalMissing}`)

  const priceCount = await prisma.cardPrice.count()
  const histCount = await prisma.priceHistory.count()
  const mdCount = await prisma.cardMarketData.count()
  console.log(`  CardPrice total: ${priceCount}`)
  console.log(`  PriceHistory total: ${histCount}`)
  console.log(`  CardMarketData total: ${mdCount}`)
  console.log('\n🎉 Mise à jour terminée !')
}

async function updateCardPrices(dbCard: { id: string; externalId: string; name: string; rarity: string }, ptcgCard: PtcgCard) {
  const cm = ptcgCard.cardmarket?.prices
  const tcg = ptcgCard.tcgplayer?.prices

  // Prix TCGPlayer (USD)
  const tcgNormal = tcg?.normal
  const tcgHolo = tcg?.holofoil
  const tcgReverse = tcg?.reverseHolofoil
  const tcgMarket = tcgHolo?.market ?? tcgNormal?.market ?? 0

  // Prix Cardmarket (EUR) — fallback sur TCGPlayer × 0.92 si CM vide
  const tcgFallback = (tcgHolo?.market ?? tcgNormal?.market ?? 0) * 0.92
  const cmMarket = (cm?.trendPrice || cm?.averageSellPrice) ? (cm?.trendPrice ?? cm?.averageSellPrice ?? 0) : tcgFallback
  const cmLow = cm?.lowPrice ?? cmMarket * 0.78
  const cmHigh = cmMarket * 1.4

  // Prix reverse holo si dispo
  const cmReverseMarket = cm?.reverseHoloTrend ?? cm?.reverseHoloSell ?? 0

  const priceEntries: any[] = []

  // Cardmarket NORMAL
  if (cmMarket > 0) {
    priceEntries.push({
      cardId: dbCard.id,
      source: 'cardmarket',
      variant: 'NORMAL',
      low: Math.max(0.01, Number(cmLow.toFixed(2))),
      mid: Number((cmMarket * 1.1).toFixed(2)),
      high: Number(cmHigh.toFixed(2)),
      market: Number(cmMarket.toFixed(2)),
      directLow: Math.max(0.01, Number((cmLow * 0.9).toFixed(2))),
      currency: 'EUR',
    })
  }

  // Cardmarket REVERSE_HOLO si le prix est différent et significatif
  if (cmReverseMarket > 0 && Math.abs(cmReverseMarket - cmMarket) > 0.01) {
    priceEntries.push({
      cardId: dbCard.id,
      source: 'cardmarket',
      variant: 'REVERSE_HOLO',
      low: Math.max(0.01, Number((cm?.reverseHoloLow ?? cmReverseMarket * 0.8).toFixed(2))),
      mid: Number((cmReverseMarket * 1.05).toFixed(2)),
      high: Number((cmReverseMarket * 1.35).toFixed(2)),
      market: Number(cmReverseMarket.toFixed(2)),
      directLow: Math.max(0.01, Number((cmReverseMarket * 0.75).toFixed(2))),
      currency: 'EUR',
    })
  }

  // TCGPlayer (USD)
  if (tcgMarket > 0) {
    const tcgSource = tcgHolo ?? tcgNormal!
    priceEntries.push({
      cardId: dbCard.id,
      source: 'tcgplayer',
      variant: tcgHolo ? 'HOLO' : 'NORMAL',
      low: Number((tcgSource.low ?? tcgMarket * 0.8).toFixed(2)),
      mid: Number((tcgSource.mid ?? tcgMarket).toFixed(2)),
      high: Number((tcgSource.high ?? tcgMarket * 1.3).toFixed(2)),
      market: Number(tcgMarket.toFixed(2)),
      currency: 'USD',
    })
  }

  if (priceEntries.length > 0) {
    await prisma.cardPrice.createMany({ data: priceEntries, skipDuplicates: true })
  }
}

async function seedHistoryAndMarket(dbCards: { id: string; externalId: string; name: string; rarity: string }[]) {
  console.log('\n📈 Génération de l\'historique et des données de marché...')

  const now = new Date()
  const DAYS = 90

  // Récupérer les prix réels qu'on vient d'insérer
  const prices = await prisma.cardPrice.findMany({
    where: { source: 'cardmarket', variant: 'NORMAL' },
    select: { cardId: true, market: true, low: true, high: true },
  })
  const priceMap = new Map(prices.map((p) => [p.cardId, p]))

  const RARITY_VOLATILITY: Record<string, number> = {
    CROWN_RARE: 0.048, HYPER_RARE: 0.042, SPECIAL_ILLUSTRATION_RARE: 0.040,
    ILLUSTRATION_RARE: 0.036, RARE_SECRET: 0.034, RARE_RAINBOW: 0.032,
    RARE_ULTRA: 0.030, RARE_HOLO_VSTAR: 0.026, RARE_HOLO_VMAX: 0.024,
    RARE_HOLO: 0.020, RARE: 0.016, UNCOMMON: 0.010, COMMON: 0.007,
    PROMO: 0.025, UNKNOWN: 0.014,
  }

  function randn() {
    const u = 1 - Math.random(), v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }

  let processed = 0

  for (const card of dbCards) {
    const cardPrice = priceMap.get(card.id)
    const currentPrice = cardPrice ? Number(cardPrice.market) : 0.10

    if (currentPrice <= 0) continue

    const vol = RARITY_VOLATILITY[card.rarity] ?? 0.015
    const startPrice = currentPrice * (0.75 + Math.random() * 0.5)

    // Générer série de prix historiques
    const prices: number[] = [startPrice]
    for (let i = 1; i < DAYS; i++) {
      // Converger vers currentPrice dans les derniers jours
      const target = i > DAYS - 15 ? currentPrice : startPrice
      const pull = (target - prices[i - 1]) / (DAYS - i + 1) * 0.3
      const ret = pull / prices[i - 1] + vol * randn() * 0.6
      prices.push(Math.max(0.01, Number((prices[i - 1] * (1 + ret)).toFixed(3))))
    }
    // Forcer le dernier prix à être le prix réel
    prices[DAYS - 1] = currentPrice

    // PriceHistory
    await prisma.priceHistory.createMany({
      data: prices.map((price, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (DAYS - 1 - i))
        return {
          cardId: card.id,
          source: 'cardmarket',
          variant: 'NORMAL',
          price: Number(price.toFixed(2)),
          volume: Math.floor(Math.random() * 20) + 1,
          currency: 'EUR',
          recordedAt: date,
        }
      }),
    })

    // Calcul des métriques
    const p0 = prices[DAYS - 1]
    const p1 = prices[DAYS - 2]
    const p7 = prices[DAYS - 8]
    const p30 = prices[DAYS - 31]

    const change24h = (p0 - p1) / (p1 + 1e-8)
    const change7d = (p0 - p7) / (p7 + 1e-8)
    const change30d = (p0 - p30) / (p30 + 1e-8)

    const returns = prices.slice(1).map((p, i) => (p - prices[i]) / (prices[i] + 1e-8))
    const avgRet = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / returns.length
    const vol30d = Math.sqrt(variance) * Math.sqrt(365)

    // RSI
    const changes14 = prices.slice(-15).map((p, i, a) => i === 0 ? 0 : p - a[i - 1])
    const gains = changes14.map((c) => Math.max(0, c))
    const losses = changes14.map((c) => Math.max(0, -c))
    const avgGain = gains.slice(1).reduce((s, v) => s + v, 0) / 14
    const avgLoss = losses.slice(1).reduce((s, v) => s + v, 0) / 14
    const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

    const RARITY_RANK: Record<string, number> = {
      CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9, ILLUSTRATION_RARE: 8,
      RARE_SECRET: 8, RARE_RAINBOW: 7, RARE_ULTRA: 7, RARE_HOLO_VSTAR: 6, RARE_HOLO_VMAX: 6,
      RARE_HOLO: 5, RARE: 4, UNCOMMON: 2, COMMON: 1, PROMO: 5, UNKNOWN: 2,
    }
    const rank = RARITY_RANK[card.rarity] ?? 3
    const estCopies = rank >= 8 ? 500 + Math.random() * 2500 : rank >= 5 ? 2000 + Math.random() * 18000 : 10000 + Math.random() * 190000
    const marketCap = p0 * estCopies

    const trendDirection = vol30d > 0.8 ? 'VOLATILE' : change30d > 0.05 ? 'BULLISH' : change30d < -0.05 ? 'BEARISH' : 'STABLE'

    // Score investissement
    let investScore = 50 + rank * 4
    investScore += change7d * 100 > 15 ? 10 : change7d * 100 < -15 ? -10 : 0
    investScore += rsi < 30 ? 15 : rsi > 70 ? -10 : 0
    investScore = Math.max(0, Math.min(100, Math.round(investScore)))

    await prisma.cardMarketData.create({
      data: {
        cardId: card.id,
        marketCap: Number(marketCap.toFixed(2)),
        volume24h: Number(Math.abs(change24h * marketCap * 0.01).toFixed(2)),
        volume7d: Number(Math.abs(change7d * marketCap * 0.05).toFixed(2)),
        priceChange24h: Number(change24h.toFixed(4)),
        priceChange7d: Number(change7d.toFixed(4)),
        priceChange30d: Number(change30d.toFixed(4)),
        priceChange1y: Number(Math.max(-0.99, Math.min(10, change30d * 12)).toFixed(4)),
        allTimeHigh: Number(Math.max(...prices).toFixed(2)),
        allTimeLow: Number(Math.min(...prices).toFixed(2)),
        volatility7d: Number(Math.min(vol30d * 0.9, 10).toFixed(4)),
        volatility30d: Number(Math.min(vol30d, 10).toFixed(4)),
        rsi14: Number(Math.max(0, Math.min(100, rsi)).toFixed(2)),
        investmentScore: investScore,
        rarityScore: Math.min(100, rank * 10),
        liquidityScore: Math.min(100, 20 + rank * 4),
        trendDirection: trendDirection as any,
      },
    })

    // Ventes récentes
    const salesData = []
    const salesCount = Math.floor(Math.random() * 7) + 2
    for (let s = 0; s < salesCount; s++) {
      const daysAgo = Math.floor(Math.random() * 30)
      const saleDate = new Date(now)
      saleDate.setDate(saleDate.getDate() - daysAgo)
      salesData.push({
        cardId: card.id,
        source: 'ebay',
        variant: 'NORMAL' as const,
        salePrice: Number(Math.max(0.01, p0 * (0.85 + Math.random() * 0.3)).toFixed(2)),
        currency: 'EUR',
        platform: Math.random() > 0.4 ? 'eBay' : 'Cardmarket',
        condition: ['Near Mint', 'Lightly Played', 'Moderately Played'][Math.floor(Math.random() * 3)],
        soldAt: saleDate,
      })
    }
    await prisma.saleEvent.createMany({ data: salesData })

    processed++
    if (processed % 50 === 0) process.stdout.write(`  ⚡ ${processed}/${dbCards.length}...\r`)
  }

  // AI Analysis (re-seed depuis le scorer)
  await prisma.pricePrediction.deleteMany()
  await prisma.cardAiAnalysis.deleteMany()

  const allPrices = await prisma.cardPrice.findMany({ where: { source: 'cardmarket', variant: 'NORMAL' }, select: { cardId: true, market: true } })
  const allPriceMap = new Map(allPrices.map((p) => [p.cardId, Number(p.market)]))
  const allMarketData = await prisma.cardMarketData.findMany({ select: { cardId: true, priceChange7d: true, priceChange30d: true, volatility30d: true, rsi14: true, investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true } })
  const allMdMap = new Map(allMarketData.map((m) => [m.cardId, m]))

  for (const card of dbCards) {
    const md = allMdMap.get(card.id)
    const price = allPriceMap.get(card.id) ?? 0
    if (!md || price <= 0) continue

    const vol = Number(md.volatility30d)
    const confBase = Math.max(0.3, Math.min(0.9, 1 - vol * 0.3))
    const roi30 = Number(md.priceChange30d) * 0.7 / 100 * (price > 1 ? 1 : 0.5)

    await prisma.cardAiAnalysis.create({
      data: {
        cardId: card.id,
        investmentScore: md.investmentScore ?? 50,
        rarityScore: md.rarityScore ?? 30,
        liquidityScore: md.liquidityScore ?? 30,
        riskLevel: Math.max(10, Math.min(90, Math.round(30 + vol * 20))),
        predictedRoi30d: Number(Math.max(-0.8, Math.min(3.0, roi30)).toFixed(4)),
        predictedRoi90d: Number(Math.max(-0.8, Math.min(3.0, roi30 * 0.5)).toFixed(4)),
        trendDirection: md.trendDirection as any,
        confidenceScore: Number(confBase.toFixed(4)),
        bullishSignals: Number(md.priceChange7d) > 0.05 ? ['Momentum positif sur 7 jours', 'Volume en hausse'] : [],
        bearishSignals: Number(md.priceChange7d) < -0.05 ? ['Pression vendeuse récente'] : [],
        keyInsight: `Prix réel Cardmarket : ${price.toFixed(2)}€. Score ${md.investmentScore ?? 50}/100.`,
        modelVersion: 'scorer-ts-v1',
        predictions: {
          create: [7, 30, 90].map((days) => {
            const decay = days === 7 ? 0.9 : days === 30 ? 0.7 : 0.5
            const predicted = price * (1 + roi30 * decay * days / 30)
            const uncertainty = price * (0.04 + vol * 0.04 * days / 30)
            return {
              horizonDays: days,
              predictedPrice: Math.max(0.01, Number(predicted.toFixed(2))),
              lowerBound: Math.max(0.01, Number((predicted - uncertainty).toFixed(2))),
              upperBound: Number((predicted + uncertainty).toFixed(2)),
              confidence: Number(Math.max(0.3, confBase - days / 600).toFixed(4)),
              modelName: 'scorer-ts-v1',
            }
          }),
        },
      },
    })
  }

  console.log(`\n  ✅ ${processed} cartes traitées`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
