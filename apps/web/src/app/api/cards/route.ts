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
  const sort = searchParams.get('sort') ?? 'price_desc'
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(100, Number(searchParams.get('limit') ?? 24))

  const where: Prisma.CardWhereInput = {
    // Without a search query, only show cards with images (better default UX)
    // When searching, show all cards so users can find sets without FR images
    ...(!q && { imageSmUrl: { not: null } }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { number: { contains: q, mode: 'insensitive' } },
        { illustrator: { contains: q, mode: 'insensitive' } },
        { localeName: { path: ['fr'], string_contains: q } },
        { set: { name: { contains: q, mode: 'insensitive' } } },
        { set: { externalId: { contains: q, mode: 'insensitive' } } },
      ],
    }),
    ...(set && { setId: set }),
    ...(rarity && { rarity: rarity as any }),
    ...((sort === 'price_desc' || sort === 'price_asc') && !q && {
      prices: { some: { source: 'cardmarket', variant: 'NORMAL' } },
    }),
  }

  const orderBy: Prisma.CardOrderByWithRelationInput =
    sort === 'price_desc' ? { marketData: { allTimeHigh: { sort: 'desc', nulls: 'last' } } } :
    sort === 'price_asc'  ? { marketData: { allTimeHigh: { sort: 'asc',  nulls: 'last' } } } :
    sort === 'change_desc' ? { marketData: { priceChange24h: { sort: 'desc', nulls: 'last' } } } :
    sort === 'name_desc'  ? { name: 'desc' } :
    sort === 'name_asc'   ? { name: 'asc' } :
    sort === 'score_desc' ? { marketData: { investmentScore: { sort: 'desc', nulls: 'last' } } } :
    { marketData: { allTimeHigh: { sort: 'desc', nulls: 'last' } } }

  const cacheKey = `cards:v4:${JSON.stringify({ q, set, rarity, sort, page, limit })}`

  const result = await withCache(cacheKey, 60, async () => {
    const [items, total] = await Promise.all([
      prisma.card.findMany({
        where,
        orderBy,
        skip: (page - 1) * limit,
        take: limit,
        include: {
          set: { select: { id: true, externalId: true, name: true, symbolUrl: true } },
          prices: {
            where: { source: 'cardmarket', variant: 'NORMAL' },
            orderBy: { fetchedAt: 'desc' },
            take: 1,
          },
          marketData: {
            select: { priceChange24h: true, priceChange7d: true, trendDirection: true, investmentScore: true, allTimeHigh: true },
          },
        },
      }),
      prisma.card.count({ where }),
    ])
    return { items, total, page, limit, pages: Math.ceil(total / limit) }
  })

  return NextResponse.json(result)
}
