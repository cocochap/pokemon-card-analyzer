import { prisma } from './prisma'
import { withCache } from './redis'

export async function getCardById(id: string) {
  const card = await withCache(`card:${id}`, 120, () =>
    prisma.card.findUnique({
      where: { id },
      include: {
        set: true,
        prices: { orderBy: { fetchedAt: 'desc' } },
        gradedPrices: { orderBy: [{ company: 'asc' }, { grade: 'desc' }] },
        marketData: true,
        aiAnalysis: { include: { predictions: { orderBy: { horizonDays: 'asc' } } } },
      },
    }),
  )

  if (!card) return null

  const currentPrice = Number(
    card.prices.find((p) => p.source === 'cardmarket')?.market ?? card.prices[0]?.market ?? 0,
  )

  return {
    ...card,
    marketData: card.marketData
      ? {
          ...card.marketData,
          currentPrice,
          priceChange24h: Number(card.marketData.priceChange24h ?? 0) * 100,
          priceChange7d: Number(card.marketData.priceChange7d ?? 0) * 100,
          priceChange30d: Number(card.marketData.priceChange30d ?? 0) * 100,
        }
      : null,
  }
}
