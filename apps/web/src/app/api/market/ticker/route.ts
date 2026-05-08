import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET() {
  const data = await withCache('market:ticker', 30, async () => {
    const cards = await prisma.card.findMany({
      where: {
        marketData: {
          OR: [
            { priceChange24h: { gt: 0.03 } },
            { priceChange24h: { lt: -0.03 } },
          ],
        },
      },
      include: {
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
        marketData: { select: { priceChange24h: true } },
      },
      orderBy: { marketData: { volume24h: 'desc' } },
      take: 30,
    })

    return cards.map((c) => ({
      cardId: c.id,
      name: c.name,
      price: Number(c.prices[0]?.market ?? 0),
      change: Number(c.marketData?.priceChange24h ?? 0) * 100,
    }))
  })

  return NextResponse.json(data)
}
