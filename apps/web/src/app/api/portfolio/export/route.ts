import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserWithTier, isEliteTier } from '@/lib/subscription'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Connexion requise' }, { status: 401 })

  const user = await getUserWithTier(clerkId)
  if (!isEliteTier(user.tier as any)) {
    return NextResponse.json({ error: 'Abonnement Elite requis', requiresElite: true }, { status: 403 })
  }

  const portfolio = await prisma.portfolio.findUnique({
    where: { userId: user.id },
    include: {
      items: {
        include: {
          card: {
            include: {
              set: { select: { name: true, externalId: true } },
              prices: { where: { source: 'cardmarket' }, select: { market: true } },
            },
          },
        },
      },
    },
  })

  if (!portfolio) return NextResponse.json({ error: 'Portfolio vide' }, { status: 404 })

  const rows = portfolio.items.map(item => {
    const currentPrice = Number(item.card.prices?.[0]?.market ?? 0)
    const purchasePrice = Number(item.purchasePrice ?? 0)
    const qty = item.quantity
    const totalValue = currentPrice * qty
    const totalCost = purchasePrice * qty
    const pnl = totalValue - totalCost
    const pnlPct = totalCost > 0 ? ((pnl / totalCost) * 100).toFixed(2) : ''

    return [
      `"${item.card.name.replace(/"/g, '""')}"`,
      `"${item.card.set?.name ?? ''}"`,
      item.card.set?.externalId ?? '',
      item.card.number ?? '',
      item.card.rarity ?? '',
      item.variant,
      qty,
      purchasePrice.toFixed(2),
      currentPrice.toFixed(2),
      totalValue.toFixed(2),
      totalCost.toFixed(2),
      pnl.toFixed(2),
      pnlPct,
      item.grade ?? '',
      item.gradeCompany ?? '',
      item.purchasedAt ? new Date(item.purchasedAt).toISOString().slice(0, 10) : '',
      `"${(item.notes ?? '').replace(/"/g, '""')}"`,
    ].join(',')
  })

  const header = [
    'Carte', 'Extension', 'Code Extension', 'Numéro', 'Rareté', 'Variante',
    'Quantité', 'Prix Achat (€)', 'Prix Actuel (€)', 'Valeur Totale (€)',
    'Coût Total (€)', 'P&L (€)', 'P&L (%)', 'Note', 'Gradeur',
    'Date Achat', 'Notes',
  ].join(',')

  const csv = [header, ...rows].join('\n')
  const date = new Date().toISOString().slice(0, 10)

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="pokescard-portfolio-${date}.csv"`,
    },
  })
}
