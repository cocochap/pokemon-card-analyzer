import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'

export async function GET() {
  const data = await withCache('market:overview', 60, async () => {
    const [
      marketCapAgg,
      volume24h,
      volume48h,
      trendingCount,
      topGainer,
      topLoser,
      latestIndex,
      prevDayIndex,
    ] = await Promise.all([
      prisma.cardMarketData.aggregate({ _sum: { marketCap: true } }),
      prisma.saleEvent.aggregate({
        where: { soldAt: { gte: subDays(new Date(), 1) } },
        _sum: { salePrice: true },
        _count: true,
      }),
      prisma.saleEvent.aggregate({
        where: { soldAt: { gte: subDays(new Date(), 2), lt: subDays(new Date(), 1) } },
        _sum: { salePrice: true },
      }),
      prisma.popularityMetric.count({ where: { recordedAt: { gte: subDays(new Date(), 1) } } }),
      prisma.cardMarketData.findFirst({
        orderBy: { priceChange24h: 'desc' },
        select: { priceChange24h: true },
      }),
      prisma.cardMarketData.findFirst({
        orderBy: { priceChange24h: 'asc' },
        select: { priceChange24h: true },
      }),
      prisma.marketIndex.findFirst({ where: { indexType: 'GLOBAL' }, orderBy: { recordedAt: 'desc' } }),
      prisma.marketIndex.findFirst({
        where: { indexType: 'GLOBAL', recordedAt: { lt: subDays(new Date(), 1) } },
        orderBy: { recordedAt: 'desc' },
      }),
    ])

    const vol24h = Number(volume24h._sum.salePrice ?? 0)
    const vol48h = Number(volume48h._sum.salePrice ?? 0)
    const indexVal = latestIndex ? Number(latestIndex.value) : 1000
    const prevIndexVal = prevDayIndex ? Number(prevDayIndex.value) : indexVal

    return {
      totalMarketCap: Number(marketCapAgg._sum.marketCap ?? 0),
      marketCapChange24h: 0,
      volume24h: vol24h,
      volumeChange24h: vol48h > 0 ? ((vol24h - vol48h) / vol48h) * 100 : 0,
      marketIndex: indexVal,
      indexChange24h: prevIndexVal > 0 ? ((indexVal - prevIndexVal) / prevIndexVal) * 100 : 0,
      trendingCount,
      topGainerChange: Number(topGainer?.priceChange24h ?? 0) * 100,
      topLoserChange: Number(topLoser?.priceChange24h ?? 0) * 100,
      totalSales24h: volume24h._count,
      updatedAt: new Date().toISOString(),
    }
  })

  return NextResponse.json(data)
}
