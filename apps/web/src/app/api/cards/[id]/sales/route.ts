import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const limit = Math.min(50, Number(req.nextUrl.searchParams.get('limit') ?? 20))

  const data = await withCache(`card:${id}:sales:${limit}`, 120, () =>
    prisma.saleEvent.findMany({
      where: { cardId: id },
      orderBy: { soldAt: 'desc' },
      take: limit,
      select: {
        id: true,
        source: true,
        variant: true,
        salePrice: true,
        currency: true,
        platform: true,
        condition: true,
        soldAt: true,
        grade: true,
        gradeCompany: true,
      },
    }),
  )

  return NextResponse.json(data)
}
