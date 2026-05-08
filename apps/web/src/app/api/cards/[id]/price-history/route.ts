import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'
import { subDays, subYears } from 'date-fns'

export const runtime = 'nodejs'

function rangeToDate(range: string): Date {
  const now = new Date()
  return range === '7d' ? subDays(now, 7)
    : range === '30d' ? subDays(now, 30)
    : range === '90d' ? subDays(now, 90)
    : range === '1y' ? subYears(now, 1)
    : new Date(0)
}

function calculateRSI(prices: number[], period = 14): number {
  if (prices.length < period + 1) return 50
  const changes = prices.slice(1).map((p, i) => p - prices[i])
  const gains = changes.map((c) => (c > 0 ? c : 0))
  const losses = changes.map((c) => (c < 0 ? -c : 0))
  const avgGain = gains.slice(-period).reduce((s, v) => s + v, 0) / period
  const avgLoss = losses.slice(-period).reduce((s, v) => s + v, 0) / period
  if (avgLoss === 0) return 100
  return 100 - 100 / (1 + avgGain / avgLoss)
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { searchParams } = req.nextUrl
  const range = searchParams.get('range') ?? '30d'
  const source = searchParams.get('source') ?? 'cardmarket'

  const data = await withCache(`card:${id}:history:${range}:${source}`, 120, async () => {
    const history = await prisma.priceHistory.findMany({
      where: { cardId: id, source, recordedAt: { gte: rangeToDate(range) } },
      orderBy: { recordedAt: 'asc' },
      select: { price: true, recordedAt: true, volume: true },
    })

    const prices = history.map((h) => ({
      time: Math.floor(h.recordedAt.getTime() / 1000),
      value: Number(h.price),
    }))

    const volumes = history.map((h, i) => ({
      time: Math.floor(h.recordedAt.getTime() / 1000),
      value: h.volume ?? 0,
      color: i > 0 && Number(h.price) >= Number(history[i - 1].price)
        ? 'rgba(34,197,94,0.4)'
        : 'rgba(239,68,68,0.4)',
    }))

    // MA20
    const ma20 = prices.map((p, i) => {
      if (i < 19) return null
      const avg = prices.slice(i - 19, i + 1).reduce((s, x) => s + x.value, 0) / 20
      return { time: p.time, value: avg }
    }).filter(Boolean)

    const rsi = calculateRSI(prices.map((p) => p.value))
    const priceChange = prices.length >= 2
      ? ((prices.at(-1)!.value - prices[0].value) / prices[0].value) * 100
      : 0

    // Candles groupées par jour
    const byDay = new Map<string, number[]>()
    history.forEach((h) => {
      const day = h.recordedAt.toISOString().slice(0, 10)
      if (!byDay.has(day)) byDay.set(day, [])
      byDay.get(day)!.push(Number(h.price))
    })
    const candles = Array.from(byDay.entries()).map(([time, p]) => ({
      time,
      open: p[0],
      high: Math.max(...p),
      low: Math.min(...p),
      close: p.at(-1)!,
    }))

    return { prices, volumes, ma20, candles, rsi, priceChange }
  })

  return NextResponse.json(data)
}
