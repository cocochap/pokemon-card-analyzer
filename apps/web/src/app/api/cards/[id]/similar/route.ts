import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const setId = req.nextUrl.searchParams.get('setId') ?? undefined

  const card = await prisma.card.findUnique({ where: { id }, select: { rarity: true, setId: true } })
  if (!card) return NextResponse.json([])

  const data = await withCache(`card:${id}:similar`, 300, () =>
    prisma.card.findMany({
      where: {
        id: { not: id },
        OR: [
          { setId: setId ?? card.setId },
          { rarity: card.rarity },
        ],
      },
      include: {
        set: { select: { name: true } },
        prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
        marketData: { select: { priceChange24h: true } },
      },
      orderBy: { marketData: { priceChange24h: 'desc' } },
      take: 8,
    }),
  )

  return NextResponse.json(data)
}
