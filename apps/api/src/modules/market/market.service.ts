import { Injectable, Inject } from '@nestjs/common'
import { CACHE_MANAGER } from '@nestjs/cache-manager'
import { Cache } from 'cache-manager'
import { PrismaService } from '../../prisma/prisma.service'
import { subDays, subHours } from 'date-fns'

@Injectable()
export class MarketService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async getOverview() {
    const cached = await this.cache.get('market:overview')
    if (cached) return cached

    const [
      marketCapAgg,
      volume24h,
      volume48h,
      trending,
      topGainer,
      topLoser,
      latestIndex,
      prevDayIndex,
    ] = await Promise.all([
      this.prisma.cardMarketData.aggregate({ _sum: { marketCap: true } }),
      this.prisma.saleEvent.aggregate({
        where: { soldAt: { gte: subDays(new Date(), 1) } },
        _sum: { salePrice: true },
        _count: true,
      }),
      this.prisma.saleEvent.aggregate({
        where: { soldAt: { gte: subDays(new Date(), 2), lt: subDays(new Date(), 1) } },
        _sum: { salePrice: true },
      }),
      this.prisma.popularityMetric.count({
        where: { recordedAt: { gte: subDays(new Date(), 1) } },
      }),
      this.prisma.cardMarketData.findFirst({
        orderBy: { priceChange24h: 'desc' },
        select: { priceChange24h: true },
      }),
      this.prisma.cardMarketData.findFirst({
        orderBy: { priceChange24h: 'asc' },
        select: { priceChange24h: true },
      }),
      this.prisma.marketIndex.findFirst({
        where: { indexType: 'GLOBAL' },
        orderBy: { recordedAt: 'desc' },
      }),
      this.prisma.marketIndex.findFirst({
        where: {
          indexType: 'GLOBAL',
          recordedAt: { lt: subDays(new Date(), 1) },
        },
        orderBy: { recordedAt: 'desc' },
      }),
    ])

    const totalMarketCap = Number(marketCapAgg._sum.marketCap ?? 0)
    const vol24h = Number(volume24h._sum.salePrice ?? 0)
    const vol48h = Number(volume48h._sum.salePrice ?? 0)
    const volumeChange24h = vol48h > 0 ? ((vol24h - vol48h) / vol48h) * 100 : 0

    const indexVal = latestIndex ? Number(latestIndex.value) : 1000
    const prevIndexVal = prevDayIndex ? Number(prevDayIndex.value) : indexVal
    const indexChange24h = prevIndexVal > 0 ? ((indexVal - prevIndexVal) / prevIndexVal) * 100 : 0

    const result = {
      totalMarketCap,
      marketCapChange24h: 0,
      volume24h: vol24h,
      volumeChange24h,
      marketIndex: indexVal,
      indexChange24h,
      trendingCount: trending,
      topGainerChange: Number(topGainer?.priceChange24h ?? 0) * 100,
      topLoserChange: Number(topLoser?.priceChange24h ?? 0) * 100,
      totalSales24h: volume24h._count,
      updatedAt: new Date(),
    }

    await this.cache.set('market:overview', result, 60_000)
    return result
  }

  async getTicker() {
    const cached = await this.cache.get('market:ticker')
    if (cached) return cached

    const cards = await this.prisma.card.findMany({
      where: {
        marketData: {
          OR: [
            { priceChange24h: { gt: 0.05 } },
            { priceChange24h: { lt: -0.05 } },
            { volume24h: { gt: 0 } },
          ],
        },
      },
      include: {
        prices: { where: { source: 'cardmarket' }, take: 1 },
        marketData: { select: { priceChange24h: true, volume24h: true } },
      },
      orderBy: { marketData: { volume24h: 'desc' } },
      take: 30,
    })

    const result = cards.map((c) => ({
      cardId: c.id,
      name: c.name,
      price: Number(c.prices[0]?.market ?? 0),
      change: Number(c.marketData?.priceChange24h ?? 0) * 100,
    }))

    await this.cache.set('market:ticker', result, 30_000)
    return result
  }

  async getTopMovers(direction: 'up' | 'down', limit = 10) {
    const cacheKey = `market:movers:${direction}:${limit}`
    const cached = await this.cache.get(cacheKey)
    if (cached) return cached

    const orderBy = direction === 'up'
      ? { marketData: { priceChange24h: 'desc' as const } }
      : { marketData: { priceChange24h: 'asc' as const } }

    const where = direction === 'up'
      ? { marketData: { priceChange24h: { gt: 0 } } }
      : { marketData: { priceChange24h: { lt: 0 } } }

    const cards = await this.prisma.card.findMany({
      where,
      orderBy,
      take: limit,
      include: {
        set: { select: { name: true, symbolUrl: true } },
        prices: { where: { source: 'cardmarket' }, take: 1 },
        marketData: { select: { priceChange24h: true, marketCap: true } },
      },
    })

    const result = cards.map((c) => ({
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      setName: c.set.name,
      imageSmUrl: c.imageSmUrl,
      price: Number(c.prices[0]?.market ?? 0),
      change24h: Number(c.marketData?.priceChange24h ?? 0) * 100,
    }))

    await this.cache.set(cacheKey, result, 120_000)
    return result
  }

  async getIndex(params: { range?: string; type?: string }) {
    const { range = '30d', type = 'GLOBAL' } = params
    const since = this.rangeToDate(range)

    return this.prisma.marketIndex.findMany({
      where: { indexType: type, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
      select: { value: true, recordedAt: true },
    })
  }

  async getOpportunities(limit = 10) {
    return this.prisma.card.findMany({
      where: {
        aiAnalysis: {
          investmentScore: { gte: 70 },
          trendDirection: { in: ['BULLISH', 'STABLE'] },
          riskLevel: { lte: 40 },
        },
      },
      include: {
        set: { select: { name: true, symbolUrl: true } },
        prices: { where: { source: 'cardmarket' }, take: 1 },
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
    })
  }

  async getRecentSales(limit = 20) {
    return this.prisma.saleEvent.findMany({
      orderBy: { soldAt: 'desc' },
      take: limit,
      include: {
        card: {
          select: {
            id: true,
            name: true,
            imageSmUrl: true,
            rarity: true,
            set: { select: { name: true } },
          },
        },
      },
    })
  }

  async getFeaturedCard() {
    const cached = await this.cache.get('market:featured')
    if (cached) return cached

    // Algorithm: highest AI score + most social buzz + highest recent volume
    const featured = await this.prisma.card.findFirst({
      where: {
        aiAnalysis: {
          investmentScore: { gte: 80 },
          trendDirection: 'BULLISH',
        },
        marketData: { priceChange7d: { gte: 0.1 } },
      },
      include: {
        set: { select: { name: true, symbolUrl: true, logoUrl: true } },
        prices: { orderBy: { fetchedAt: 'desc' }, take: 1 },
        marketData: true,
        aiAnalysis: { include: { predictions: { orderBy: { horizonDays: 'asc' } } } },
      },
      orderBy: [
        { marketData: { volume7d: 'desc' } },
        { aiAnalysis: { investmentScore: 'desc' } },
      ],
    })

    await this.cache.set('market:featured', featured, 3_600_000) // 1h
    return featured
  }

  private rangeToDate(range: string): Date {
    const now = new Date()
    const map: Record<string, Date> = {
      '7d': subDays(now, 7),
      '30d': subDays(now, 30),
      '90d': subDays(now, 90),
      '1y': subDays(now, 365),
    }
    return map[range] ?? new Date(0)
  }
}
