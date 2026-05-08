import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const direction = req.nextUrl.searchParams.get('direction') ?? 'up'
  const limit = Math.min(20, Number(req.nextUrl.searchParams.get('limit') ?? 10))

  const data = await withCache(`market:movers:${direction}:${limit}`, 120, async () => {
    const isUp = direction === 'up'
    const cards = await prisma.card.findMany({
      where: { marketData: isUp
        ? { priceChange24h: { gt: 0 } }
        : { priceChange24h: { lt: 0 } },
      },
      orderBy: { marketData: isUp
        ? { priceChange24h: 'desc' }
        : { priceChange24h: 'asc' },
      },
      take: limit,
      include: {
        set: { select: { name: true, symbolUrl: true } },
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
        marketData: { select: { priceChange24h: true } },
      },
    })

    return cards.map((c) => ({
      id: c.id,
      name: c.name,
      rarity: c.rarity,
      setName: c.set.name,
      imageSmUrl: c.imageSmUrl,
      price: Number(c.prices[0]?.market ?? 0),
      change24h: Number(c.marketData?.priceChange24h ?? 0) * 100,
    }))
  })

  return NextResponse.json(data)
}
