/**
 * GET /api/ai/scan/debug?name=Pikachu&number=58&setId=base1
 * Teste la recherche DB sans IA — pour diagnostiquer les problèmes de matching.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const name   = req.nextUrl.searchParams.get('name') ?? ''
  const number = req.nextUrl.searchParams.get('number') ?? ''
  const setId  = req.nextUrl.searchParams.get('setId') ?? ''

  const results: Record<string, any> = {}

  // Test 1: exact name
  results.exactName = await prisma.card.count({
    where: { name: { equals: name, mode: 'insensitive' } },
  })

  // Test 2: contains name
  results.containsName = await prisma.card.count({
    where: { name: { contains: name, mode: 'insensitive' } },
  })

  // Test 3: French name via raw SQL
  const frMatches = await prisma.$queryRaw<{id: string; name: string; number: string; set_id: string}[]>`
    SELECT c.id, c.name, c.number, c."setId"
    FROM "Card" c
    WHERE c."localeName"->>'fr' ILIKE ${`%${name}%`}
    LIMIT 10
  `
  results.frenchName = frMatches.length
  results.frenchSamples = frMatches.slice(0, 3)

  // Test 4: with set
  if (setId) {
    results.nameAndSet = await prisma.card.count({
      where: { name: { contains: name, mode: 'insensitive' }, set: { externalId: setId } },
    })
  }

  // Test 5: sample cards with this name
  const samples = await prisma.card.findMany({
    where: { name: { contains: name, mode: 'insensitive' } },
    select: { id: true, name: true, number: true, set: { select: { externalId: true, name: true } } },
    take: 5,
  })
  results.samples = samples

  // Test 6: externalId
  if (setId && number) {
    const numClean = number.split('/')[0].replace(/^0+/, '')
    results.externalIds = {
      tried: [`${setId}-${number}`, `${setId}-${numClean}`],
      found: await prisma.card.count({ where: { externalId: { in: [`${setId}-${number}`, `${setId}-${numClean}`] } } }),
    }
  }

  return NextResponse.json({ name, number, setId, results })
}
