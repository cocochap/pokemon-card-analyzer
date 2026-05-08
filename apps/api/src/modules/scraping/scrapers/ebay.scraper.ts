import { Injectable, Logger } from '@nestjs/common'
import axios from 'axios'
import * as cheerio from 'cheerio'
import { PrismaService } from '../../../prisma/prisma.service'
import { RateLimiter } from '../utils/rate-limiter'

interface EbaySale {
  title: string
  price: number
  currency: string
  soldDate: Date
  listingUrl: string
  condition: string
  grade?: number
  gradeCompany?: string
}

@Injectable()
export class EbayScraper {
  private readonly logger = new Logger(EbayScraper.name)
  private readonly limiter = new RateLimiter({ maxRequests: 20, windowMs: 60_000 })

  constructor(private readonly prisma: PrismaService) {}

  async scrapeRecentSales(cardName: string, setName: string, cardId: string): Promise<EbaySale[]> {
    await this.limiter.acquire()

    const query = encodeURIComponent(`${cardName} ${setName} pokemon card`)
    const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&_sop=13`

    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; PokeMarket/1.0)',
          Accept: 'text/html',
        },
        timeout: 15_000,
      })

      const sales = this.parseSoldListings(response.data)
      await this.saveSales(sales, cardId)
      return sales
    } catch (error) {
      this.logger.warn(`eBay scrape failed for ${cardName}: ${error}`)
      return []
    }
  }

  async scrapeGradedSales(cardName: string, cardId: string, gradeCompany = 'PSA'): Promise<EbaySale[]> {
    await this.limiter.acquire()

    const query = encodeURIComponent(`${cardName} ${gradeCompany} pokemon`)
    const url = `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1&_sop=13`

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PokeMarket/1.0)' },
        timeout: 15_000,
      })

      const sales = this.parseSoldListings(response.data, gradeCompany)
      await this.saveSales(sales, cardId)
      return sales
    } catch (error) {
      this.logger.warn(`eBay graded scrape failed: ${error}`)
      return []
    }
  }

  private parseSoldListings(html: string, gradeCompany?: string): EbaySale[] {
    const $ = cheerio.load(html)
    const sales: EbaySale[] = []

    $('.s-item').each((_, el) => {
      const $el = $(el)

      const title = $el.find('.s-item__title').text().trim()
      if (!title || title.includes('Shop on eBay')) return

      const priceText = $el.find('.s-item__price').text().trim()
      const price = this.parsePrice(priceText)
      if (!price) return

      const soldText = $el.find('.s-item__caption--signal').text().trim()
      const soldDate = this.parseSoldDate(soldText)
      if (!soldDate) return

      const url = $el.find('.s-item__link').attr('href') ?? ''
      const condition = $el.find('.SECONDARY_INFO').first().text().trim()

      // Extract grade from title
      let grade: number | undefined
      let company: string | undefined

      const gradeMatch = title.match(/(?:PSA|BGS|CGC)\s+(\d+(?:\.\d+)?)/i)
      if (gradeMatch) {
        company = gradeCompany ?? title.match(/(PSA|BGS|CGC)/i)?.[1]?.toUpperCase()
        grade = parseFloat(gradeMatch[1])
      }

      const currency = priceText.includes('$') ? 'USD' : priceText.includes('€') ? 'EUR' : 'USD'

      sales.push({ title, price, currency, soldDate, listingUrl: url, condition, grade, gradeCompany: company })
    })

    return sales.slice(0, 50)
  }

  private async saveSales(sales: EbaySale[], cardId: string) {
    if (!sales.length) return

    await this.prisma.$transaction(
      sales.map((s) =>
        this.prisma.saleEvent.create({
          data: {
            cardId,
            source: 'ebay',
            variant: 'NORMAL',
            grade: s.grade,
            gradeCompany: s.gradeCompany as any,
            salePrice: s.price,
            currency: s.currency,
            platform: 'ebay',
            listingUrl: s.listingUrl,
            condition: s.condition,
            soldAt: s.soldDate,
          },
        }),
      ).slice(0, 30),
    )
  }

  private parsePrice(text: string): number | null {
    const cleaned = text.replace(/[^0-9.,]/g, '').replace(',', '')
    const num = parseFloat(cleaned)
    return isNaN(num) ? null : num
  }

  private parseSoldDate(text: string): Date | null {
    const match = text.match(/Sold\s+(.+)/i)
    if (!match) return null
    const d = new Date(match[1])
    return isNaN(d.getTime()) ? new Date() : d
  }
}
