import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function PATCH(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const { isPublic } = await req.json()
  if (typeof isPublic !== 'boolean') return NextResponse.json({ error: 'isPublic must be boolean' }, { status: 400 })

  const portfolio = await prisma.portfolio.upsert({
    where: { userId: user.id },
    create: { userId: user.id, isPublic },
    update: { isPublic },
    select: { id: true, isPublic: true },
  })

  // Retire du leaderboard si la collection est rendue privée
  if (!isPublic) {
    await prisma.leaderboardEntry.deleteMany({ where: { portfolioId: portfolio.id } })
  }

  return NextResponse.json({ ok: true, isPublic: portfolio.isPublic })
}
