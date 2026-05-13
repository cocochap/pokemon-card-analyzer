import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const AddItemSchema = z.object({
  cardId: z.string(),
  variant: z.string().optional().default('NORMAL'),
  quantity: z.number().int().positive().default(1),
  purchasePrice: z.number().positive().optional(),
  purchasedAt: z.string().optional(),
  grade: z.number().optional(),
  gradeCompany: z.string().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = AddItemSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { cardId, variant, quantity, purchasePrice, purchasedAt, grade, gradeCompany, notes } = parsed.data

  // Récupère ou crée l'utilisateur + son portfolio
  const user = await prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email: `${clerkId}@placeholder.com` },
    update: {},
    include: { portfolio: { include: { _count: { select: { items: true } } } } },
  })

  const portfolio = user.portfolio ?? await prisma.portfolio.create({
    data: { userId: user.id },
    include: { _count: { select: { items: true } } },
  })

  // Enforce portfolio limit per tier
  const { getLimits } = await import('@/lib/subscription')
  const limits = getLimits(user.tier as any)
  if (limits.portfolioCards !== Infinity) {
    const itemCount = user.portfolio?._count?.items ?? 0
    if (itemCount >= limits.portfolioCards) {
      return NextResponse.json({
        error: `Limite de ${limits.portfolioCards} cartes atteinte. Passez à Premium pour un portfolio illimité.`,
        limitReached: true,
        upgradeUrl: '/pricing',
      }, { status: 403 })
    }
  }

  const item = await prisma.portfolioItem.create({
    data: {
      portfolioId: portfolio.id,
      cardId,
      variant: variant as any,
      quantity,
      purchasePrice,
      purchasedAt: purchasedAt ? new Date(purchasedAt) : undefined,
      grade,
      gradeCompany: gradeCompany as any,
      notes,
    },
    include: {
      card: { select: { name: true, imageSmUrl: true, rarity: true } },
    },
  })

  return NextResponse.json(item, { status: 201 })
}
