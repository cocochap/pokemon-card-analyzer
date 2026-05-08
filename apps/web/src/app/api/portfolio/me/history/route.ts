import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { subDays, subMonths, subYears } from 'date-fns'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const range = req.nextUrl.searchParams.get('range') ?? '30d'
  const since = range === '7d' ? subDays(new Date(), 7)
    : range === '30d' ? subDays(new Date(), 30)
    : range === '90d' ? subDays(new Date(), 90)
    : range === '1y' ? subYears(new Date(), 1)
    : new Date(0)

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { portfolio: { select: { id: true } } },
  })
  if (!user?.portfolio) return NextResponse.json([])

  const snapshots = await prisma.portfolioSnapshot.findMany({
    where: { portfolioId: user.portfolio.id, recordedAt: { gte: since } },
    orderBy: { recordedAt: 'asc' },
    select: { totalValue: true, totalPnl: true, recordedAt: true },
  })

  return NextResponse.json(
    snapshots.map((s) => ({
      time: Math.floor(s.recordedAt.getTime() / 1000),
      value: Number(s.totalValue),
      pnl: Number(s.totalPnl),
    })),
  )
}
