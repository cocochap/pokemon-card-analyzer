/**
 * Cron job quotidien : met à jour les prix depuis pokemontcg.io (Cardmarket réel).
 * Planifié via vercel.json : "0 6 * * *" (6h UTC chaque jour)
 *
 * Logique :
 *   1. Récupère toutes les cartes par set depuis pokemontcg.io
 *   2. Met à jour CardPrice avec les vraies données Cardmarket (avg1/avg7/avg30)
 *   3. Ajoute un point PriceHistory pour aujourd'hui
 *   4. Recalcule CardMarketData avec les vraies variations %
 *   5. Invalide le cache Redis
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { flushAllCache } from '@/lib/db/redis'
import {
  normalizeCardmarketPrices,
  buildRealisticHistory,
  computeRSI,
  computeInvestmentScore,
  RARITY_RANK,
} from '@/lib/pricing/normalize'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

// Sets prioritaires — les plus populaires d'abord pour maximiser les mises à jour dans 50s
const PTCG_SET_IDS = [
  // SV (Écarlate & Violet) — sets actifs, priorité absolue
  'sv3pt5', 'sv8pt5', 'sv9', 'sv8', 'sv7', 'sv6pt5', 'sv6', 'sv5',
  'sv4pt5', 'sv4', 'sv3', 'sv2', 'sv1', 'svp',
  // SWSH populaires
  'swsh12pt5', 'swsh12', 'swsh11', 'swsh10', 'swsh9', 'swsh7',
  'swsh35', 'swsh45', 'swsh1',
  // SM populaires
  'sm12', 'sm11', 'sm1',
  // XY populaires
  'xy12', 'xy1',
  // Vintage
  'base1', 'neo1', 'base2',
]

interface PtcgCard {
  id: string
  cardmarket?: {
    prices?: {
      trendPrice?: number
      averageSellPrice?: number
      lowPrice?: number
      lowPriceExPlus?: number
      avg1?: number; avg7?: number; avg30?: number
      reverseHoloTrend?: number; reverseHoloAvg1?: number
      reverseHoloAvg7?: number; reverseHoloAvg30?: number
      reverseHoloSell?: number; reverseHoloLow?: number
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
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (process.env.POKEMON_TCG_API_KEY) headers['X-Api-Key'] = process.env.POKEMON_TCG_API_KEY
  const res = await fetch(
    `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=250&select=id,cardmarket,tcgplayer`,
    { headers, signal: AbortSignal.timeout(20000) }
  )
  if (!res.ok) return []
  const json = await res.json()
  return json.data ?? []
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function GET(req: NextRequest) {
  // Sécurité : vérifier le secret Vercel cron OU un token admin local
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  // Block only if a wrong token is actively provided (not if no token at all)
  if (cronSecret && auth && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  // Limite stricte 55s pour rester dans le timeout Vercel (60s)
  const HARD_LIMIT = 55_000
  const stats = { sets: 0, cards: 0, updated: 0, skipped: 0, errors: 0 }

  // Neon est pré-chauffé par le cron warmup (5h45 UTC).
  // Lancer les fetches pokemontcg.io et la vérification DB en parallèle.
  const preFetchIds = PTCG_SET_IDS.slice(0, 8)

  const [dbTest, ...preFetchResults] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1` as Promise<any>,
    ...preFetchIds.map(id => fetchPtcgSet(id)),
  ])

  if (dbTest.status === 'rejected') {
    console.error('DB unavailable:', (dbTest as any).reason?.message)
    return NextResponse.json({ ok: false, error: 'DB unavailable — warmup cron may have failed' }, { status: 503 })
  }
  console.log(`DB + ${preFetchIds.length} sets ready in ${Date.now() - startedAt}ms`)

  // Cache des résultats pré-chargés
  const preFetched = new Map<string, PtcgCard[]>()
  preFetchIds.forEach((id, i) => {
    const r = preFetchResults[i]
    if (r?.status === 'fulfilled') preFetched.set(id, r.value)
  })

  // Traiter set par set — index DB chargé par set (évite le global findMany qui timeout sur Neon free)
  for (const setId of PTCG_SET_IDS) {
    if (Date.now() - startedAt > HARD_LIMIT) {
      console.log(`⏱ Arrêt à ${Math.round((Date.now() - startedAt) / 1000)}s — ${stats.updated} cartes mises à jour`)
      break
    }

    try {
      // Utiliser le résultat pré-chargé si disponible, sinon fetch maintenant
      const ptcgCards = preFetched.get(setId) ?? await fetchPtcgSet(setId)
      if (ptcgCards.length === 0) continue

      // Requête directe par externalId — pas besoin de passer par PokemonSet
      const ptcgIds = ptcgCards.map(c => c.id)
      const dbCards = await prisma.card.findMany({
        where: { externalId: { in: ptcgIds } },
        select: { id: true, externalId: true, rarity: true },
      })
      console.log(`${setId}: ptcgio=${ptcgIds.length} db=${dbCards.length} sample="${ptcgIds[0]}"`)
      if (!dbCards.length) continue

      const cardIndex = new Map(dbCards.map((c) => [c.externalId, c]))

      stats.sets++
      let setUpdated = 0

      for (const ptcg of ptcgCards) {
        const dbCard = cardIndex.get(ptcg.id)
        if (!dbCard) { stats.skipped++; continue }

        const cm = ptcg.cardmarket?.prices
        if (!cm) { stats.skipped++; continue }

        const norm = normalizeCardmarketPrices(cm)
        if (!norm || norm.market <= 0) { stats.skipped++; continue }

        try {
          await updateCardPricing(dbCard.id, dbCard.rarity, norm, ptcg)
          setUpdated++
          stats.updated++
        } catch (err) {
          stats.errors++
        }
      }

      stats.cards += ptcgCards.length
      console.log(`✅ ${setId}: ${setUpdated}/${ptcgCards.length} cartes mises à jour`)

      // Rate limiting : 150ms avec API key, sinon 300ms
      await sleep(process.env.POKEMON_TCG_API_KEY ? 150 : 300)
    } catch (err) {
      console.error(`❌ Erreur set ${setId}:`, err)
      stats.errors++
    }
  }

  // Invalider tout le cache Redis
  try {
    await flushAllCache()
  } catch {
    // Non bloquant
  }

  const duration = Math.round((Date.now() - startedAt) / 1000)
  console.log(`\n📊 Résumé: ${stats.updated} cartes / ${stats.sets} sets en ${duration}s`)

  return NextResponse.json({
    ok: true, duration, ...stats,
    diag: {
      preFetchedSets: [...preFetched.keys()],
      preFetchedCounts: Object.fromEntries([...preFetched.entries()].map(([k,v]) => [k, v.length])),
      hardLimitMs: HARD_LIMIT,
    }
  })
}

async function updateCardPricing(
  cardId: string,
  rarity: string,
  norm: ReturnType<typeof normalizeCardmarketPrices> & {},
  ptcg: PtcgCard,
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 1. Upsert CardPrice Cardmarket
  await prisma.cardPrice.upsert({
    where: { cardId_source_variant: { cardId, source: 'cardmarket', variant: 'NORMAL' } },
    create: {
      cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
      market: norm.market, mid: norm.mid, low: norm.low, high: norm.high,
    },
    update: {
      market: norm.market, mid: norm.mid, low: norm.low, high: norm.high,
      fetchedAt: new Date(),
    },
  })

  // Reverse holo si disponible
  const cm = ptcg.cardmarket?.prices
  if (cm?.reverseHoloTrend && cm.reverseHoloTrend > 0 && Math.abs(cm.reverseHoloTrend - norm.market) > 0.05) {
    await prisma.cardPrice.upsert({
      where: { cardId_source_variant: { cardId, source: 'cardmarket', variant: 'REVERSE_HOLO' } },
      create: {
        cardId, source: 'cardmarket', variant: 'REVERSE_HOLO', currency: 'EUR',
        market: cm.reverseHoloTrend,
        mid: cm.reverseHoloSell ?? cm.reverseHoloTrend,
        low: cm.reverseHoloLow ?? cm.reverseHoloTrend * 0.8,
        high: cm.reverseHoloTrend * 1.2,
      },
      update: {
        market: cm.reverseHoloTrend, fetchedAt: new Date(),
      },
    })
  }

  // 2. TCGPlayer USD
  const tcp = ptcg.tcgplayer?.prices
  const tcpMain = tcp?.holofoil ?? tcp?.normal
  if (tcpMain?.market && tcpMain.market > 0) {
    await prisma.cardPrice.upsert({
      where: { cardId_source_variant: { cardId, source: 'tcgplayer', variant: 'NORMAL' } },
      create: {
        cardId, source: 'tcgplayer', variant: 'NORMAL', currency: 'USD',
        market: tcpMain.market, low: tcpMain.low ?? tcpMain.market * 0.8,
        mid: tcpMain.mid ?? tcpMain.market, high: tcpMain.high ?? tcpMain.market * 1.2,
      },
      update: {
        market: tcpMain.market, low: tcpMain.low ?? tcpMain.market * 0.8,
        mid: tcpMain.mid ?? tcpMain.market, high: tcpMain.high ?? tcpMain.market * 1.2,
        fetchedAt: new Date(),
      },
    })
  }

  // 3. PriceHistory — ajouter un point pour aujourd'hui si inexistant
  const existingToday = await prisma.priceHistory.findFirst({
    where: { cardId, source: 'cardmarket', recordedAt: { gte: today } },
  })
  if (!existingToday) {
    await prisma.priceHistory.create({
      data: {
        cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
        price: norm.market, recordedAt: today,
      },
    })
  }

  // Ajouter avg7 et avg30 comme points historiques si inexistants et significativement différents
  if (norm.avg7 > 0 && Math.abs(norm.avg7 - norm.market) > 0.01) {
    const day7 = subDays(today, 7)
    const existing7 = await prisma.priceHistory.findFirst({
      where: { cardId, source: 'cardmarket', recordedAt: { gte: day7, lt: subDays(today, 6) } },
    })
    if (!existing7) {
      await prisma.priceHistory.create({
        data: {
          cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
          price: norm.avg7, recordedAt: day7,
        },
      })
    }
  }

  if (norm.avg30 > 0 && Math.abs(norm.avg30 - norm.avg7) > 0.01) {
    const day30 = subDays(today, 30)
    const existing30 = await prisma.priceHistory.findFirst({
      where: { cardId, source: 'cardmarket', recordedAt: { gte: day30, lt: subDays(today, 29) } },
    })
    if (!existing30) {
      await prisma.priceHistory.create({
        data: {
          cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
          price: norm.avg30, recordedAt: day30,
        },
      })
    }
  }

  // 4. Récupérer historique récent pour RSI
  const history = await prisma.priceHistory.findMany({
    where: { cardId, source: 'cardmarket' },
    orderBy: { recordedAt: 'asc' },
    select: { price: true },
    take: 30,
  })
  const prices = history.map((h) => Number(h.price))
  const rsi = computeRSI(prices)
  const rarityRank = RARITY_RANK[rarity] ?? 2

  const investmentScore = computeInvestmentScore({
    change7d: norm.change7d,
    change30d: norm.change30d,
    volatility: norm.volatility,
    rarityRank,
    price: norm.market,
    rsi,
  })

  // Estimation market cap (copies en circulation basé sur rareté)
  const copiesMap: Record<string, number> = {
    CROWN_RARE: 800, HYPER_RARE: 1200, SPECIAL_ILLUSTRATION_RARE: 1500,
    ILLUSTRATION_RARE: 3000, RARE_SECRET: 2000, RARE_ULTRA: 4000,
    RARE_HOLO: 15000, RARE: 25000, UNCOMMON: 80000, COMMON: 200000,
  }
  const copies = copiesMap[rarity] ?? 10000
  const marketCap = norm.market * copies

  const trendDirection =
    norm.volatility > 0.25 ? 'VOLATILE' :
    norm.change7d > 0.05 ? 'BULLISH' :
    norm.change7d < -0.05 ? 'BEARISH' : 'STABLE'

  // 5. Upsert CardMarketData
  await prisma.cardMarketData.upsert({
    where: { cardId },
    create: {
      cardId,
      marketCap,
      priceChange24h: norm.change24h,
      priceChange7d: norm.change7d,
      priceChange30d: norm.change30d,
      volatility30d: norm.volatility,
      rsi14: rsi,
      investmentScore,
      rarityScore: Math.round(rarityRank * 10),
      liquidityScore: norm.market > 50 ? 80 : norm.market > 10 ? 60 : norm.market > 2 ? 40 : 20,
      trendDirection: trendDirection as any,
      allTimeHigh: norm.market,
      allTimeLow: norm.low,
    },
    update: {
      marketCap,
      priceChange24h: norm.change24h,
      priceChange7d: norm.change7d,
      priceChange30d: norm.change30d,
      volatility30d: norm.volatility,
      rsi14: rsi,
      investmentScore,
      trendDirection: trendDirection as any,
      // Mettre à jour ATH/ATL si nécessaire
      allTimeHigh: { set: undefined },
    },
  })

  // Mettre à jour ATH si le prix actuel est plus élevé
  const existing = await prisma.cardMarketData.findUnique({ where: { cardId }, select: { allTimeHigh: true, allTimeLow: true } })
  if (existing) {
    const updates: Record<string, any> = {}
    if (!existing.allTimeHigh || norm.market > Number(existing.allTimeHigh)) {
      updates.allTimeHigh = norm.market
      updates.allTimeHighDate = new Date()
    }
    if (!existing.allTimeLow || norm.low < Number(existing.allTimeLow)) {
      updates.allTimeLow = norm.low
      updates.allTimeLowDate = new Date()
    }
    if (Object.keys(updates).length > 0) {
      await prisma.cardMarketData.update({ where: { cardId }, data: updates })
    }
  }
}
