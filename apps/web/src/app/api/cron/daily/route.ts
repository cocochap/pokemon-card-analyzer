/**
 * Master cron quotidien — un seul job cron-job.org suffit.
 * Déclenche tous les sous-crons en parallèle (chacun tourne
 * comme une fonction Vercel indépendante jusqu'à 300s).
 * Ce handler répond en <2s, les sous-crons continuent seuls.
 */
import { NextRequest, NextResponse } from 'next/server'
import { checkCronAuth } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 30

const CRONS = [
  '/api/cron/warmup',
  '/api/cron/update-prices',
  '/api/cron/update-prices-fr',
  '/api/cron/leaderboard',
]

export async function GET(req: NextRequest) {
  const authErr = checkCronAuth(req)
  if (authErr) return authErr

  const base = 'https://www.pokescard.fr'
  const auth = req.headers.get('authorization') ?? ''

  // Chaque fetch crée une invocation Vercel indépendante — ils tournent
  // même après que ce handler réponde. On attend juste que les connexions
  // HTTP soient établies (pas la fin du traitement).
  const results = await Promise.allSettled(
    CRONS.map(path =>
      fetch(`${base}${path}`, {
        headers: { Authorization: auth },
        signal: AbortSignal.timeout(5000), // attend juste l'accusé de réception
      }).then(r => ({ path, status: r.status }))
    )
  )

  const summary = results.map((r, i) => ({
    cron: CRONS[i],
    triggered: r.status === 'fulfilled',
    httpStatus: r.status === 'fulfilled' ? r.value.status : null,
  }))

  console.log('[daily] crons déclenchés:', JSON.stringify(summary))
  return NextResponse.json({ ok: true, summary })
}
