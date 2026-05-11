/**
 * seed-all-sv.ts — Seed complet de tous les sets SV avec vrais prix pokemontcg.io + noms FR TCGdex
 * Run: cd apps/web && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-all-sv.ts
 */
import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()

// ─── Mapping TCGdex ↔ pokemontcg.io ─────────────────────────────────────────
const SETS: Array<{
  tcgdexId: string         // ID TCGdex (pour les images + noms FR)
  ptcgId: string           // ID pokemontcg.io (pour les données + prix)
  frName: string           // Nom français du set
}> = [
  { tcgdexId: 'sv01',    ptcgId: 'sv1',     frName: 'Écarlate et Violet' },
  { tcgdexId: 'sv02',    ptcgId: 'sv2',     frName: 'Évolution à Paldea' },
  { tcgdexId: 'sv03',    ptcgId: 'sv3',     frName: 'Flammes Obsidiennes' },
  { tcgdexId: 'sv03.5',  ptcgId: 'sv3pt5',  frName: '151' },
  { tcgdexId: 'sv04',    ptcgId: 'sv4',     frName: 'Failles Paradoxes' },
  { tcgdexId: 'sv04.5',  ptcgId: 'sv4pt5',  frName: 'Destinées de Paldea' },
  { tcgdexId: 'sv05',    ptcgId: 'sv5',     frName: 'Forces Temporelles' },
  { tcgdexId: 'sv06',    ptcgId: 'sv6',     frName: 'Mascarade Crépusculaire' },
  { tcgdexId: 'sv06.5',  ptcgId: 'sv6pt5',  frName: 'Fable Nébuleuse' },
  { tcgdexId: 'sv07',    ptcgId: 'sv7',     frName: 'Couronne Stellaire' },
  { tcgdexId: 'sv08',    ptcgId: 'sv8',     frName: 'Étincelles Déferlantes' },
  { tcgdexId: 'sv08.5',  ptcgId: 'sv8pt5',  frName: 'Évolutions Prismatiques' },
  { tcgdexId: 'sv09',    ptcgId: 'sv9',     frName: 'Voyage Ensemble' },
  { tcgdexId: 'sv10',    ptcgId: 'sv10',    frName: 'Destins Rivaux' },
  { tcgdexId: 'sv10.5w', ptcgId: 'rsv10pt5', frName: 'Flamme Blanche' },
  { tcgdexId: 'sv10.5b', ptcgId: 'zsv10pt5', frName: 'Flamme Noire' },
  { tcgdexId: 'svp',     ptcgId: 'svp',     frName: 'Promos Étoile Noire SV' },
]

// ─── Mapping rareté pokemontcg.io → enum Prisma ──────────────────────────────
const RARITY_MAP: Record<string, string> = {
  'Common':                    'COMMON',
  'Uncommon':                  'UNCOMMON',
  'Rare':                      'RARE',
  'Rare Holo':                 'RARE_HOLO',
  'Rare Holo EX':              'RARE_HOLO_EX',
  'Rare Holo GX':              'RARE_HOLO_GX',
  'Rare Holo V':               'RARE_HOLO_V',
  'Rare Holo VMAX':            'RARE_HOLO_VMAX',
  'Rare Holo VSTAR':           'RARE_HOLO_VSTAR',
  'Double Rare':               'RARE_ULTRA',
  'Rare Ultra':                'RARE_ULTRA',
  'Ultra Rare':                'RARE_ULTRA',
  'Rare Rainbow':              'RARE_RAINBOW',
  'Rare Secret':               'RARE_SECRET',
  'ACE SPEC Rare':             'RARE_SECRET',
  'Illustration Rare':         'ILLUSTRATION_RARE',
  'Special Illustration Rare': 'SPECIAL_ILLUSTRATION_RARE',
  'Hyper Rare':                'HYPER_RARE',
  'Trainer Gallery Rare Holo': 'TRAINER_GALLERY_HOLO',
  'Shiny Rare':                'RARE_SHINY',
  'Shiny Ultra Rare':          'RARE_SHINY_GX',
  'Amazing Rare':              'AMAZING_RARE',
  'Crown Rare':                'CROWN_RARE',
  'PROMO':                     'PROMO',
  'Promo':                     'PROMO',
  'Radiant Rare':              'RARE_SHINY',
}

