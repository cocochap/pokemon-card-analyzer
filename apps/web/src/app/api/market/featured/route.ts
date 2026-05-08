import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET() {
  const data = await withCache('market:featured', 3600, async () =>
    prisma.card.findFirst({
      where: {
        aiAnalysis: { investmentScore: { gte: 75 }, trendDirection: 'BULLISH' },
        marketData: { priceChange7d: { gte: 0.08 } },
      },
      include: {
        set: { select: { name: true, symbolUrl: true, logoUrl: true } },
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
        marketData: true,
        aiAnalysis: { include: { predictions: { orderBy: { horizonDays: 'asc' } } } },
      },
      orderBy: { marketData: { volume7d: 'desc' } },
    }),
  )

  return NextResponse.json(data)
}
