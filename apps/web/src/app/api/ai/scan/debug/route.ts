/**
 * GET /api/ai/scan/debug?name=Charizard+VMAX&number=SV107&setId=swsh45sv
 * Tests DB lookup strategies used in the scan route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const name   = req.nextUrl.searchParams.get('name') ?? ''
  const number = req.nextUrl.searchParams.get('number') ?? ''
  const setId  = req.nextUrl.searchParams.get('setId') ?? ''

  const numFull  = number.split('/')[0].trim().toUpperCase()
  const numClean = numFull.replace(/^0+(?=[0-9])/, '')

  const results: Record<string, any> = {}

  // Test 1: exact externalId
  for (const extId of [`${setId}-${numFull}`, `${setId}-${numClean}`, `${setId}-${number}`]) {
    if (!setId) break
    const r = await prisma.card.findUnique({ where: { externalId: extId }, select: { id: true, name: true, number: true } })
    if (r) { results.exactId = { extId, card: r }; break }
  }

  // Test 2: name + set
  results.nameAndSet = await prisma.card.count({
    where: { name: { contains: name, mode: 'insensitive' }, set: { externalId: setId } },
  })

  // Test 3: number alone across all sets
  const byNumber = await prisma.card.findMany({
    where: { number: numFull },
    select: { id: true, name: true, number: true, set: { select: { externalId: true, name: true } } },
    take: 10,
  })
  results.byNumberAlone = { count: byNumber.length, cards: byNumber }

  // Test 4: number without prefix across all sets
  if (numFull !== numClean) {
    const byClean = await prisma.card.findMany({
      where: { number: numClean },
      select: { id: true, name: true, number: true, set: { select: { externalId: true } } },
      take: 5,
    })
    results.byNumberClean = byClean
  }

  // Test 5: name + number (no set restriction)
  const byNameNum = await prisma.card.findMany({
    where: {
      name: { contains: name, mode: 'insensitive' },
      OR: [{ number: numFull }, { number: numClean }],
    },
    select: { id: true, name: true, number: true, set: { select: { externalId: true, name: true } } },
    take: 10,
  })
  results.byNameAndNumber = { count: byNameNum.length, cards: byNameNum }

  // Test 6: SV prefix sets
  const svSets = ['swsh45sv', 'swsh4sv', 'swsh35sv', 'pgo']
  const bySetHints: any[] = []
  for (const s of svSets) {
    const r = await prisma.card.findUnique({
      where: { externalId: `${s}-${numFull}` },
      select: { id: true, name: true, number: true, set: { select: { externalId: true } } },
    })
    if (r) bySetHints.push({ tried: `${s}-${numFull}`, card: r })
  }
  results.bySetHints = bySetHints

  return NextResponse.json({ name, number, numFull, numClean, setId, results })
}
