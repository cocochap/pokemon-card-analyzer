/**
 * Cron unifié — tourne toutes les heures.
 *
 * Priorités :
 *   1. Si des sets manquent en base → les ajouter (10 par heure)
 *   2. Si tous les sets sont là → mettre à jour les prix du jour
 *   3. Mettre à jour les noms FR manquants
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { flushAllCache } from '@/lib/db/redis'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    const isLocal = req.nextUrl.hostname === 'localhost'
    if (!isLocal) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const base = req.nextUrl.origin
  const results: Record<string, any> = {}

  // 1. Sync sets manquants (10 sets par run)
  try {
    const syncRes = await fetch(`${base}/api/admin/sync-sets?limit=10`, {
      method: 'POST',
      signal: AbortSignal.timeout(200_000),
    })
    results.sets = await syncRes.json()
  } catch (e: any) {
    results.sets = { error: e.message }
  }

  // 2. Mise à jour des prix si on a du temps
  const setsRemaining = results.sets?.remaining ?? 0
  if (setsRemaining === 0) {
    try {
      const priceRes = await fetch(`${base}/api/cron/update-prices`, {
        signal: AbortSignal.timeout(60_000),
      })
      results.prices = await priceRes.json()
    } catch (e: any) {
      results.prices = { error: e.message }
    }
  }

  // 3. Sync noms FR manquants
  try {
    const frRes = await fetch(`${base}/api/admin/sync-fr-names`, {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
    })
    results.frNames = await frRes.json()
  } catch (e: any) {
    results.frNames = { error: e.message }
  }

  // 4. Invalider le cache
  try { await flushAllCache() } catch { /* non bloquant */ }

  return NextResponse.json({ ok: true, timestamp: new Date().toISOString(), ...results })
}
