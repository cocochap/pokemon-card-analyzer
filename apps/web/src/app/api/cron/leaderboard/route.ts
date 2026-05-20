import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 60

const MIN_AGE_DAYS = 7 // anti-cheat: cartes ajoutées depuis au moins 7 jours

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const cutoff = subDays(new Date(), MIN_AGE_DAYS)

  // Tous les portfolios publics avec items éligibles (âge >= 7j) + prix CardMarket
  const portfolios = await prisma.portfolio.findMany({
    where: { isPublic: true },
    select: {
      id: true,
      userId: true,
      items: {
        where: { createdAt: { lte: cutoff } },
        select: {
          quantity: true,
          card: {
            select: {
              prices: {
                where: { source: 'cardmarket' },
                orderBy: { fetchedAt: 'desc' },
                take: 1,
                select: { market: true },
              },
            },
          },
        },
      },
    },
  })

  // Calcul de la valeur pour chaque portfolio
  const entries = portfolios
    .map(p => {
      let totalValue = 0
      let cardCount = 0
      for (const item of p.items) {
        const price = Number(item.card.prices[0]?.market ?? 0)
        if (price > 0) {
          totalValue += price * item.quantity
          cardCount += item.quantity
        }
      }
      return { portfolioId: p.id, userId: p.userId, totalValue, cardCount }
    })
    .filter(e => e.totalValue > 0)
    .sort((a, b) => b.totalValue - a.totalValue)

  // Upsert atomique : on remplace toutes les entrées
  await prisma.$transaction([
    prisma.leaderboardEntry.deleteMany(),
    ...entries.map((e, i) =>
      prisma.leaderboardEntry.create({
        data: {
          userId: e.userId,
          portfolioId: e.portfolioId,
          rank: i + 1,
          totalValue: e.totalValue,
          cardCount: e.cardCount,
          computedAt: new Date(),
        },
      })
    ),
  ])

  console.log(`[leaderboard] ${entries.length} portfolios ranked`)
  return NextResponse.json({ ok: true, count: entries.length, top3: entries.slice(0, 3) })
}
