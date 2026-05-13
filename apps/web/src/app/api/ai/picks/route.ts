import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserTier, isPremiumTier } from '@/lib/subscription'

export async function GET(req: Request) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Connexion requise', requiresAuth: true }, { status: 401 })
  }

  const tier = await getUserTier(clerkId)
  if (!isPremiumTier(tier)) {
    return NextResponse.json({ error: 'Abonnement Premium requis', requiresPremium: true }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const period = searchParams.get('period') ?? new Date().toISOString().slice(0, 7)

  const picks = await prisma.investmentPick.findMany({
    where: { period },
    include: {
      card: {
        include: {
          set: { select: { name: true, series: true } },
          prices: { where: { source: 'cardmarket' }, select: { market: true } },
          marketData: {
            select: {
              priceChange7d: true,
              priceChange30d: true,
              allTimeHigh: true,
              volatility30d: true,
              trendDirection: true,
              investmentScore: true,
            },
          },
        },
      },
    },
    orderBy: [{ pickType: 'asc' }, { rank: 'asc' }],
  })

  return NextResponse.json({ picks, period })
}
