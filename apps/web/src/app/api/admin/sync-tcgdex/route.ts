/**
 * POST /api/admin/sync-tcgdex
 *
 * Importe les sets depuis TCGdex FR (cartes avec noms français natifs).
 * Couvre : TCG Pocket (A1/A2/B1...), Méga-Évolution, Kits dresseur, promos.
 *
 * Query:
 *   ?category=pocket   → sets TCG Pocket uniquement
 *   ?category=mega     → sets Méga-Évolution
 *   ?category=kits     → kits dresseur
 *   ?category=special  → sets spéciaux (jumbo, promos, etc.)
 *   ?category=all      → tout
 *   ?setId=A1          → un set spécifique
 *   ?limit=5           → nb max de sets par run (défaut 5)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

const TCGDEX_FR = 'https://api.tcgdex.net/v2/fr'

// Mapping rareté TCGdex → enum Prisma
const TCGDEX_RARITY: Record<string, string> = {
  // TCG Pocket
  'Un Diamant':          'COMMON',
  'Deux Diamants':       'UNCOMMON',
  'Trois Diamants':      'RARE',
  'Quatre Diamants':     'RARE_ULTRA',
  'Un Étoile':           'ILLUSTRATION_RARE',
  'Deux Étoiles':        'SPECIAL_ILLUSTRATION_RARE',
  'Trois Étoiles':       'HYPER_RARE',
  'Couronne':            'CROWN_RARE',
  'Promo':               'PROMO',
  // Physique
  'Common':              'COMMON',
  'Uncommon':            'UNCOMMON',
  'Rare':                'RARE',
  'Rare Holo':           'RARE_HOLO',
  'Ultra Rare':          'RARE_ULTRA',
  'Secret Rare':         'RARE_SECRET',
  'Amazing Rare':        'AMAZING_RARE',
  'Shiny Rare':          'RARE_SHINY',
  'Rainbow Rare':        'RARE_RAINBOW',
  'Hyper Rare':          'HYPER_RARE',
  'Illustration Rare':   'ILLUSTRATION_RARE',
  'Special Illustration Rare': 'SPECIAL_ILLUSTRATION_RARE',
  'Crown Rare':          'CROWN_RARE',
  'Legend':              'LEGEND',
  'PROMO':               'PROMO',
}

// Sets à traiter par catégorie
const SETS_BY_CATEGORY: Record<string, string[]> = {
  pocket: [
    'P-A', 'A1', 'A1a', 'A2', 'A2a', 'A2b',
    'A3', 'A3a', 'A3b', 'A4', 'A4a',
    'B1', 'B1a', 'B2', 'B2a',
  ],
  mega: ['mee', 'mep', 'me01', 'me02', 'me02.5', 'me03'],
  kits: [
    'tk-ex-latia', 'tk-ex-latio', 'tk-ex-m', 'tk-ex-p',
    'tk-dp-l', 'tk-dp-m',
    'tk-hs-g', 'tk-hs-r',
    'tk-bw-e', 'tk-bw-z',
    'tk-xy-n', 'tk-xy-sy', 'tk-xy-w', 'tk-xy-b',
    'tk-xy-latio', 'tk-xy-latia', 'tk-xy-p', 'tk-xy-su',
    'tk-sm-l', 'tk-sm-r',
  ],
  special: ['wp', 'jumbo', 'xya', 'exu', 'hgssp', 'rc', 'sve'],
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchTcgdexSet(setId: string): Promise<any | null> {
  try {
    const res = await fetch(`${TCGDEX_FR}/sets/${setId}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

async function fetchTcgdexCard(cardId: string): Promise<any | null> {
  try {
    const res = await fetch(`${TCGDEX_FR}/cards/${cardId}`, {
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch { return null }
}

// Détermine si un set est TCG Pocket
function isPocketSet(setId: string): boolean {
  return /^(A\d|B\d|P-A)/.test(setId)
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const category = searchParams.get('category') ?? 'pocket'
  const specificSet = searchParams.get('setId')
  const limit = parseInt(searchParams.get('limit') ?? '5')

  const startedAt = Date.now()
  const TIMEOUT_MS = 240_000

  // Déterminer les sets à traiter
  let setsToProcess: string[] = []
  if (specificSet) {
    setsToProcess = [specificSet]
  } else if (category === 'all') {
    setsToProcess = Object.values(SETS_BY_CATEGORY).flat()
  } else {
    setsToProcess = SETS_BY_CATEGORY[category] ?? []
  }

  // Filtrer ceux déjà en base
  const existingIds = new Set(
    (await prisma.pokemonSet.findMany({ select: { externalId: true } })).map((s) => s.externalId)
  )
  const missing = setsToProcess.filter((id) => !existingIds.has(id)).slice(0, limit)

  if (missing.length === 0) {
    return NextResponse.json({
      ok: true,
      message: 'Tous les sets de cette catégorie sont déjà en base',
      alreadyLoaded: setsToProcess.length,
    })
  }

  const stats = { setsAdded: 0, cardsAdded: 0, errors: 0 }

  for (const setId of missing) {
    if (Date.now() - startedAt > TIMEOUT_MS) break

    const setData = await fetchTcgdexSet(setId)
    if (!setData) { stats.errors++; continue }

    const isPocket = isPocketSet(setId)
    const cards: any[] = setData.cards ?? []

    try {
      // Upsert le set
      const dbSet = await prisma.pokemonSet.upsert({
        where: { externalId: setId },
        create: {
          externalId: setId,
          name: setData.name ?? setId,
          series: isPocket ? 'TCG Pocket' : setData.serie?.name ?? 'Other',
          releaseDate: setData.releaseDate ? new Date(setData.releaseDate) : new Date('2020-01-01'),
          totalCards: setData.cardCount?.official ?? setData.cardCount?.total ?? cards.length,
          printedTotal: setData.cardCount?.official ?? cards.length,
          symbolUrl: setData.symbol ?? null,
          logoUrl: setData.logo ?? null,
        },
        update: {
          name: setData.name ?? setId,
          symbolUrl: setData.symbol ?? null,
          logoUrl: setData.logo ?? null,
        },
      })

      // Traiter les cartes — pour les petits sets, fetch les détails complets
      const fetchFull = cards.length <= 60 || isPocket

      for (const cardStub of cards) {
        if (Date.now() - startedAt > TIMEOUT_MS) break
        try {
          let card = cardStub
          if (fetchFull) {
            const full = await fetchTcgdexCard(cardStub.id)
            if (full) card = full
            await sleep(80) // rate limit
          }

          const rarity = TCGDEX_RARITY[card.rarity ?? ''] ?? 'UNKNOWN'
          const imageBase = card.image ?? cardStub.image ?? null
          const imageSm = imageBase ? `${imageBase}/low.webp` : null
          const imageLg = imageBase ? `${imageBase}/high.webp` : null

          await prisma.card.upsert({
            where: { externalId: card.id ?? cardStub.id },
            create: {
              externalId: card.id ?? cardStub.id,
              setId: dbSet.id,
              name: card.name ?? cardStub.name ?? '',
              // Nom déjà en français — on le stocke aussi en localeName.fr
              localeName: { fr: card.name ?? cardStub.name ?? '' },
              number: card.localId ?? cardStub.localId ?? '',
              supertype: card.category === 'Énergie' ? 'Energy'
                : card.category === 'Dresseur' ? 'Trainer' : 'Pokémon',
              subtypes: card.stage ? [card.stage] : [],
              types: card.types ?? [],
              rarity: rarity as any,
              imageSmUrl: imageSm,
              imageLgUrl: imageLg,
              illustrator: card.illustrator ?? null,
              flavorText: card.description ?? null,
              hp: card.hp ?? null,
              evolvesFrom: card.evolveFrom ?? null,
              evolvesTo: [],
              attacks: card.attacks ?? [],
              abilities: card.abilities ?? [],
              weaknesses: card.weaknesses ?? [],
              resistances: card.resistances ?? [],
              retreatCost: [],
              nationalPokedexNumbers: card.dexId ?? [],
            },
            update: {
              localeName: { fr: card.name ?? cardStub.name ?? '' },
              imageSmUrl: imageSm,
              imageLgUrl: imageLg,
            },
          })
          stats.cardsAdded++
        } catch { stats.errors++ }
      }

      stats.setsAdded++
      console.log(`✅ ${setId} (${setData.name}): ${cards.length} cartes`)
      await sleep(300)
    } catch (err) {
      console.error(`❌ ${setId}:`, err)
      stats.errors++
    }
  }

  const remaining = setsToProcess.filter((id) => !existingIds.has(id)).length - stats.setsAdded

  return NextResponse.json({
    ok: true,
    duration: Math.round((Date.now() - startedAt) / 1000) + 's',
    category,
    ...stats,
    remaining,
    message: remaining > 0
      ? `${remaining} sets restants — relancer pour continuer`
      : `Catégorie "${category}" complète ✓`,
  })
}

export async function GET() {
  const existing = await prisma.pokemonSet.findMany({ select: { externalId: true } })
  const existingIds = new Set(existing.map((s) => s.externalId))

  const status: Record<string, any> = {}
  for (const [cat, ids] of Object.entries(SETS_BY_CATEGORY)) {
    const missing = ids.filter((id) => !existingIds.has(id))
    status[cat] = { total: ids.length, missing: missing.length, missingIds: missing }
  }

  return NextResponse.json(status)
}
