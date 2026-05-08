import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? 20))

  const data = await withCache(`market:sales:${limit}`, 60, async () =>
    prisma.saleEvent.findMany({
      orderBy: { soldAt: 'desc' },
      take: limit,
      include: {
        card: {
          select: {
            id: true,
            name: true,
            imageSmUrl: true,
            rarity: true,
            set: { select: { name: true } },
          },
        },
      },
    }),
  )

  return NextResponse.json(data)
}
