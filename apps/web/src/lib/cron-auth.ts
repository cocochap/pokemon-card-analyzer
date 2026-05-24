import { NextRequest, NextResponse } from 'next/server'

/**
 * Vérifie le CRON_SECRET sur toutes les routes cron.
 * Compatible Vercel (envoie automatiquement le header) et cron-job.org (header manuel).
 * Retourne une Response 401 si non autorisé, null si OK.
 */
export function checkCronAuth(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
