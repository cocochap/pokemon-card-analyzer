import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const type = searchParams.get('type') ?? undefined
  const discontinued = searchParams.get('discontinued')
  const sort = searchParams.get('sort') ?? 'score'

  const data = await withCache(`sealed:list:${type ?? 'all'}:${discontinued ?? 'all'}:${sort}`, 300, async () => {
    const where: any = {}
    if (type) where.type = type
    if (discontinued === 'true') where.isDiscontinued = true
    if (discontinued === 'false') where.isDiscontinued = false

    const orderBy: any =
      sort === 'score' ? { investmentScore: 'desc' }
      : sort === 'price' ? { retailPrice: 'desc' }
      : sort === 'name' ? { name: 'asc' }
      : { investmentScore: 'desc' }

    const products = await prisma.sealedProduct.findMany({
      where,
      orderBy,
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { price: true, recordedAt: true },
        },
      },
    })

    return products.map(p => ({
      ...p,
      currentMarketPrice: p.priceHistory[0]?.price ?? null,
      priceHistory: undefined,
    }))
  })

  return NextResponse.json(data)
}
