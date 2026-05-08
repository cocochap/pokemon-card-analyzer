import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { PrismaService } from '../../../prisma/prisma.service'
import { RateLimiter } from '../utils/rate-limiter'

interface CardmarketPrice {
  cardId: string
  cardmarketId: string
  low: number
  trend: number
  avg1: number
  avg7: number
  avg30: number
  avgSell: number
  reverseHolo?: {
    low: number
    trend: number
    avg7: number
    avg30: number
  }
}

@Injectable()
export class CardmarketScraper {
  private readonly logger = new Logger(CardmarketScraper.name)
  private readonly limiter = new RateLimiter({ maxRequests: 30, windowMs: 60_000 })

  // Base headers to mimic a real browser
  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache',
  }

  constructor(private readonly prisma: PrismaService) {}

  async scrapeCardPrices(externalId: string): Promise<CardmarketPrice | null> {
    await this.limiter.acquire()

    try {
      // Cardmarket uses a REST-like URL for product data
      const url = `https://api.cardmarket.com/ws/v2.0/products/${externalId}`

      // In production: use Cardmarket official API with OAuth
      // For scraping: we'd parse the HTML page
      const html = await this.fetchHtml(
        `https://www.cardmarket.com/en/Pokemon/Products/Singles/${externalId}`,
      )
      return this.parseCardPage(html, externalId)
    } catch (error) {
      this.logger.warn(`Failed to scrape Cardmarket for ${externalId}: ${error}`)
      return null
    }
  }

  async scrapeSetPrices(setSlug: string): Promise<CardmarketPrice[]> {
    await this.limiter.acquire()
    const results: CardmarketPrice[] = []

    try {
      const url = `https://www.cardmarket.com/en/Pokemon/Expansions/${setSlug}`
      const html = await this.fetchHtml(url)
      const $ = cheerio.load(html)

      // Parse card listing table
      $('table.table tbody tr').each((_, row) => {
        const $row = $(row)
        const id = $row.find('[data-product-id]').data('product-id') as string
        if (!id) return

        const low = this.parsePrice($row.find('.col-lowPrice').text())
        const trend = this.parsePrice($row.find('.col-trendPrice').text())

        if (low !== null && trend !== null) {
          results.push({ cardmarketId: id, cardId: '', low, trend, avg1: 0, avg7: 0, avg30: 0, avgSell: 0 })
        }
      })
    } catch (error) {
      this.logger.warn(`Failed to scrape Cardmarket set ${setSlug}: ${error}`)
    }

    return results
  }

  async savePrices(prices: CardmarketPrice[]) {
    if (prices.length === 0) return

    const ops = prices
      .filter((p) => p.cardId)
      .map((p) =>
        this.prisma.cardPrice.upsert({
          where: { cardId_source_variant: { cardId: p.cardId, source: 'cardmarket', variant: 'NORMAL' } },
          create: {
            cardId: p.cardId,
            source: 'cardmarket',
            variant: 'NORMAL',
            low: p.low,
            mid: p.avg7,
            market: p.trend,
            high: p.avg30,
            directLow: p.avgSell,
            currency: 'EUR',
          },
          update: {
            low: p.low,
            mid: p.avg7,
            market: p.trend,
            high: p.avg30,
            directLow: p.avgSell,
          },
        }),
      )

    // Also log to price history
    const histOps = prices
      .filter((p) => p.cardId && p.trend > 0)
      .map((p) =>
        this.prisma.priceHistory.create({
          data: {
            cardId: p.cardId,
            source: 'cardmarket',
            variant: 'NORMAL',
            price: p.trend,
            currency: 'EUR',
            recordedAt: new Date(),
          },
        }),
      )

    await this.prisma.$transaction([...ops, ...histOps])
    this.logger.log(`Saved ${prices.length} Cardmarket prices`)
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await axios.get(url, {
      headers: this.headers,
      timeout: 15_000,
      // Rotate through residential proxies in production
    })
    return response.data
  }

  private parseCardPage(html: string, externalId: string): CardmarketPrice | null {
    const $ = cheerio.load(html)

    const lowText = $('.col-lowPrice dd').text().trim()
    const trendText = $('.col-trendPrice dd').text().trim()
    const avg1Text = $('.col-avg1 dd').text().trim()
    const avg7Text = $('.col-avg7 dd').text().trim()
    const avg30Text = $('.col-avg30 dd').text().trim()
    const avgSellText = $('.col-sellPrice dd').text().trim()

    const low = this.parsePrice(lowText)
    const trend = this.parsePrice(trendText)

    if (low === null || trend === null) return null

    return {
      cardmarketId: externalId,
      cardId: '',
      low,
      trend,
      avg1: this.parsePrice(avg1Text) ?? 0,
      avg7: this.parsePrice(avg7Text) ?? 0,
      avg30: this.parsePrice(avg30Text) ?? 0,
      avgSell: this.parsePrice(avgSellText) ?? 0,
    }
  }

  private parsePrice(text: string): number | null {
    if (!text) return null
    const cleaned = text.replace(/[€$,\s]/g, '').replace(',', '.')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }
}
