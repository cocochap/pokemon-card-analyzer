import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserTier, isPremiumTier } from '@/lib/subscription'
import { withCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Connexion requise', requiresAuth: true }, { status: 401 })
  }

  const tier = await getUserTier(clerkId)
  if (!isPremiumTier(tier)) {
    return NextResponse.json({ error: 'Premium requis', requiresPremium: true }, { status: 403 })
  }

  const isElite = tier === 'ELITE'
  const period = new Date().toISOString().slice(0, 7)

  const data = await withCache(`sealed:picks:${period}:${isElite ? 'elite' : 'pro'}`, 600, async () => {
    // Si pas encore de picks générés ce mois, retourner les top produits directement
    const picks = await prisma.sealedPick.findMany({
      where: { period },
      include: { product: true },
      orderBy: [{ pickType: 'asc' }, { rank: 'asc' }],
    })

    if (picks.length > 0) {
      return { picks, source: 'picks' }
    }

    // Fallback : top produits par score
    const products = await prisma.sealedProduct.findMany({
      orderBy: { investmentScore: 'desc' },
      take: isElite ? 12 : 6,
      include: {
        priceHistory: {
          orderBy: { recordedAt: 'desc' },
          take: 1,
          select: { price: true },
        },
      },
    })

    return { products, source: 'direct' }
  })

  return NextResponse.json(data)
}
