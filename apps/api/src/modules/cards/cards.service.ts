import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { SearchCardsDto } from './dto/search-cards.dto'
import { PriceHistoryDto } from './dto/price-history.dto'
import { Prisma } from '@prisma/client'
import { subDays, subMonths, subYears } from 'date-fns'

@Injectable()
export class CardsService {
  constructor(private readonly prisma: PrismaService) {}

  async search(dto: SearchCardsDto) {
    const { q, set, rarity, type, language, page = 1, limit = 20, sort = 'name_asc', minPrice, maxPrice } = dto

    const where: Prisma.CardWhereInput = {
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { number: { contains: q, mode: 'insensitive' } },
          { illustrator: { contains: q, mode: 'insensitive' } },
        ],
      }),
      ...(set && { setId: set }),
      ...(rarity && { rarity: rarity as any }),
      ...(type && { types: { has: type } }),
      ...(language && { language: language as any }),
    }

    const orderBy = this.buildOrderBy(sort)

    const [items, total] = await Promise.all([
      this.prisma.card.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: Math.min(limit, 100),
        include: {
          set: { select: { id: true, name: true, series: true, symbolUrl: true } },
          marketData: {
            select: {
              marketCap: true,
              priceChange24h: true,
              priceChange7d: true,
              trendDirection: true,
              investmentScore: true,
            },
          },
          prices: {
            where: { source: 'cardmarket' },
            orderBy: { fetchedAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.card.count({ where }),
    ])

    return {
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    }
  }

  async getById(id: string, userId?: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      include: {
        set: true,
        prices: { orderBy: { fetchedAt: 'desc' } },
        gradedPrices: { orderBy: [{ company: 'asc' }, { grade: 'desc' }] },
        marketData: true,
        aiAnalysis: {
          include: {
            predictions: { orderBy: { horizonDays: 'asc' } },
          },
        },
      },
    })

    if (!card) throw new NotFoundException(`Card ${id} not found`)

    // Track view
    await this.prisma.popularityMetric.create({
      data: { cardId: id, views: 1 },
    }).catch(() => {})

    // Get current price from best source
    const currentPrice = this.extractCurrentPrice(card.prices)

    return {
      ...card,
      currentPrice,
      isWatchlisted: userId ? await this.isWatchlisted(id, userId) : false,
    }
  }

  async getPriceHistory(id: string, dto: PriceHistoryDto) {
    const { range = '30d', type = 'line', source = 'cardmarket', variant = 'NORMAL' } = dto

    const since = this.rangeToDate(range)

    const rawHistory = await this.prisma.priceHistory.findMany({
      where: {
        cardId: id,
        source,
        variant: variant as any,
        recordedAt: { gte: since },
      },
      orderBy: { recordedAt: 'asc' },
      select: { price: true, recordedAt: true, volume: true },
    })

    const prices = rawHistory.map((h) => ({
      time: Math.floor(h.recordedAt.getTime() / 1000) as any,
      value: Number(h.price),
    }))

    const volumes = rawHistory.map((h, i) => ({
      time: Math.floor(h.recordedAt.getTime() / 1000) as any,
      value: h.volume ?? 0,
      color: i > 0 && Number(h.price) >= Number(rawHistory[i - 1].price)
        ? 'rgba(34,197,94,0.4)'
        : 'rgba(239,68,68,0.4)',
    }))

    // Build candles from daily data
    const candles = type === 'candle' ? this.buildCandles(rawHistory) : []

    // MA20
    const ma20 = this.calculateMA(prices, 20)

    // RSI14
    const rsi = this.calculateRSI(prices, 14)

    // Price change
    const priceChange = prices.length >= 2
      ? ((prices[prices.length - 1].value - prices[0].value) / prices[0].value) * 100
      : 0

    return { prices, volumes, candles, ma20, rsi, priceChange }
  }

  async getVariants(id: string) {
    return this.prisma.cardPrice.findMany({
      where: { cardId: id },
      select: {
        variant: true,
        source: true,
        market: true,
        low: true,
        high: true,
        updatedAt: true,
      },
      orderBy: [{ variant: 'asc' }, { source: 'asc' }],
    })
  }

  async getGradedPrices(id: string) {
    const [graded, population] = await Promise.all([
      this.prisma.gradedCardPrice.findMany({
        where: { cardId: id },
        orderBy: [{ company: 'asc' }, { grade: 'desc' }],
      }),
      this.prisma.psaPopulation.findMany({
        where: { cardId: id },
        orderBy: [{ company: 'asc' }, { grade: 'desc' }],
      }),
    ])

    return { graded, population }
  }

  async getRecentSales(id: string, { limit, source }: { limit: number; source?: string }) {
    return this.prisma.saleEvent.findMany({
      where: { cardId: id, ...(source && { source }) },
      orderBy: { soldAt: 'desc' },
      take: Math.min(limit, 100),
    })
  }

  async getSimilar(id: string, setId?: string) {
    const card = await this.prisma.card.findUnique({
      where: { id },
      select: { rarity: true, setId: true, types: true },
    })
    if (!card) return []

    return this.prisma.card.findMany({
      where: {
        id: { not: id },
        setId: setId ?? card.setId,
        rarity: card.rarity,
      },
      include: {
        prices: { where: { source: 'cardmarket' }, take: 1 },
        marketData: { select: { priceChange24h: true, trendDirection: true } },
      },
      take: 12,
    })
  }

  async getTrending(limit: number) {
    const since = subDays(new Date(), 7)

    const trending = await this.prisma.popularityMetric.groupBy({
      by: ['cardId'],
      where: { recordedAt: { gte: since } },
      _sum: { views: true, searches: true, watchlists: true },
      orderBy: { _sum: { views: 'desc' } },
      take: limit,
    })

    const cardIds = trending.map((t) => t.cardId)
    const cards = await this.prisma.card.findMany({
      where: { id: { in: cardIds } },
      include: {
        set: { select: { name: true, symbolUrl: true } },
        prices: { where: { source: 'cardmarket' }, take: 1 },
        marketData: { select: { priceChange24h: true, priceChange7d: true, trendDirection: true } },
      },
    })

    return cardIds.map((cid) => cards.find((c) => c.id === cid)).filter(Boolean)
  }

  async trackView(id: string) {
    await this.prisma.popularityMetric.create({
      data: { cardId: id, views: 1 },
    })
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  private buildOrderBy(sort: string): Prisma.CardOrderByWithRelationInput {
    const map: Record<string, Prisma.CardOrderByWithRelationInput> = {
      name_asc: { name: 'asc' },
      name_desc: { name: 'desc' },
      price_asc: { prices: { _count: 'asc' } },
      price_desc: { prices: { _count: 'desc' } },
      change_desc: { marketData: { priceChange24h: 'desc' } },
      change_asc: { marketData: { priceChange24h: 'asc' } },
    }
    return map[sort] ?? { name: 'asc' }
  }

  private extractCurrentPrice(prices: any[]): number | null {
    const order = ['cardmarket', 'tcgplayer', 'ebay']
    for (const source of order) {
      const p = prices.find((pr) => pr.source === source)
      if (p?.market) return Number(p.market)
    }
    return null
  }

  private rangeToDate(range: string): Date {
    const now = new Date()
    switch (range) {
      case '7d': return subDays(now, 7)
      case '30d': return subDays(now, 30)
      case '90d': return subDays(now, 90)
      case '1y': return subYears(now, 1)
      default: return new Date(0)
    }
  }

  private buildCandles(history: { price: any; recordedAt: Date }[]) {
    const byDay = new Map<string, number[]>()
    for (const h of history) {
      const day = h.recordedAt.toISOString().slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(Number(h.price))
    }

    return Array.from(byDay.entries()).map(([day, prices]) => ({
      time: day,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    }))
  }

  private calculateMA(prices: { value: number }[], period: number) {
    return prices.map((p, i) => {
      if (i < period - 1) return null
      const slice = prices.slice(i - period + 1, i + 1)
      const avg = slice.reduce((s, x) => s + x.value, 0) / period
      return { ...(prices as any)[i], value: avg }
    }).filter(Boolean)
  }

  private calculateRSI(prices: { value: number }[], period: number): number {
    if (prices.length < period + 1) return 50

    const changes = prices.slice(1).map((p, i) => p.value - prices[i].value)
    const gains = changes.map((c) => (c > 0 ? c : 0))
    const losses = changes.map((c) => (c < 0 ? -c : 0))

    let avgGain = gains.slice(0, period).reduce((s, v) => s + v, 0) / period
    let avgLoss = losses.slice(0, period).reduce((s, v) => s + v, 0) / period

    for (let i = period; i < changes.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period
    }

    if (avgLoss === 0) return 100
    const rs = avgGain / avgLoss
    return 100 - 100 / (1 + rs)
  }

  private async isWatchlisted(cardId: string, userId: string): Promise<boolean> {
    const item = await this.prisma.watchlistItem.findUnique({
      where: { userId_cardId: { userId, cardId } },
      select: { id: true },
    })
    return !!item
  }
}
