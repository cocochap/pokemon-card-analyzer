import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json([])

  const items = await prisma.watchlistItem.findMany({
    where: { userId: user.id },
    include: {
      card: {
        include: {
          set: { select: { name: true, symbolUrl: true } },
          prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
          marketData: { select: { priceChange24h: true, trendDirection: true } },
        },
      },
    },
    orderBy: { addedAt: 'desc' },
  })

  return NextResponse.json(items)
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await req.json()
  if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 })

  const user = await prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email: `${clerkId}@placeholder.com` },
    update: {},
  })

  const item = await prisma.watchlistItem.upsert({
    where: { userId_cardId: { userId: user.id, cardId } },
    create: { userId: user.id, cardId },
    update: {},
  })

  return NextResponse.json(item, { status: 201 })
}
