import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET() {
  const data = await withCache('sets:all', 300, async () => {
    return prisma.pokemonSet.findMany({
      orderBy: { releaseDate: 'desc' },
      include: { _count: { select: { cards: true } } },
    })
  })
  return NextResponse.json(data)
}
