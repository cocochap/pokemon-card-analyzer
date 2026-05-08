import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { clerkId },
    include: {
      portfolio: {
        include: {
          items: {
            include: {
              card: {
                include: {
                  prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' }, take: 1 },
                  marketData: { select: { priceChange24h: true, priceChange7d: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  if (!user?.portfolio) {
    // Crée automatiquement le portfolio au premier accès
    const newPortfolio = await prisma.portfolio.create({
      data: {
        user: { connect: { clerkId } },
      },
      include: { items: true },
    })
    return NextResponse.json({ ...newPortfolio, totalValue: 0, totalCost: 0, cardCount: 0, bestCard: null })
  }

  const { portfolio } = user
  let totalValue = 0
  let totalCost = 0
  let bestCard: { name: string; roi: number } | null = null
  let bestRoi = -Infinity

  for (const item of portfolio.items) {
    const currentPrice = Number(item.card.prices[0]?.market ?? 0)
    const itemValue = currentPrice * item.quantity
    const itemCost = Number(item.purchasePrice ?? 0) * item.quantity

    totalValue += itemValue
    totalCost += itemCost

    if (item.purchasePrice && currentPrice > 0) {
      const roi = ((currentPrice - Number(item.purchasePrice)) / Number(item.purchasePrice)) * 100
      if (roi > bestRoi) {
        bestRoi = roi
        bestCard = { name: item.card.name, roi }
      }
    }
  }

  return NextResponse.json({
    ...portfolio,
    totalValue,
    totalCost,
    cardCount: portfolio.items.length,
    bestCard,
  })
}
