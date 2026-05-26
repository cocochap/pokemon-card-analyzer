/**
 * Cron catch-all — tourne à 10h UTC après update-prices (6h) et update-prices-fr (7h).
 * Garantit que TOUTES les cartes ayant un prix ont un point PriceHistory pour aujourd'hui
 * et un backfill -7j/-30j. Aucun appel API — purement DB, requêtes parallèles.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkCronAuth } from '@/lib/cron-auth'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const authErr = checkCronAuth(req)
  if (authErr) return authErr

  const now = new Date()
  const today = new Date(now); today.setHours(0, 0, 0, 0)
  const day7 = subDays(today, 7)
  const day30 = subDays(today, 30)

  // Toutes les cartes avec un prix + leurs données de marché — en parallèle
  const [allPrices, marketData] = await Promise.all([
    prisma.cardPrice.findMany({
      where: { source: 'cardmarket', market: { gt: 0 } },
      select: { cardId: true, market: true },
    }),
    prisma.cardMarketData.findMany({
      select: { cardId: true, priceChange7d: true, priceChange30d: true },
    }),
  ])

  if (allPrices.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'Aucun prix en base' })
  }

  const cardIds = allPrices.map(p => p.cardId)
  const priceMap = new Map(allPrices.map(p => [p.cardId, Number(p.market)]))

  // Vérifier les points existants aujourd'hui + -7j + -30j en parallèle
  const [existingToday, existing7, existing30] = await Promise.all([
    prisma.priceHistory.findMany({
      where: { cardId: { in: cardIds }, source: 'cardmarket', recordedAt: { gte: today } },
      select: { cardId: true },
    }),
    prisma.priceHistory.findMany({
      where: { cardId: { in: cardIds }, source: 'cardmarket', recordedAt: { gte: day7, lt: subDays(today, 6) } },
      select: { cardId: true },
    }),
    prisma.priceHistory.findMany({
      where: { cardId: { in: cardIds }, source: 'cardmarket', recordedAt: { gte: day30, lt: subDays(today, 29) } },
      select: { cardId: true },
    }),
  ])

  const todaySet = new Set(existingToday.map(h => h.cardId))
  const has7Set = new Set(existing7.map(h => h.cardId))
  const has30Set = new Set(existing30.map(h => h.cardId))

  // Préparer les données à insérer
  const missingToday = allPrices.filter(p => !todaySet.has(p.cardId))
  const backfill7: { cardId: string; price: number }[] = []
  const backfill30: { cardId: string; price: number }[] = []

  for (const md of marketData) {
    const market = priceMap.get(md.cardId)
    if (!market) continue
    const c7d = Number(md.priceChange7d ?? 0)
    const c30d = Number(md.priceChange30d ?? 0)
    const avg7 = c7d !== 0 ? market / (1 + c7d) : market
    const avg30 = c7d !== 0 && c30d !== 0 ? avg7 / (1 + c30d) : avg7
    if (!has7Set.has(md.cardId) && avg7 > 0) backfill7.push({ cardId: md.cardId, price: +avg7.toFixed(2) })
    if (!has30Set.has(md.cardId) && avg30 > 0) backfill30.push({ cardId: md.cardId, price: +avg30.toFixed(2) })
  }

  // Insérer tout en parallèle
  await Promise.all([
    missingToday.length > 0 ? prisma.priceHistory.createMany({
      data: missingToday.map(p => ({ cardId: p.cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: Number(p.market), recordedAt: today })),
      skipDuplicates: true,
    }) : Promise.resolve(),
    backfill7.length > 0 ? prisma.priceHistory.createMany({
      data: backfill7.map(b => ({ cardId: b.cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: b.price, recordedAt: day7 })),
      skipDuplicates: true,
    }) : Promise.resolve(),
    backfill30.length > 0 ? prisma.priceHistory.createMany({
      data: backfill30.map(b => ({ cardId: b.cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: b.price, recordedAt: day30 })),
      skipDuplicates: true,
    }) : Promise.resolve(),
  ])

  return NextResponse.json({
    ok: true,
    totalCards: allPrices.length,
    todayCreated: missingToday.length,
    backfill7: backfill7.length,
    backfill30: backfill30.length,
  })
}
