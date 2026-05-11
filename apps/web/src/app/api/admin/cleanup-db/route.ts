/**
 * POST /api/admin/cleanup-db
 * Optimise la DB pour tenir dans 512MB (Neon free tier).
 *
 * ?action=table-sizes       → voir la taille de chaque table
 * ?action=slim-cards        → vider les champs jeu inutiles (attacks, abilities, etc.)
 * ?action=delete-sales      → supprimer toutes les ventes simulées
 * ?action=delete-ai         → supprimer analyses IA (recalculées à la demande)
 * ?action=delete-history    → supprimer tout l'historique de prix (recréé par cron)
 * ?action=sparse-history    → garder 1 point/semaine (moins agressif)
 * ?action=vacuum            → forcer VACUUM
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const action = req.nextUrl.searchParams.get('action') ?? 'table-sizes'

  // ── Taille des tables ────────────────────────────────────────────────────
  if (action === 'table-sizes') {
    const sizes = await prisma.$queryRaw<{ table_name: string; size: string; rows: bigint }[]>`
      SELECT
        relname AS table_name,
        pg_size_pretty(pg_total_relation_size(relid)) AS size,
        n_live_tup AS rows
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 20
    `
    return NextResponse.json({ ok: true, tables: sizes.map(r => ({ ...r, rows: Number(r.rows) })) })
  }

  // ── Vider champs jeu (attacks, abilities, weaknesses, etc.) ─────────────
  if (action === 'slim-cards') {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '1000')
    // Mettre à [] les tableaux JSON volumineux inutiles pour le tracking de prix
    const result = await prisma.$executeRaw`
      UPDATE "Card"
      SET
        attacks = '[]'::jsonb,
        abilities = '[]'::jsonb,
        weaknesses = '[]'::jsonb,
        resistances = '[]'::jsonb,
        "retreatCost" = ARRAY[]::text[],
        "flavorText" = NULL
      WHERE
        (attacks != '[]'::jsonb OR abilities != '[]'::jsonb OR weaknesses != '[]'::jsonb)
        AND id IN (SELECT id FROM "Card" WHERE attacks != '[]'::jsonb OR abilities != '[]'::jsonb LIMIT ${limit})
    `
    return NextResponse.json({ ok: true, action, updated: result })
  }

  // ── Supprimer toutes les ventes simulées ─────────────────────────────────
  if (action === 'delete-sales') {
    const result = await prisma.saleEvent.deleteMany({})
    return NextResponse.json({ ok: true, action, deleted: result.count })
  }

  // ── Supprimer analyses IA (recalculées à la demande) ────────────────────
  if (action === 'delete-ai') {
    // Supprimer les PricePrediction d'abord (FK)
    const pred = await prisma.pricePrediction.deleteMany({})
    const ai = await prisma.cardAiAnalysis.deleteMany({})
    return NextResponse.json({ ok: true, action, deletedPredictions: pred.count, deletedAnalyses: ai.count })
  }

  // ── Supprimer tout l'historique (le cron recréera 1 point/jour) ──────────
  if (action === 'delete-history') {
    const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '200000')
    const result = await prisma.$executeRaw`
      DELETE FROM "PriceHistory"
      WHERE id IN (SELECT id FROM "PriceHistory" LIMIT ${limit})
    `
    return NextResponse.json({ ok: true, action, deleted: result })
  }

  // ── Sparse history (1 point/semaine) ────────────────────────────────────
  if (action === 'sparse-history') {
    const result = await prisma.$executeRaw`
      DELETE FROM "PriceHistory"
      WHERE id IN (
        SELECT id FROM "PriceHistory"
        WHERE EXTRACT(DOW FROM "recordedAt") != 1
        AND "recordedAt" < NOW() - INTERVAL '7 days'
        LIMIT 100000
      )
    `
    return NextResponse.json({ ok: true, action, deleted: result as number })
  }

  // ── VACUUM ───────────────────────────────────────────────────────────────
  if (action === 'vacuum') {
    try {
      await prisma.$executeRawUnsafe('VACUUM ANALYZE "PriceHistory"')
      await prisma.$executeRawUnsafe('VACUUM ANALYZE "Card"')
      await prisma.$executeRawUnsafe('VACUUM ANALYZE "SaleEvent"')
      return NextResponse.json({ ok: true, action: 'vacuum', message: 'VACUUM ANALYZE exécuté' })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e.message })
    }
  }

  return NextResponse.json({ ok: false, error: 'Action inconnue' }, { status: 400 })
}

export async function GET() {
  const [history, sales, cards, ai, pred] = await Promise.all([
    prisma.priceHistory.count(),
    prisma.saleEvent.count(),
    prisma.card.count(),
    prisma.cardAiAnalysis.count(),
    prisma.pricePrediction.count(),
  ])
  return NextResponse.json({ priceHistory: history, saleEvents: sales, cards, aiAnalyses: ai, predictions: pred })
}
