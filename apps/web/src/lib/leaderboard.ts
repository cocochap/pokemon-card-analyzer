import { prisma } from '@/lib/db/prisma'
import { subDays } from 'date-fns'

const MIN_AGE_DAYS = 7

export async function computeLeaderboard(skipAgeCheck = false) {
  const cutoff = subDays(new Date(), MIN_AGE_DAYS)

  const portfolios = await prisma.portfolio.findMany({
    where: { isPublic: { not: false } },
    select: {
      id: true,
      userId: true,
      items: {
        where: skipAgeCheck ? {} : { createdAt: { lte: cutoff } },
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

  if (entries.length === 0) return { count: 0 }

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

  return { count: entries.length }
}
