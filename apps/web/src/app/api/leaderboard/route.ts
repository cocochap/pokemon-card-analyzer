import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const revalidate = 3600 // cache 1h

export async function GET() {
  const entries = await prisma.leaderboardEntry.findMany({
    orderBy: { rank: 'asc' },
    take: 100,
    select: {
      rank: true,
      totalValue: true,
      cardCount: true,
      computedAt: true,
      user: {
        select: {
          id: true,
          displayName: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  })

  return NextResponse.json({
    entries: entries.map(e => ({
      rank: e.rank,
      totalValue: Number(e.totalValue),
      cardCount: e.cardCount,
      computedAt: e.computedAt.toISOString(),
      user: {
        id: e.user.id,
        displayName: e.user.displayName ?? e.user.username ?? 'Collectionneur',
        username: e.user.username,
        avatarUrl: e.user.avatarUrl,
      },
    })),
    updatedAt: entries[0]?.computedAt?.toISOString() ?? null,
  })
}
