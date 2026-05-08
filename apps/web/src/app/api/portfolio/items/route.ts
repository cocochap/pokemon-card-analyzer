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
    include: { portfolio: true },
  })

  const portfolio = user.portfolio ?? await prisma.portfolio.create({
    data: { userId: user.id },
  })

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
