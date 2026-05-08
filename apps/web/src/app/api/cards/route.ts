import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'
import { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const q = searchParams.get('q') ?? ''
  const set = searchParams.get('set') ?? ''
  const rarity = searchParams.get('rarity') ?? ''
  const language = searchParams.get('language') ?? ''
  const sort = searchParams.get('sort') ?? 'name_asc'
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 20))

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
    ...(language && { language: language as any }),
  }

  const orderBy: Prisma.CardOrderByWithRelationInput =
    sort === 'change_desc' ? { marketData: { priceChange24h: 'desc' } } :
    sort === 'name_desc' ? { name: 'desc' } :
    { name: 'asc' }

  const cacheKey = `cards:search:${JSON.stringify({ q, set, rarity, language, sort, page, limit })}`

  const result = await withCache(cacheKey, 60, async () => {
    const [items, total] = await Promise.all([
      prisma.card.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          set: { select: { id: true, name: true, symbolUrl: true } },
          prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
          marketData: { select: { priceChange24h: true, trendDirection: true, investmentScore: true } },
        },
      }),
      prisma.card.count({ where }),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  })

  return NextResponse.json(result)
}
