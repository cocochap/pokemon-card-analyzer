import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

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

  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(card)
}
