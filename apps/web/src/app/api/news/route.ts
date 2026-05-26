import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const revalidate = 300

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, Number(searchParams.get('page') ?? 1))
  const limit = Math.min(30, Math.max(5, Number(searchParams.get('limit') ?? 20)))
  const sentiment = searchParams.get('sentiment') ?? ''
  const eventType = searchParams.get('eventType') ?? ''
  const offset = (page - 1) * limit

  // General article signals (cardId=null) = one per article
  const where: Record<string, unknown> = { cardId: null }
  if (sentiment && sentiment !== 'ALL') where.sentiment = sentiment
  if (eventType && eventType !== 'ALL') where.eventType = eventType

  const [total, articles] = await Promise.all([
    prisma.newsSignal.count({ where }),
    prisma.newsSignal.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip: offset,
      take: limit,
      select: {
        id: true,
        source: true,
        title: true,
        url: true,
        summary: true,
        sentiment: true,
        eventType: true,
        impact: true,
        publishedAt: true,
      },
    }),
  ])

  // Fetch card-specific signals for these article URLs
  const urls = articles.map(a => a.url)
  const cardSignals = await prisma.newsSignal.findMany({
    where: { url: { in: urls }, cardId: { not: null } },
    select: {
      url: true,
      cardId: true,
      sentiment: true,
      impact: true,
      summary: true,
      card: { select: { id: true, name: true, imageSmUrl: true } },
    },
  })

  // Group card signals by article URL
  const cardsByUrl = new Map<string, typeof cardSignals>()
  for (const cs of cardSignals) {
    if (!cardsByUrl.has(cs.url)) cardsByUrl.set(cs.url, [])
    cardsByUrl.get(cs.url)!.push(cs)
  }

  const items = articles.map(article => ({
    ...article,
    cards: (cardsByUrl.get(article.url) ?? []).map(cs => ({
      cardId: cs.cardId,
      name: cs.card?.name ?? '',
      image: cs.card?.imageSmUrl ?? null,
      sentiment: cs.sentiment,
      impact: cs.impact,
      reason: cs.summary,
    })),
  }))

  return NextResponse.json({
    items,
    total,
    page,
    pages: Math.ceil(total / limit),
  })
}
