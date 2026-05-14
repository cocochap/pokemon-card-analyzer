import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json([])

  const items = await prisma.sealedPortfolioItem.findMany({
    where: { userId: user.id },
    include: {
      product: {
        include: {
          priceHistory: {
            orderBy: { recordedAt: 'desc' },
            take: 1,
            select: { price: true },
          },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(items.map(item => ({
    ...item,
    product: {
      ...item.product,
      currentMarketPrice: item.product.priceHistory[0]?.price ?? item.product.retailPrice ?? null,
      priceHistory: undefined,
    },
  })))
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { productId, quantity, purchasePrice, purchasedAt, notes } = await req.json()
  if (!productId) return NextResponse.json({ error: 'productId requis' }, { status: 400 })

  const user = await prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email: `${clerkId}@placeholder.com` },
    update: {},
  })

  const item = await prisma.sealedPortfolioItem.create({
    data: {
      userId: user.id,
      productId,
      quantity: quantity ?? 1,
      purchasePrice: purchasePrice ?? null,
      purchasedAt: purchasedAt ? new Date(purchasedAt) : null,
      notes: notes ?? null,
    },
    include: { product: true },
  })

  return NextResponse.json(item, { status: 201 })
}
