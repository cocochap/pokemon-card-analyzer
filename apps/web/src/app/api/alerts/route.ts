import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const CreateAlertSchema = z.object({
  cardId: z.string(),
  type: z.enum(['PRICE_ABOVE', 'PRICE_BELOW', 'PRICE_CHANGE_PERCENT', 'VOLUME_SPIKE', 'AI_SIGNAL']),
  targetValue: z.number().positive().optional(),
  targetPercent: z.number().optional(),
  source: z.string().optional(),
  variant: z.string().optional().default('NORMAL'),
  notifyEmail: z.boolean().optional().default(true),
  notifyPush: z.boolean().optional().default(false),
})

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({ where: { clerkId }, select: { id: true } })
  if (!user) return NextResponse.json([])

  const alerts = await prisma.alert.findMany({
    where: { userId: user.id },
    include: {
      card: { select: { id: true, name: true, imageSmUrl: true, rarity: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(alerts)
}

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = CreateAlertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const user = await prisma.user.upsert({
    where: { clerkId },
    create: { clerkId, email: `${clerkId}@placeholder.com` },
    update: {},
  })

  const alert = await prisma.alert.create({
    data: {
      userId: user.id,
      cardId: parsed.data.cardId,
      type: parsed.data.type,
      targetValue: parsed.data.targetValue,
      targetPercent: parsed.data.targetPercent,
      source: parsed.data.source,
      variant: parsed.data.variant as any,
      notifyEmail: parsed.data.notifyEmail,
      notifyPush: parsed.data.notifyPush,
    },
    include: {
      card: { select: { id: true, name: true, imageSmUrl: true } },
    },
  })

  return NextResponse.json(alert, { status: 201 })
}
