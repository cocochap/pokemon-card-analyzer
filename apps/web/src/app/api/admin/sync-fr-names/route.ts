/**
 * POST /api/admin/sync-fr-names
 * Récupère les noms français depuis TCGdex et les stocke dans Card.localeName.fr
 * Traite set par set pour éviter de charger toutes les cartes d'un coup.
 *
 * Query params:
 *   ?setId=swsh1       → traiter un seul set
 *   ?setsLimit=20      → nb de sets par run (défaut: 20)
 *   ?offset=0          → index de départ pour la pagination
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

async function fetchFrNames(tcgdexId: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/fr/sets/${tcgdexId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const c of data?.cards ?? []) {
      if (c.localId && c.name) {
        map[String(c.localId)] = c.name
        // Stocker aussi sans zéro padding : "001" → "1"
        const num = parseInt(c.localId, 10)
        if (!isNaN(num)) map[String(num)] = c.name
      }
    }
    return map
  } catch { return {} }
}

/** Génère les candidats TCGdex ID depuis un pokemontcg.io set externalId */
function tcgdexCandidates(ptcgId: string): string[] {
  const explicit: Record<string, string> = {
    sv1: 'sv01', sv2: 'sv02', sv3: 'sv03', sv3pt5: 'sv03.5',
    sv4: 'sv04', sv4pt5: 'sv04.5', sv5: 'sv05', sv6: 'sv06',
    sv6pt5: 'sv06.5', sv7: 'sv07', sv8: 'sv08', sv8pt5: 'sv08.5',
    sv9: 'sv09', sv10: 'sv10', rsv10pt5: 'sv10.5w', zsv10pt5: 'sv10.5b',
    svp: 'svp',
    swsh1: 'swsh01', swsh2: 'swsh02', swsh3: 'swsh03', swsh35: 'swsh03.5',
    swsh4: 'swsh04', swsh45: 'swsh04.5', swsh5: 'swsh05', swsh6: 'swsh06',
    swsh7: 'swsh07', swsh8: 'swsh08', swsh9: 'swsh09', swsh10: 'swsh10',
    swsh11: 'swsh11', swsh12: 'swsh12', swsh12pt5: 'swsh12.5',
    swshp: 'swshp',
    sm1: 'sm01', sm2: 'sm02', sm3: 'sm03', sm35: 'sm03.5',
    sm4: 'sm04', sm5: 'sm05', sm6: 'sm06', sm7: 'sm07',
    sm8: 'sm08', sm9: 'sm09', sm10: 'sm10', sm11: 'sm11',
    sm115: 'sm11.5', sm12: 'sm12', sm75: 'sm7.5', sma: 'sma', smp: 'smp',
    xy1: 'xy01', xy2: 'xy02', xy3: 'xy03', xy4: 'xy04',
    xy5: 'xy05', xy6: 'xy06', xy7: 'xy07', xy8: 'xy08',
    xy9: 'xy09', xy10: 'xy10', xy11: 'xy11', xy12: 'xy12', xyp: 'xyp',
    bw1: 'bw1', bw2: 'bw2', bw3: 'bw3', bw4: 'bw4', bw5: 'bw5',
    bw6: 'bw6', bw7: 'bw7', bw8: 'bw8', bw9: 'bw9', bw10: 'bw10', bw11: 'bw11',
    bwp: 'bwp',
    hgss1: 'hgss1', hgss2: 'hgss2', hgss3: 'hgss3', hgss4: 'hgss4',
    hgssp: 'hgssp', col1: 'col1',
    pl1: 'pl1', pl2: 'pl2', pl3: 'pl3', pl4: 'pl4',
    dp1: 'dp1', dp2: 'dp2', dp3: 'dp3', dp4: 'dp4', dp5: 'dp5',
    dp6: 'dp6', dp7: 'dp7', dpp: 'dpp',
    ex1: 'ex1', ex2: 'ex2', ex3: 'ex3', ex4: 'ex4', ex5: 'ex5',
    ex6: 'ex6', ex7: 'ex7', ex8: 'ex8', ex9: 'ex9', ex10: 'ex10',
    ex11: 'ex11', ex12: 'ex12', ex13: 'ex13', ex14: 'ex14', ex15: 'ex15',
    ex16: 'ex16',
    neo1: 'neo1', neo2: 'neo2', neo3: 'neo3', neo4: 'neo4',
    base1: 'base1', base2: 'base2', base3: 'base3', base4: 'base5',
    base5: 'base5', base6: 'base6', basep: 'basep', np: 'np',
    gym1: 'gym1', gym2: 'gym2',
    ecard1: 'ecard1', ecard2: 'ecard2',
    mcd11: '2011bw', mcd12: '2012bw', mcd13: '2013bw',
    mcd14: '2014xy', mcd15: '2015xy', mcd16: '2016xy',
    mcd17: '2017sm', mcd18: '2018sm-fr', mcd19: '2019sm-fr',
    mcd21: '2021swsh', mcd22: '2022swsh', mcd23: '2023sv', mcd24: '2024sv',
    pgo: 'swsh10.5', g1: 'g1', det1: 'det1', pop1: 'pop1', pop2: 'pop2',
    pop3: 'pop3', pop4: 'pop4', pop5: 'pop5', pop6: 'pop6',
    pop7: 'pop7', pop8: 'pop8', pop9: 'pop9',
    cel25: 'cel25', me2: 'me02', me2pt5: 'me02.5', me1: 'me01',
  }

  const candidates: string[] = []
  if (explicit[ptcgId]) candidates.push(explicit[ptcgId])
  candidates.push(ptcgId) // essayer tel quel
  // Avec zéro padding
  const m = ptcgId.match(/^([a-z]+)(\d+)(.*)$/)
  if (m) candidates.push(`${m[1]}0${m[2]}${m[3]}`)
  return [...new Set(candidates)]
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const targetSet = searchParams.get('setId')
  const setsLimit = Math.min(30, parseInt(searchParams.get('setsLimit') ?? '20'))
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const startedAt = Date.now()
  const TIMEOUT_MS = 230_000

  // Charger les sets à traiter (paginé)
  const sets = await prisma.pokemonSet.findMany({
    select: { id: true, externalId: true },
    where: targetSet ? { externalId: targetSet } : undefined,
    orderBy: { releaseDate: 'desc' },
    skip: offset,
    take: setsLimit,
  })

  if (sets.length === 0) {
    return NextResponse.json({ ok: true, message: 'Tous les sets traités', updated: 0 })
  }

  let updated = 0
  let failed = 0
  const results: Record<string, number> = {}

  for (const dbSet of sets) {
    if (Date.now() - startedAt > TIMEOUT_MS) break
    const ptcgId = dbSet.externalId

    // Chercher les noms FR dans TCGdex
    const candidates = tcgdexCandidates(ptcgId)
    let frNames: Record<string, string> = {}
    for (const cand of candidates) {
      frNames = await fetchFrNames(cand)
      if (Object.keys(frNames).length > 0) break
    }

    if (Object.keys(frNames).length === 0) { failed++; continue }

    // Charger les cartes de ce set
    const cards = await prisma.card.findMany({
      where: { setId: dbSet.id },
      select: { id: true, number: true, localeName: true },
    })

    let setUpdated = 0
    for (const card of cards) {
      const num = card.number ?? ''
      const frName = frNames[num] ?? frNames[String(parseInt(num, 10))]
      if (!frName) continue
      const existing = (card.localeName as Record<string, string> | null) ?? {}
      if (existing.fr === frName) continue // déjà à jour

      await prisma.card.update({
        where: { id: card.id },
        data: { localeName: { ...existing, fr: frName } },
      })
      setUpdated++
      updated++
    }

    results[ptcgId] = setUpdated
    await sleep(150)
  }

  const totalSets = await prisma.pokemonSet.count()
  const nextOffset = offset + sets.length

  return NextResponse.json({
    ok: true,
    updated,
    failed,
    results,
    nextOffset,
    remaining: Math.max(0, totalSets - nextOffset),
    message: nextOffset >= totalSets
      ? 'Tous les sets traités ✓'
      : `Continuer avec ?offset=${nextOffset}`,
  })
}

export async function GET() {
  const total = await prisma.card.count()
  const withFr = await prisma.card.count({
    where: { localeName: { path: ['fr'], not: '' } },
  })
  return NextResponse.json({ total, withFr, missing: total - withFr })
}