function mapRarity(r: string | undefined): string {
  if (!r) return 'UNKNOWN'
  return RARITY_MAP[r] ?? 'UNKNOWN'
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Fetch all cards from a pokemontcg.io set (handles pagination) ──────────
async function fetchPtcgCards(setId: string): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    const res = await axios.get('https://api.pokemontcg.io/v2/cards', {
      params: {
        q: `set.id:${setId}`,
        pageSize: 250,
        page,
        select: 'id,name,number,rarity,supertype,subtypes,types,hp,evolvesFrom,attacks,abilities,weaknesses,resistances,retreatCost,regulationMark,nationalPokedexNumbers,illustrator,images,cardmarket,tcgplayer,flavorText',
      },
      timeout: 15000,
    })
    const cards: any[] = res.data?.data ?? []
    all.push(...cards)
    if (cards.length < 250) break
    page++
    await sleep(300)
  }
  return all
}

// ─── Fetch FR card names from TCGdex ────────────────────────────────────────
async function fetchFrNames(tcgdexId: string): Promise<Record<string, string>> {
  try {
    const res = await axios.get(`https://api.tcgdex.net/v2/fr/sets/${tcgdexId}`, { timeout: 10000 })
    const cards: any[] = res.data?.cards ?? []
    const map: Record<string, string> = {}
    for (const c of cards) {
      map[String(c.localId).padStart(3, '0')] = c.name
    }
    return map
  } catch {
    return {}
  }
}

// ─── Compute market stats ────────────────────────────────────────────────────
function computeMarketData(prices: number[], currentPrice: number, rarity: string) {
  const RARITY_RANK: Record<string, number> = {
    CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9, ILLUSTRATION_RARE: 8,
    RARE_SECRET: 8, RARE_RAINBOW: 7, RARE_ULTRA: 7, RARE_HOLO_VSTAR: 6, RARE_HOLO_VMAX: 6,
    RARE_HOLO_GX: 5, RARE_HOLO_EX: 5, RARE_HOLO_V: 5, RARE_HOLO: 4, RARE_SHINY_GX: 8,
    RARE_SHINY: 6, RARE: 3, UNCOMMON: 2, COMMON: 1, PROMO: 5, UNKNOWN: 2,
  }
  const rank = RARITY_RANK[rarity] ?? 3

  const DAYS = prices.length
  const p0 = prices[DAYS - 1]
  const change24h = DAYS > 1 ? (p0 - prices[DAYS - 2]) / (prices[DAYS - 2] + 1e-8) : 0
  const change7d = DAYS > 7 ? (p0 - prices[DAYS - 8]) / (prices[DAYS - 8] + 1e-8) : 0
  const change30d = DAYS > 30 ? (p0 - prices[DAYS - 31]) / (prices[DAYS - 31] + 1e-8) : 0

  const returns = prices.slice(1).map((p, i) => (p - prices[i]) / (prices[i] + 1e-8))
  const avgRet = returns.reduce((s, r) => s + r, 0) / Math.max(1, returns.length)
  const variance = returns.reduce((s, r) => s + (r - avgRet) ** 2, 0) / Math.max(1, returns.length)
  const vol30d = Math.sqrt(variance) * Math.sqrt(365)

  const changes14 = prices.slice(-15).map((p, i, a) => i === 0 ? 0 : p - a[i - 1])
  const gains = changes14.map((c) => Math.max(0, c))
  const losses = changes14.map((c) => Math.max(0, -c))
  const avgGain = gains.slice(1).reduce((s, v) => s + v, 0) / 14
  const avgLoss = losses.slice(1).reduce((s, v) => s + v, 0) / 14
  const rsi = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)

  const estCopies = rank >= 8 ? 800 + Math.random() * 2200 : rank >= 5 ? 3000 + Math.random() * 17000 : 15000 + Math.random() * 185000
  const marketCap = currentPrice * estCopies
  const trendDirection = vol30d > 0.8 ? 'VOLATILE' : change30d > 0.05 ? 'BULLISH' : change30d < -0.05 ? 'BEARISH' : 'STABLE'

  let investScore = 50 + rank * 4
  investScore += change7d * 100 > 15 ? 10 : change7d * 100 < -15 ? -10 : 0
  investScore += rsi < 30 ? 15 : rsi > 70 ? -10 : 0
  investScore = Math.max(0, Math.min(100, Math.round(investScore)))

  return {
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
    trendDirection,
    // Internal helpers (not stored in DB)
    _rank: rank,
    _vol30d: vol30d,
  }
}

