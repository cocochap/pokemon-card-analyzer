import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserTier, isPremiumTier, isEliteTier } from '@/lib/subscription'

// PRO sees: monthly_featured, recent_hype, momentum
// ELITE sees everything including: undervalued, long_term
const PRO_PICK_TYPES = ['monthly_featured', 'recent_hype', 'momentum']
const ELITE_PICK_TYPES = ['monthly_featured', 'recent_hype', 'momentum', 'undervalued', 'long_term']

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

  const allowedTypes = isEliteTier(tier) ? ELITE_PICK_TYPES : PRO_PICK_TYPES

  const picks = await prisma.investmentPick.findMany({
    where: { period, pickType: { in: allowedTypes } },
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

  return NextResponse.json({ picks, period, tier, isElite: isEliteTier(tier) })
}
