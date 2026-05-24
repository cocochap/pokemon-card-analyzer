import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkCronAuth } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Pré-chauffe la base Neon avant les crons principaux.
 * Planifié à 5h45 UTC (15 min avant update-prices à 6h00).
 * Neon free tier peut prendre 30-55s à se réveiller après inactivité.
 */
export async function GET(req: NextRequest) {
  const authErr = checkCronAuth(req)
  if (authErr) return authErr

  const start = Date.now()
  try {
    // Réveiller Neon + charger quelques données pour chauffer le cache
    await prisma.$queryRaw`SELECT 1`
    const cardCount = await prisma.card.count()
    const setCount  = await prisma.pokemonSet.count()
    const ms = Date.now() - start
    console.log(`[warmup] DB ready in ${ms}ms — ${cardCount} cards, ${setCount} sets`)
    return NextResponse.json({ ok: true, ms, cardCount, setCount })
  } catch (e: any) {
    console.error('[warmup] DB error:', e.message)
    return NextResponse.json({ ok: false, error: e.message }, { status: 503 })
  }
}
