import { NextRequest, NextResponse } from 'next/server'
import { getCardById } from '@/lib/db/getCard'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const card = await getCardById(id)
  if (!card) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(card)
}
