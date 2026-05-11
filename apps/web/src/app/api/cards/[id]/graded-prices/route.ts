import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const data = await withCache(`card:${id}:graded`, 300, () =>
    prisma.gradedCardPrice.findMany({
      where: { cardId: id },
      orderBy: [{ company: 'asc' }, { grade: 'desc' }],
    }),
  )

  return NextResponse.json(data)
}
