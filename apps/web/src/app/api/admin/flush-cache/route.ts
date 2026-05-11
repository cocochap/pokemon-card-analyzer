import { NextRequest, NextResponse } from 'next/server'
import { flushAllCache } from '@/lib/db/redis'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret')
  if (secret !== (process.env.ADMIN_SECRET ?? 'pokemarket-flush-2024')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  await flushAllCache()
  return NextResponse.json({ ok: true, message: 'Cache Redis vidé' })
}
