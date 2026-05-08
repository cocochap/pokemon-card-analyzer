import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const limit = Math.min(20, Number(req.nextUrl.searchParams.get('limit') ?? 10))

  const data = await withCache(`market:opportunities:${limit}`, 300, async () =>
    prisma.card.findMany({
      where: {
        aiAnalysis: {
          investmentScore: { gte: 70 },
          riskLevel: { lte: 40 },
        },
      },
      include: {
        set: { select: { name: true, symbolUrl: true } },
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
        aiAnalysis: {
          select: {
            investmentScore: true,
            trendDirection: true,
            predictedRoi30d: true,
            confidenceScore: true,
            riskLevel: true,
          },
        },
        marketData: { select: { priceChange7d: true, priceChange30d: true } },
      },
      orderBy: { aiAnalysis: { investmentScore: 'desc' } },
      take: limit,
    }),
  )

  return NextResponse.json(data)
}
