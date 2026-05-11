/**
 * POST /api/admin/sync-fr-names
 * Récupère les noms français depuis TCGdex et les stocke dans Card.localeName.fr
 * Peut être appelé plusieurs fois (idempotent). Traite par batch de sets.
 *
 * Query params:
 *   ?setId=sv01        → traiter un seul set TCGdex
 *   ?onlyMissing=true  → ne traiter que les cartes sans nom FR (défaut: true)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

// Mapping ptcgId (préfixe de Card.externalId) → tcgdexId (pour l'API TCGdex FR)
const PTCG_TO_TCGDEX: Record<string, string> = {
  // Scarlet & Violet
  sv1: 'sv01', sv2: 'sv02', sv3: 'sv03', sv3pt5: 'sv03.5',
  sv4: 'sv04', sv4pt5: 'sv04.5', sv5: 'sv05', sv6: 'sv06',
  sv6pt5: 'sv06.5', sv7: 'sv07', sv8: 'sv08', sv8pt5: 'sv08.5',
  sv9: 'sv09', sv10: 'sv10', rsv10pt5: 'sv10.5w', zsv10pt5: 'sv10.5b',
  svp: 'svp',
  // Sword & Shield
  swsh1: 'swsh01', swsh2: 'swsh02', swsh3: 'swsh03', swsh35: 'swsh03.5',
  swsh4: 'swsh04', swsh45: 'swsh04.5', swsh5: 'swsh05', swsh6: 'swsh06',
  swsh7: 'swsh07', swsh8: 'swsh08', swsh9: 'swsh09', swsh10: 'swsh10',
  swsh11: 'swsh11', swsh12: 'swsh12', swsh12pt5: 'swsh12.5',
  // Sun & Moon
  sm1: 'sm01', sm2: 'sm02', sm3: 'sm03', sm35: 'sm03.5',
  sm4: 'sm04', sm5: 'sm05', sm6: 'sm06', sm7: 'sm07',
  sm8: 'sm08', sm9: 'sm09', sm10: 'sm10', sm11: 'sm11',
  sm115: 'sm11.5', sm12: 'sm12',
  // XY
  xy1: 'xy01', xy2: 'xy02', xy3: 'xy03', xy4: 'xy04',
  xy5: 'xy05', xy6: 'xy06', xy7: 'xy07', xy8: 'xy08',
  xy9: 'xy09', xy10: 'xy10', xy11: 'xy11', xy12: 'xy12',
  xyp: 'xyp',
}

async function fetchFrNames(tcgdexId: string): Promise<Record<string, string>> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/fr/sets/${tcgdexId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return {}
    const data = await res.json()
    const map: Record<string, string> = {}
    for (const c of data?.cards ?? []) {
      if (c.localId && c.name) map[String(c.localId)] = c.name
    }
    return map
  } catch {
    return {}
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const targetSet = searchParams.get('setId') // optionnel
  const onlyMissing = searchParams.get('onlyMissing') !== 'false'

  // Charger les cartes concernées
  const cards = await prisma.card.findMany({
    select: { id: true, externalId: true, localeName: true },
    where: targetSet
      ? { externalId: { startsWith: targetSet.replace('tcgdex:', '') } }
      : undefined,
  })

  // Filtrer si onlyMissing — carte sans nom FR = localeName vide ou sans clé 'fr'
  const toProcess = onlyMissing
    ? cards.filter((c) => {
        const ln = c.localeName as Record<string, string> | null | undefined
        return !ln || !ln.fr || ln.fr.trim() === ''
      })
    : cards

  if (toProcess.length === 0) {
    return NextResponse.json({ ok: true, message: 'Aucune carte à traiter', updated: 0 })
  }

  // Grouper par ptcgId (préfixe du externalId)
  const byPtcgId: Record<string, typeof toProcess> = {}
  for (const card of toProcess) {
    // externalId format: "sv1-001" ou "swsh1-1"
    const parts = card.externalId.split('-')
    const prefix = parts.slice(0, parts.length - 1).join('-') || parts[0]
    if (!byPtcgId[prefix]) byPtcgId[prefix] = []
    byPtcgId[prefix].push(card)
  }

  let updated = 0
  let failed = 0
  const results: Record<string, number> = {}

  for (const [ptcgId, setCards] of Object.entries(byPtcgId)) {
    const tcgdexId = PTCG_TO_TCGDEX[ptcgId]
    if (!tcgdexId) {
      console.log(`⚠ Pas de mapping TCGdex pour: ${ptcgId}`)
      continue
    }

    const frNames = await fetchFrNames(tcgdexId)
    if (Object.keys(frNames).length === 0) {
      console.log(`✗ Aucun nom FR pour set ${tcgdexId}`)
      failed++
      continue
    }

    let setUpdated = 0
    for (const card of setCards) {
      // localId = partie après le dernier tiret
      const localId = card.externalId.split('-').pop() ?? ''
      // TCGdex localId peut être "001" ou "1"
      const frName = frNames[localId] ?? frNames[String(parseInt(localId, 10))]
      if (!frName) continue

      const existingLn = (card.localeName as any) ?? {}
      await prisma.card.update({
        where: { id: card.id },
        data: { localeName: { ...existingLn, fr: frName } },
      })
      setUpdated++
      updated++
    }

    results[ptcgId] = setUpdated
    console.log(`✓ ${ptcgId} → ${tcgdexId}: ${setUpdated}/${setCards.length} noms FR`)
    await sleep(200) // rate limit
  }

  return NextResponse.json({ ok: true, updated, failed, results })
}

// GET pour vérifier l'état
export async function GET() {
  const total = await prisma.card.count()
  const withFr = await prisma.card.count({
    where: {
      NOT: [
        { localeName: { equals: {} } },
        { localeName: { path: ['fr'], equals: null } },
      ],
    },
  })
  return NextResponse.json({ total, withFr, missing: total - withFr })
}
