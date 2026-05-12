/**
 * POST /api/admin/purge-cards
 * Supprime TOUTES les cartes et extensions de la DB.
 * Conserve : users, portfolios, alerts, watchlists (les items orphelins seront
 * nettoyés automatiquement par les contraintes FK au prochain sync).
 *
 * ⚠️  Action irréversible — protégée par ?secret=ADMIN_SECRET
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (process.env.ADMIN_SECRET && secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const dryRun = req.nextUrl.searchParams.get('dryRun') === 'true'

  // Compter avant suppression
  const [cards, sets, prices, history, market, ai] = await Promise.all([
    prisma.card.count(),
    prisma.pokemonSet.count(),
    prisma.cardPrice.count(),
    prisma.priceHistory.count(),
    prisma.cardMarketData.count(),
    prisma.cardAiAnalysis.count(),
  ])

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      wouldDelete: { cards, sets, prices, history, market, ai },
      message: 'Ajoute ?dryRun=false pour exécuter',
    })
  }

  // Supprimer dans l'ordre (contraintes FK)
  await prisma.cardAiAnalysis.deleteMany()
  await prisma.pricePrediction.deleteMany()
  await prisma.cardMarketData.deleteMany()
  await prisma.priceHistory.deleteMany()
  await prisma.cardPrice.deleteMany()
  await prisma.gradedCardPrice.deleteMany()
  await prisma.saleEvent.deleteMany()
  await prisma.popularityMetric.deleteMany()
  await prisma.psaPopulation.deleteMany()
  // Portfolio items référencent Card — supprimer avant
  await prisma.portfolioItem.deleteMany()
  await prisma.watchlistItem.deleteMany()
  await prisma.alert.deleteMany()
  await prisma.card.deleteMany()
  await prisma.setMarketData.deleteMany()
  await prisma.pokemonSet.deleteMany()

  return NextResponse.json({
    ok: true,
    deleted: { cards, sets, prices, history, market, ai },
    message: 'Base vidée ✓ — Lance maintenant POST /api/admin/import-fr pour réimporter les cartes françaises.',
  })
}

export async function GET() {
  const [cards, sets] = await Promise.all([
    prisma.card.count(),
    prisma.pokemonSet.count(),
  ])
  return NextResponse.json({
    cards,
    sets,
    message: 'POST ?dryRun=true pour prévisualiser, POST ?dryRun=false pour purger',
  })
}
