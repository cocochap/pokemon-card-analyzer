import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') ?? '90d'
  const type = req.nextUrl.searchParams.get('type') ?? 'GLOBAL'

  const data = await withCache(`market:index:${type}:${range}`, 300, async () => {
    const days = range === '7d' ? 7 : range === '30d' ? 30 : range === '1y' ? 365 : 90
    const since = subDays(new Date(), days)

    const entries = await prisma.marketIndex.findMany({
      where: { indexType: type, recordedAt: { gte: since } },
      orderBy: { recordedAt: 'asc' },
      select: { value: true, change24h: true, recordedAt: true },
    })

    return entries.map((e) => ({
      date: e.recordedAt.toISOString().slice(0, 10),
      value: Number(e.value),
      change: Number(e.change24h ?? 0) * 100,
    }))
  })

  return NextResponse.json(data)
}
