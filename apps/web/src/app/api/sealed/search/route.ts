import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')?.trim()
  if (!q || q.length < 2) return NextResponse.json([])

  const results = await prisma.sealedProduct.findMany({
    where: {
      OR: [
        { name:    { contains: q, mode: 'insensitive' } },
        { nameFr:  { contains: q, mode: 'insensitive' } },
        { setName: { contains: q, mode: 'insensitive' } },
        { series:  { contains: q, mode: 'insensitive' } },
      ],
    },
    include: {
      priceHistory: {
        orderBy: { recordedAt: 'desc' },
        take: 1,
        select: { price: true },
      },
    },
    orderBy: { investmentScore: 'desc' },
    take: 20,
  })

  return NextResponse.json(results.map(p => ({
    ...p,
    currentMarketPrice: p.priceHistory[0]?.price ?? null,
    priceHistory: undefined,
  })))
}
