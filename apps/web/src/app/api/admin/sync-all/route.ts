/**
 * POST /api/admin/sync-all
 * Importe tous les sets pokemontcg.io manquants en un seul appel.
 * Appelable plusieurs fois : reprend là où ça s'est arrêté.
 *
 * ?batchSize=5  → sets par appel interne (défaut: 5)
 * ?dryRun=true  → affiche les manquants sans importer
 *
 * GET → état actuel (sets manquants, progression)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

export async function GET() {
  const [dbSets, ptcgData] = await Promise.all([
    prisma.pokemonSet.findMany({ select: { externalId: true, name: true } }),
    fetch('https://api.pokemontcg.io/v2/sets?pageSize=250&orderBy=-releaseDate', {
      signal: AbortSignal.timeout(15000),
    }).then(r => r.json()).catch(() => ({ data: [], totalCount: 0 })),
  ])

  const existingIds = new Set(dbSets.map(s => s.externalId))
  const allPtcgSets: any[] = ptcgData.data ?? []
  const missing = allPtcgSets.filter(s => !existingIds.has(s.id))

  return NextResponse.json({
    totalPtcgSets:  allPtcgSets.length,
    inOurDb:        dbSets.length,
    missingSets:    missing.length,
    missing:        missing.map(s => ({ id: s.id, name: s.name, releaseDate: s.releaseDate })),
    coverage:       `${((dbSets.length / Math.max(allPtcgSets.length, 1)) * 100).toFixed(1)}%`,
  })
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const batchSize = Math.min(10, parseInt(searchParams.get('batchSize') ?? '5'))
  const dryRun    = searchParams.get('dryRun') === 'true'
  const startAt   = Date.now()
  const TIMEOUT   = 260_000 // 4m20s — leave margin for Vercel 300s limit

  // 1. Fetch all ptcg sets
  let allPtcgSets: any[] = []
  try {
    let page = 1
    while (true) {
      const r = await fetch(`https://api.pokemontcg.io/v2/sets?pageSize=250&page=${page}&orderBy=-releaseDate`, {
        signal: AbortSignal.timeout(15000),
      })
      if (!r.ok) break
      const d = await r.json()
      allPtcgSets.push(...(d.data ?? []))
      if ((d.data ?? []).length < 250) break
      page++
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Could not fetch ptcg sets: ${e.message}` }, { status: 502 })
  }

  // 2. Find missing sets
  const existingIds = new Set(
    (await prisma.pokemonSet.findMany({ select: { externalId: true } })).map(s => s.externalId)
  )
  const missing = allPtcgSets.filter(s => !existingIds.has(s.id))

  if (dryRun) {
    return NextResponse.json({
      ok: true, dryRun: true,
      totalPtcg: allPtcgSets.length, inDb: existingIds.size,
      missing: missing.map(s => s.id),
    })
  }

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, message: 'Tous les sets sont déjà importés ✓', imported: 0 })
  }

  // 3. Import batch by batch by calling sync-sets internally
  const toProcess = missing.slice(0, batchSize)
  const results: { setId: string; status: string; cards?: number }[] = []

  for (const ptcgSet of toProcess) {
    if (Date.now() - startAt > TIMEOUT) {
      results.push({ setId: ptcgSet.id, status: 'timeout — call again to continue' })
      break
    }

    try {
      const base = req.nextUrl.origin
      const url  = `${base}/api/admin/sync-sets?setId=${ptcgSet.id}&limit=1`
      const r    = await fetch(url, { method: 'POST', signal: AbortSignal.timeout(50000) })
      const d    = await r.json()

      results.push({
        setId:  ptcgSet.id,
        status: r.ok ? 'imported' : 'error',
        cards:  d.cardsAdded ?? 0,
      })
    } catch (e: any) {
      results.push({ setId: ptcgSet.id, status: `error: ${e.message?.slice(0, 50)}` })
    }
  }

  const importedCount = results.filter(r => r.status === 'imported').length
  const newMissing    = missing.length - importedCount

  return NextResponse.json({
    ok: true,
    imported:  importedCount,
    results,
    remaining: Math.max(0, newMissing),
    message:   newMissing > 0
      ? `${newMissing} sets restants — rappelle cet endpoint pour continuer`
      : 'Tous les sets importés ✓',
  })
}
