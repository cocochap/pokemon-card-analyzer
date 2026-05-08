import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

async function getPortfolioId(clerkId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: { portfolio: { select: { id: true } } },
  })
  return user?.portfolio?.id ?? null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params
  const portfolioId = await getPortfolioId(clerkId)
  if (!portfolioId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Vérifie que l'item appartient bien à ce portfolio
  const existing = await prisma.portfolioItem.findFirst({
    where: { id: itemId, portfolioId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await prisma.portfolioItem.update({
    where: { id: itemId },
    data: {
      quantity: body.quantity,
      purchasePrice: body.purchasePrice,
      notes: body.notes,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { itemId } = await params
  const portfolioId = await getPortfolioId(clerkId)
  if (!portfolioId) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const existing = await prisma.portfolioItem.findFirst({
    where: { id: itemId, portfolioId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.portfolioItem.delete({ where: { id: itemId } })
  return new NextResponse(null, { status: 204 })
}
