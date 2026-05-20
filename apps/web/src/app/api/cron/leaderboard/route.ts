import { NextRequest, NextResponse } from 'next/server'
import { computeLeaderboard } from '@/lib/leaderboard'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const skipAgeCheck = req.nextUrl.searchParams.get('init') === 'true'
  const result = await computeLeaderboard(skipAgeCheck)

  console.log(`[leaderboard] ${result.count} portfolios ranked`)
  return NextResponse.json({ ok: true, ...result })
}
