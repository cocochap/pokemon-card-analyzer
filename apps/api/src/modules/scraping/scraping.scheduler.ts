import { Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { InjectQueue } from '@nestjs/bull'
import { Queue } from 'bull'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class ScrapingScheduler {
  private readonly logger = new Logger(ScrapingScheduler.name)

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('scraping') private readonly scrapingQueue: Queue,
  ) {}

  // Scrape top 500 cards every hour
  @Cron('0 * * * *')
  async scrapeTopCards() {
    this.logger.log('Scheduling top cards price scrape...')

    const topCards = await this.prisma.card.findMany({
      where: {
        OR: [
          { marketData: { volume24h: { gt: 0 } } },
          { watchlistItems: { some: {} } },
        ],
      },
      orderBy: { marketData: { volume7d: 'desc' } },
      take: 500,
      select: { id: true, cardmarketId: true, name: true, set: { select: { name: true } } },
    })

    for (const card of topCards) {
      await this.scrapingQueue.add(
        'scrape-card-prices',
        { cardId: card.id, cardmarketId: card.cardmarketId, name: card.name },
        { delay: Math.random() * 30_000, priority: 5 },
      )
    }

    this.logger.log(`Queued ${topCards.length} cards for price update`)
  }

  // Full database price refresh every 6 hours
  @Cron('0 */6 * * *')
  async scheduleFullRefresh() {
    this.logger.log('Scheduling full price refresh...')

    const sets = await this.prisma.pokemonSet.findMany({
      select: { id: true, externalId: true, name: true },
      orderBy: { releaseDate: 'desc' },
    })

    for (const set of sets) {
      await this.scrapingQueue.add(
        'scrape-set-prices',
        { setId: set.id, externalId: set.externalId, name: set.name },
        { delay: Math.random() * 120_000, priority: 10 },
      )
    }
  }

  // Scrape eBay sold listings every 2 hours for top cards
  @Cron('0 */2 * * *')
  async scrapeEbaySales() {
    const cards = await this.prisma.card.findMany({
      where: { aiAnalysis: { investmentScore: { gte: 60 } } },
      include: { set: { select: { name: true } } },
      take: 100,
    })

    for (const card of cards) {
      await this.scrapingQueue.add(
        'scrape-ebay-sales',
        { cardId: card.id, cardName: card.name, setName: card.set.name },
        { delay: Math.random() * 60_000, priority: 8 },
      )
    }
  }

  // Update market analytics every 15 minutes
  @Cron('*/15 * * * *')
  async updateMarketAnalytics() {
    await this.scrapingQueue.add('update-market-analytics', {}, { priority: 1 })
  }

  // Update Pokémon TCG API data daily
  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async syncPokemonTcgApi() {
    await this.scrapingQueue.add('sync-tcg-api', {}, { priority: 15 })
  }

  // PSA population report weekly
  @Cron(CronExpression.EVERY_WEEK)
  async updatePsaPopulation() {
    await this.scrapingQueue.add('update-psa-population', {}, { priority: 20 })
  }
}
