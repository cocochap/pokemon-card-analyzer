/**
 * POST /api/admin/cleanup-db
 * Libère de l'espace en supprimant les données inutiles.
 * ?action=old-history   → supprimer l'historique de prix > 90 jours
 * ?action=sparse-history → garder 1 point par semaine au lieu de 1 par jour
 * ?action=pocket-history → supprimer l'historique pour cartes sans prix réel
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') ?? 'old-history'

  let deleted = 0

  if (action === 'old-history') {
    // Supprimer l'historique > 90 jours
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 90)
    const result = await prisma.priceHistory.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    })
    deleted = result.count

  } else if (action === 'pocket-history') {
    // Supprimer tout l'historique des sets digitaux (pas de vrais prix)
    const pocketSets = await prisma.pokemonSet.findMany({
      where: { externalId: { in: ['A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a','B1','B1a','B2','B2a','P-A','me01','me02','me02.5','me03','mee','mep'] } },
      select: { id: true },
    })
    const cardIds = (await prisma.card.findMany({
      where: { setId: { in: pocketSets.map((s) => s.id) } },
      select: { id: true },
    })).map((c) => c.id)

    if (cardIds.length > 0) {
      const result = await prisma.priceHistory.deleteMany({
        where: { cardId: { in: cardIds } },
      })
      deleted = result.count
    }

  } else if (action === 'sparse-history') {
    // Garder 1 point par semaine : supprimer tout ce qui n'est pas un lundi
    // + garder les 7 derniers jours intacts
    // Batch de 50K pour éviter timeout
    const result = await prisma.$executeRaw`
      DELETE FROM "PriceHistory"
      WHERE id IN (
        SELECT id FROM "PriceHistory"
        WHERE EXTRACT(DOW FROM "recordedAt") != 1
        AND "recordedAt" < NOW() - INTERVAL '7 days'
        LIMIT 100000
      )
    `
    deleted = result as number

  } else if (action === 'sale-events') {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 60)
    const result = await prisma.saleEvent.deleteMany({
      where: { soldAt: { lt: cutoff } },
    })
    deleted = result.count

  } else if (action === 'vacuum') {
    // Forcer VACUUM pour récupérer l'espace disque après suppression
    try {
      await prisma.$executeRawUnsafe('VACUUM "PriceHistory"')
      await prisma.$executeRawUnsafe('VACUUM "CardPrice"')
      return NextResponse.json({ ok: true, action: 'vacuum', message: 'VACUUM exécuté' })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message })
    }

  } else if (action === 'delete-all-history') {
    // Supprimer TOUT l'historique sauf les 30 derniers jours
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 30)
    const result = await prisma.priceHistory.deleteMany({
      where: { recordedAt: { lt: cutoff } },
    })
    deleted = result.count
  }

  return NextResponse.json({ ok: true, action, deleted })
}

export async function GET() {
  const [history, sales, total] = await Promise.all([
    prisma.priceHistory.count(),
    prisma.saleEvent.count(),
    prisma.card.count(),
  ])
  return NextResponse.json({ priceHistory: history, saleEvents: sales, cards: total })
}
