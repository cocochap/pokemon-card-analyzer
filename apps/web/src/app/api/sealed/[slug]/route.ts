import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const product = await prisma.sealedProduct.findUnique({
    where: { slug },
    include: {
      priceHistory: {
        orderBy: { recordedAt: 'asc' },
        select: { price: true, recordedAt: true, source: true },
      },
    },
  })

  if (!product) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })

  const currentMarketPrice = product.priceHistory.at(-1)?.price ?? product.retailPrice ?? 0

  return NextResponse.json({ ...product, currentMarketPrice })
}