function generatePriceHistory(currentPrice: number, days: number, vol: number): number[] {
  function randn() {
    const u = 1 - Math.random(), v = Math.random()
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  const startPrice = currentPrice * (0.75 + Math.random() * 0.5)
  const prices: number[] = [startPrice]
  for (let i = 1; i < days; i++) {
    const target = i > days - 15 ? currentPrice : startPrice
    const pull = (target - prices[i - 1]) / (days - i + 1) * 0.25
    const ret = pull / (prices[i - 1] + 1e-8) + vol * randn() * 0.6
    prices.push(Math.max(0.01, Number((prices[i - 1] * (1 + ret)).toFixed(3))))
  }
  prices[days - 1] = currentPrice
  return prices
}

// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🚀 Seed complet de tous les sets SV...\n')

  // Vider toutes les données existantes
  console.log('🗑  Nettoyage des données existantes...')
  await prisma.pricePrediction.deleteMany()
  await prisma.cardAiAnalysis.deleteMany()
  await prisma.cardMarketData.deleteMany()
  await prisma.priceHistory.deleteMany()
  await prisma.cardPrice.deleteMany()
  await prisma.saleEvent.deleteMany()
  await prisma.popularityMetric.deleteMany()
  await prisma.watchlistItem.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.portfolioItem.deleteMany()
  await prisma.card.deleteMany()
  await prisma.pokemonSet.deleteMany()
  await prisma.marketIndex.deleteMany()
  console.log('✅ Tables vidées\n')

  // Seed MarketIndex (GLOBAL, 90j)
  const now = new Date()
  const DAYS = 90
  const idxSeries = generatePriceHistory(1000, DAYS, 0.012)
  await prisma.marketIndex.createMany({
    data: idxSeries.map((value, i) => {
      const date = new Date(now)
      date.setDate(date.getDate() - (DAYS - 1 - i))
      return { indexType: 'GLOBAL', value: Number(value.toFixed(4)), recordedAt: date }
    }),
  })
  for (const [type, base, vol] of [['VINTAGE', 2500, 0.008], ['MODERN', 750, 0.015], ['SEALED', 1200, 0.010]] as const) {
    const series = generatePriceHistory(base, DAYS, vol)
    await prisma.marketIndex.createMany({
      data: series.map((value, i) => {
        const date = new Date(now)
        date.setDate(date.getDate() - (DAYS - 1 - i))
        return { indexType: type, value: Number(value.toFixed(4)), recordedAt: date }
      }),
    })
  }
  console.log('📈 MarketIndex seeded\n')

  let totalCards = 0

  for (const setConfig of SETS) {
    const { tcgdexId, ptcgId, frName } = setConfig
    console.log(`\n📦 ${ptcgId} — ${frName}`)

    // 1. Fetch cards from pokemontcg.io
    let ptcgCards: any[]
    try {
      ptcgCards = await fetchPtcgCards(ptcgId)
      console.log(`   ${ptcgCards.length} cartes depuis pokemontcg.io`)
    } catch (e: any) {
      console.log(`   ⚠ Erreur pokemontcg.io: ${e.message} — skip`)
      continue
    }

    if (ptcgCards.length === 0) {
      console.log(`   ⚠ Aucune carte trouvée — skip`)
      continue
    }

    // 2. Fetch FR names from TCGdex
    let frNames: Record<string, string> = {}
    try {
      frNames = await fetchFrNames(tcgdexId)
      console.log(`   ${Object.keys(frNames).length} noms FR récupérés`)
    } catch {
      console.log(`   ⚠ Noms FR indisponibles`)
    }
    await sleep(200)

    // 3. Upsert PokemonSet
    const setInfo = ptcgCards[0]?.set ?? {}
    const releaseDate = setInfo.releaseDate
      ? new Date(setInfo.releaseDate.replace(/\//g, '-') + 'T00:00:00Z')
      : new Date('2023-01-01')

    const dbSet = await prisma.pokemonSet.upsert({
      where: { externalId: tcgdexId },
      create: {
        externalId: tcgdexId,
        name: setInfo.name ?? frName,
        series: setInfo.series?.name ?? 'Scarlet & Violet',
        language: 'EN',
        releaseDate,
        totalCards: setInfo.total ?? ptcgCards.length,
        printedTotal: setInfo.printedTotal ?? ptcgCards.length,
        symbolUrl: setInfo.images?.symbol ?? null,
        logoUrl: setInfo.images?.logo ?? null,
      },
      update: {
        totalCards: setInfo.total ?? ptcgCards.length,
        logoUrl: setInfo.images?.logo ?? null,
        symbolUrl: setInfo.images?.symbol ?? null,
      },
    })

    // 4. Insert cards + prices
    let cardCount = 0
    const RARITY_VOLATILITY: Record<string, number> = {
      CROWN_RARE: 0.048, HYPER_RARE: 0.042, SPECIAL_ILLUSTRATION_RARE: 0.040,
      ILLUSTRATION_RARE: 0.036, RARE_SECRET: 0.034, RARE_RAINBOW: 0.032,
      RARE_ULTRA: 0.030, RARE_HOLO_VSTAR: 0.026, RARE_HOLO_VMAX: 0.024,
      RARE_HOLO: 0.020, RARE: 0.016, UNCOMMON: 0.010, COMMON: 0.007,
      PROMO: 0.025, UNKNOWN: 0.014,
    }

    for (const ptcgCard of ptcgCards) {
      const rarity = mapRarity(ptcgCard.rarity)
      const number = ptcgCard.number?.padStart(3, '0') ?? '000'
      const externalId = `${tcgdexId}-${number}`
      const frCardName = frNames[number]

      // Card
      const card = await prisma.card.upsert({
        where: { externalId },
        create: {
          externalId,
          setId: dbSet.id,
          name: ptcgCard.name,
          localeName: frCardName ? { en: ptcgCard.name, fr: frCardName } : { en: ptcgCard.name },
          number,
          supertype: ptcgCard.supertype ?? 'Pokemon',
          subtypes: ptcgCard.subtypes ?? [],
          types: ptcgCard.types ?? [],
          rarity: rarity as any,
          language: 'EN',
          imageSmUrl: ptcgCard.images?.small ?? null,
          imageLgUrl: ptcgCard.images?.large ?? null,
          illustrator: ptcgCard.illustrator ?? null,
          flavorText: ptcgCard.flavorText ?? null,
          hp: ptcgCard.hp ? parseInt(ptcgCard.hp) : null,
          evolvesFrom: ptcgCard.evolvesFrom ?? null,
          attacks: ptcgCard.attacks ?? [],
          abilities: ptcgCard.abilities ?? [],
          weaknesses: ptcgCard.weaknesses ?? [],
          resistances: ptcgCard.resistances ?? [],
          retreatCost: ptcgCard.retreatCost ?? [],
          regulationMark: ptcgCard.regulationMark ?? null,
          nationalPokedexNumbers: ptcgCard.nationalPokedexNumbers ?? [],
        },
        update: {
          localeName: frCardName ? { en: ptcgCard.name, fr: frCardName } : { en: ptcgCard.name },
          imageSmUrl: ptcgCard.images?.small ?? null,
          imageLgUrl: ptcgCard.images?.large ?? null,
          rarity: rarity as any,
        },
      })

      // Prices
      const cm = ptcgCard.cardmarket?.prices
      const tcg = ptcgCard.tcgplayer?.prices
      const tcgHolo = tcg?.holofoil
      const tcgNormal = tcg?.normal
      const tcgFallback = (tcgHolo?.market ?? tcgNormal?.market ?? 0) * 0.92

      const cmMarket = (cm?.trendPrice || cm?.averageSellPrice)
        ? (cm?.trendPrice ?? cm?.averageSellPrice ?? 0)
        : tcgFallback
      const cmLow = cm?.lowPrice ?? cmMarket * 0.78
      const cmHigh = cmMarket * 1.4
      const cmReverse = cm?.reverseHoloTrend ?? cm?.reverseHoloSell ?? 0
      const tcgMarket = tcgHolo?.market ?? tcgNormal?.market ?? 0

      const priceEntries: any[] = []
      if (cmMarket > 0) {
        priceEntries.push({
          cardId: card.id, source: 'cardmarket', variant: 'NORMAL',
          low: Number(Math.max(0.01, cmLow).toFixed(2)),
          mid: Number((cmMarket * 1.08).toFixed(2)),
          high: Number(cmHigh.toFixed(2)),
          market: Number(cmMarket.toFixed(2)),
          directLow: Number(Math.max(0.01, cmLow * 0.9).toFixed(2)),
          currency: 'EUR',
        })
      }
      if (cmReverse > 0 && Math.abs(cmReverse - cmMarket) > 0.01) {
        priceEntries.push({
          cardId: card.id, source: 'cardmarket', variant: 'REVERSE_HOLO',
          low: Number(Math.max(0.01, (cm?.reverseHoloLow ?? cmReverse * 0.8)).toFixed(2)),
          mid: Number((cmReverse * 1.05).toFixed(2)),
          high: Number((cmReverse * 1.35).toFixed(2)),
          market: Number(cmReverse.toFixed(2)),
          directLow: Number(Math.max(0.01, cmReverse * 0.75).toFixed(2)),
          currency: 'EUR',
        })
      }
      if (tcgMarket > 0) {
        priceEntries.push({
          cardId: card.id, source: 'tcgplayer', variant: tcgHolo ? 'HOLO' : 'NORMAL',
          low: Number(((tcgHolo ?? tcgNormal)?.low ?? tcgMarket * 0.8).toFixed(2)),
          mid: Number(((tcgHolo ?? tcgNormal)?.mid ?? tcgMarket).toFixed(2)),
          high: Number(((tcgHolo ?? tcgNormal)?.high ?? tcgMarket * 1.3).toFixed(2)),
          market: Number(tcgMarket.toFixed(2)),
          currency: 'USD',
        })
      }
      if (priceEntries.length > 0) {
        await prisma.cardPrice.createMany({ data: priceEntries, skipDuplicates: true })
      }

      // Price history + market data
      const currentPrice = cmMarket > 0 ? cmMarket : tcgFallback > 0 ? tcgFallback : 0.05
      const vol = RARITY_VOLATILITY[rarity] ?? 0.015
      const priceSeries = generatePriceHistory(currentPrice, DAYS, vol)

      await prisma.priceHistory.createMany({
        data: priceSeries.map((price, i) => {
          const date = new Date(now)
          date.setDate(date.getDate() - (DAYS - 1 - i))
          return { cardId: card.id, source: 'cardmarket', variant: 'NORMAL', price: Number(price.toFixed(2)), volume: Math.floor(Math.random() * 20) + 1, currency: 'EUR', recordedAt: date }
        }),
      })

      const md = computeMarketData(priceSeries, currentPrice, rarity)
      await prisma.cardMarketData.upsert({
        where: { cardId: card.id },
        create: { cardId: card.id, ...{ ...md, _rank: undefined, _vol30d: undefined } as any },
        update: { ...md, _rank: undefined, _vol30d: undefined } as any,
      })

      // Recent sales (3-8 per card)
      const salesCount = Math.floor(Math.random() * 6) + 3
      await prisma.saleEvent.createMany({
        data: Array.from({ length: salesCount }, () => {
          const daysAgo = Math.floor(Math.random() * 30)
          const saleDate = new Date(now)
          saleDate.setDate(saleDate.getDate() - daysAgo)
          return {
            cardId: card.id, source: 'ebay', variant: 'NORMAL',
            salePrice: Number(Math.max(0.01, currentPrice * (0.83 + Math.random() * 0.34)).toFixed(2)),
            currency: 'EUR',
            platform: Math.random() > 0.45 ? 'eBay' : 'Cardmarket',
            condition: ['Near Mint', 'Lightly Played', 'Moderately Played'][Math.floor(Math.random() * 3)],
            soldAt: saleDate,
          }
        }),
        skipDuplicates: true,
      })

      // AI Analysis
      const confBase = Math.max(0.3, Math.min(0.9, 1 - md._vol30d * 0.3))
      const roi30 = Number(md.priceChange30d) * 0.7

      await prisma.cardAiAnalysis.upsert({
        where: { cardId: card.id },
        create: {
          cardId: card.id,
          investmentScore: md.investmentScore, rarityScore: md.rarityScore, liquidityScore: md.liquidityScore,
          riskLevel: Math.max(10, Math.min(90, Math.round(30 + md._vol30d * 20))),
          predictedRoi30d: Number(Math.max(-0.8, Math.min(3.0, roi30 / 100)).toFixed(4)),
          predictedRoi90d: Number(Math.max(-0.8, Math.min(3.0, roi30 / 100 * 0.5)).toFixed(4)),
          trendDirection: md.trendDirection as any,
          confidenceScore: Number(confBase.toFixed(4)),
          bullishSignals: Number(md.priceChange7d) > 0.05 ? ['Momentum positif 7j'] : [],
          bearishSignals: Number(md.priceChange7d) < -0.05 ? ['Pression vendeuse récente'] : [],
          keyInsight: `Prix réel: ${currentPrice.toFixed(2)}€. Score ${md.investmentScore}/100.`,
          modelVersion: 'scorer-ts-v1',
          predictions: {
            create: [7, 30, 90].map((days) => {
              const decay = days === 7 ? 0.9 : days === 30 ? 0.7 : 0.5
              const predicted = currentPrice * (1 + roi30 / 100 * decay * days / 30)
              const uncertainty = currentPrice * (0.04 + md._vol30d * 0.04 * days / 30)
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
        update: {
          investmentScore: md.investmentScore, rarityScore: md.rarityScore,
          trendDirection: md.trendDirection as any,
          keyInsight: `Prix réel: ${currentPrice.toFixed(2)}€. Score ${md.investmentScore}/100.`,
        },
      })

      cardCount++
      totalCards++
    }

    console.log(`   ✅ ${cardCount} cartes insérées`)
    await sleep(400) // Respecter le rate limit
  }

  // Stats finales
  const [cards, prices, history, ai, sales, idx] = await Promise.all([
    prisma.card.count(), prisma.cardPrice.count(), prisma.priceHistory.count(),
    prisma.cardAiAnalysis.count(), prisma.saleEvent.count(), prisma.marketIndex.count(),
  ])

  console.log(`\n🎉 Seed terminé !`)
  console.log(`\n📊 Résumé:`)
  console.log(`  Sets     : ${SETS.length}`)
  console.log(`  Cards    : ${cards}`)
  console.log(`  Prices   : ${prices}`)
  console.log(`  History  : ${history}`)
  console.log(`  AI       : ${ai}`)
  console.log(`  Sales    : ${sales}`)
  console.log(`  Idx pts  : ${idx}`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
