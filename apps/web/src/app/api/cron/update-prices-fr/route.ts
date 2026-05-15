/**
 * Cron quotidien — mise à jour des prix Cardmarket français depuis pokecardex.com
 * Planifié via vercel.json : "0 7 * * *" (7h UTC chaque jour)
 *
 * Traite les sets prioritaires SV + SWSH en priorité.
 * Limite : ~200 cartes par run pour rester dans les 300s Vercel.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { fetchDecrypt, fetchCardPrice } from '@/lib/pokecardex/decrypt'
import { computeInvestmentScore, RARITY_RANK } from '@/lib/pricing/normalize'
import { flushAllCache } from '@/lib/db/redis'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Sets prioritaires à mettre à jour chaque jour (par ordre d'importance)
const PRIORITY_SETS: Array<{ code: string; setId: string }> = [
  // SV (actuels)
  { code: 'SSP',  setId: 'sv8' },
  { code: 'PRE',  setId: 'sv8pt5' },
  { code: 'SCR',  setId: 'sv7' },
  { code: 'SFA',  setId: 'sv6pt5' },
  { code: 'TWM',  setId: 'sv6' },
  { code: 'TEF',  setId: 'sv5' },
  { code: 'PAF',  setId: 'sv4pt5' },
  { code: 'PAR',  setId: 'sv4' },
  { code: 'MEW',  setId: 'sv3pt5' },
  { code: 'OBF',  setId: 'sv3' },
  { code: 'PAL',  setId: 'sv2' },
  { code: 'SVI',  setId: 'sv1' },
  // SWSH populaires
  { code: 'CRZ',  setId: 'swsh12pt5' },
  { code: 'SIT',  setId: 'swsh12' },
  { code: 'LOR',  setId: 'swsh11' },
  { code: 'ASR',  setId: 'swsh10' },
  { code: 'BRS',  setId: 'swsh9' },
  { code: 'CEL',  setId: 'cel25' },
  { code: 'FST',  setId: 'swsh8' },
  { code: 'EVS',  setId: 'swsh7' },
  { code: 'CRE',  setId: 'swsh6' },
  { code: 'PGO',  setId: 'pgo' },
]

async function upsertPrice(
  cardId: string, rarity: string,
  market: number, low: number, avg7: number, avg30: number
) {
  const mid  = market
  const high = market * 1.35
  const change7d  = avg7  > 0 ? (market - avg7)  / avg7  : 0
  const change30d = avg30 > 0 ? (market - avg30) / avg30 : 0
  const volatility = avg30 > 0 ? Math.abs(change30d) : 0
  const today = new Date(); today.setHours(0, 0, 0, 0)

  await prisma.cardPrice.upsert({
    where: { cardId_source_variant: { cardId, source: 'cardmarket', variant: 'NORMAL' } },
    create: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', market, mid, low, high },
    update: { market, mid, low, high, fetchedAt: new Date() },
  })

  const todayExists = await prisma.priceHistory.findFirst({
    where: { cardId, source: 'cardmarket', recordedAt: { gte: today } },
  })
  if (!todayExists) {
    await prisma.priceHistory.create({
      data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: market, recordedAt: today },
    })
  }

  if (avg7 > 0 && Math.abs(avg7 - market) > 0.01) {
    const d7 = subDays(today, 7)
    const ex7 = await prisma.priceHistory.findFirst({ where: { cardId, source: 'cardmarket', recordedAt: { gte: d7, lt: subDays(today, 6) } } })
    if (!ex7) await prisma.priceHistory.create({ data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: avg7, recordedAt: d7 } })
  }

  const rarityRank = RARITY_RANK[rarity] ?? 2
  const score = computeInvestmentScore({ change7d, change30d, volatility, rarityRank, price: market, rsi: 50 })
  const trend = volatility > 0.25 ? 'VOLATILE' : change7d > 0.05 ? 'BULLISH' : change7d < -0.05 ? 'BEARISH' : 'STABLE'
  const copiesMap: Record<string, number> = { CROWN_RARE: 800, HYPER_RARE: 1200, SPECIAL_ILLUSTRATION_RARE: 1500, ILLUSTRATION_RARE: 3000, RARE_SECRET: 2000, RARE_ULTRA: 4000, RARE_HOLO: 15000, RARE: 25000, UNCOMMON: 80000, COMMON: 200000 }

  await prisma.cardMarketData.upsert({
    where: { cardId },
    create: { cardId, marketCap: market * (copiesMap[rarity] ?? 10000), priceChange24h: 0, priceChange7d: change7d, priceChange30d: change30d, volatility30d: volatility, rsi14: 50, investmentScore: score, rarityScore: Math.round(rarityRank * 10), liquidityScore: market > 50 ? 80 : market > 10 ? 60 : market > 2 ? 40 : 20, trendDirection: trend as any, allTimeHigh: market, allTimeLow: low },
    update: { priceChange7d: change7d, priceChange30d: change30d, volatility30d: volatility, investmentScore: score, trendDirection: trend as any, marketCap: market * (copiesMap[rarity] ?? 10000) },
  })
}

export async function GET(req: NextRequest) {
  // Auth
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startedAt = Date.now()
  const TIMEOUT = 250_000
  const CARDS_PER_SET = 10  // cartes à mettre à jour par set (pour tenir dans 300s)
  const stats = { sets: 0, cards: 0, updated: 0, errors: 0 }

  for (const { code, setId } of PRIORITY_SETS) {
    if (Date.now() - startedAt > TIMEOUT) break

    // Trouver le set en DB
    const dbSet = await prisma.pokemonSet.findFirst({ where: { externalId: setId } })
    if (!dbSet) continue

    // Fetch la page série pokecardex
    const seriesData = await fetchDecrypt(`/series/${code}`)
    if (!seriesData) { stats.errors++; continue }

    const pokecardexCards: any[] = seriesData.cartes ?? []
    // Prioriser les cartes qui n'ont pas de prix ou dont le prix est vieux (> 23h)
    const threshold = new Date(Date.now() - 23 * 60 * 60 * 1000)

    const cardsToUpdate = pokecardexCards.slice(0, CARDS_PER_SET)
    stats.sets++

    for (const pcCard of cardsToUpdate) {
      if (Date.now() - startedAt > TIMEOUT) break

      const numCard = String(pcCard.num_card ?? '').trim()
      const idCard  = pcCard.id_card as number
      if (!numCard || !idCard) continue

      try {
        const numClean = numCard.replace(/^0+(?=[0-9])/, '')
        const dbCard = await prisma.card.findFirst({
          where: {
            setId: dbSet.id,
            OR: [{ number: numCard }, { number: numClean }, { number: numCard.padStart(3, '0') }],
          },
          select: { id: true, rarity: true },
        })
        if (!dbCard) { stats.errors++; continue }

        // Vérifier si le prix est récent
        const recent = await prisma.cardPrice.findFirst({
          where: { cardId: dbCard.id, source: 'cardmarket', fetchedAt: { gte: threshold } },
        })
        if (recent) continue  // Déjà à jour

        const prices = await fetchCardPrice(idCard)
        if (!prices || !prices.trendPrice) { await sleep(300); continue }

        await upsertPrice(
          dbCard.id, dbCard.rarity,
          prices.trendPrice ?? prices.averageSellPrice,
          prices.lowPrice ?? 0,
          prices.avg7 ?? 0,
          prices.avg30 ?? 0
        )
        stats.updated++
        stats.cards++
        await sleep(600)  // Rate limiting
      } catch { stats.errors++ }
    }

    console.log(`✅ ${code}: ${CARDS_PER_SET} cartes traitées`)
    await sleep(500)
  }

  // Invalider le cache Redis
  try { await flushAllCache() } catch { }

  const duration = Math.round((Date.now() - startedAt) / 1000)
  console.log(`📊 Cron FR: ${stats.updated} prix mis à jour / ${stats.sets} sets en ${duration}s`)

  return NextResponse.json({ ok: true, duration, ...stats })
}
