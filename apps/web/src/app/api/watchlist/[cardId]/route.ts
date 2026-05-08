import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ isWatchlisted: false })

  const { cardId } = await params
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json({ isWatchlisted: false })

  const item = await prisma.watchlistItem.findUnique({
    where: { userId_cardId: { userId: user.id, cardId } },
    select: { id: true },
  })

  return NextResponse.json({ isWatchlisted: !!item })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ cardId: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { cardId } = await params
  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return new NextResponse(null, { status: 204 })

  await prisma.watchlistItem.deleteMany({
    where: { userId: user.id, cardId },
  })

  return new NextResponse(null, { status: 204 })
}
