/**
 * POST /api/admin/sync-sets
 * Ajoute de nouveaux sets et leurs cartes depuis pokemontcg.io + noms FR depuis TCGdex.
 * Idempotent — ignore les cartes déjà en base (upsert).
 *
 * Query params:
 *   ?era=swsh          → sword & shield uniquement
 *   ?era=sm            → sun & moon uniquement
 *   ?era=xy            → XY uniquement
 *   ?era=bw            → black & white uniquement
 *   ?era=vintage       → base set, neo, ex, dp, pl, hgss
 *   ?era=all           → tout (très long, ~30-60 min)
 *   ?setId=swsh1       → un seul set spécifique
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  normalizeCardmarketPrices,
  buildRealisticHistory,
  computeRSI,
  computeInvestmentScore,
  RARITY_RANK,
} from '@/lib/pricing/normalize'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

// ─── Catalogue complet des sets ──────────────────────────────────────────────
const ALL_SETS: Array<{ ptcgId: string; tcgdexId: string; frName: string; series: string }> = [
  // Scarlet & Violet (déjà seedés, inclus pour upsert)
  { ptcgId: 'sv1',      tcgdexId: 'sv01',     frName: 'Écarlate et Violet',          series: 'Scarlet & Violet' },
  { ptcgId: 'sv2',      tcgdexId: 'sv02',     frName: 'Évolution à Paldea',           series: 'Scarlet & Violet' },
  { ptcgId: 'sv3',      tcgdexId: 'sv03',     frName: 'Flammes Obsidiennes',          series: 'Scarlet & Violet' },
  { ptcgId: 'sv3pt5',   tcgdexId: 'sv03.5',   frName: '151',                          series: 'Scarlet & Violet' },
  { ptcgId: 'sv4',      tcgdexId: 'sv04',     frName: 'Failles Paradoxes',            series: 'Scarlet & Violet' },
  { ptcgId: 'sv4pt5',   tcgdexId: 'sv04.5',   frName: 'Destinées de Paldea',          series: 'Scarlet & Violet' },
  { ptcgId: 'sv5',      tcgdexId: 'sv05',     frName: 'Forces Temporelles',           series: 'Scarlet & Violet' },
  { ptcgId: 'sv6',      tcgdexId: 'sv06',     frName: 'Mascarade Crépusculaire',      series: 'Scarlet & Violet' },
  { ptcgId: 'sv6pt5',   tcgdexId: 'sv06.5',   frName: 'Fable Nébuleuse',              series: 'Scarlet & Violet' },
  { ptcgId: 'sv7',      tcgdexId: 'sv07',     frName: 'Couronne Stellaire',           series: 'Scarlet & Violet' },
  { ptcgId: 'sv8',      tcgdexId: 'sv08',     frName: 'Étincelles Déferlantes',       series: 'Scarlet & Violet' },
  { ptcgId: 'sv8pt5',   tcgdexId: 'sv08.5',   frName: 'Évolutions Prismatiques',      series: 'Scarlet & Violet' },
  { ptcgId: 'sv9',      tcgdexId: 'sv09',     frName: 'Voyage Ensemble',              series: 'Scarlet & Violet' },
  { ptcgId: 'sv10',     tcgdexId: 'sv10',     frName: 'Destins Rivaux',               series: 'Scarlet & Violet' },
  { ptcgId: 'rsv10pt5', tcgdexId: 'sv10.5w',  frName: 'Flamme Blanche',               series: 'Scarlet & Violet' },
  { ptcgId: 'zsv10pt5', tcgdexId: 'sv10.5b',  frName: 'Flamme Noire',                 series: 'Scarlet & Violet' },
  { ptcgId: 'svp',      tcgdexId: 'svp',      frName: 'Promos SV',                    series: 'Scarlet & Violet' },

  // Sword & Shield
  { ptcgId: 'swsh1',    tcgdexId: 'swsh01',   frName: 'Épée et Bouclier',             series: 'Sword & Shield' },
  { ptcgId: 'swsh2',    tcgdexId: 'swsh02',   frName: 'Clash des Rebelles',           series: 'Sword & Shield' },
  { ptcgId: 'swsh3',    tcgdexId: 'swsh03',   frName: 'Ténèbres Embrasées',           series: 'Sword & Shield' },
  { ptcgId: 'swsh35',   tcgdexId: 'swsh03.5', frName: "La Voie du Maître",            series: 'Sword & Shield' },
  { ptcgId: 'swsh4',    tcgdexId: 'swsh04',   frName: 'Voltage Éclatant',             series: 'Sword & Shield' },
  { ptcgId: 'swsh45',   tcgdexId: 'swsh04.5', frName: 'Destinées Radieuses',          series: 'Sword & Shield' },
  { ptcgId: 'swsh5',    tcgdexId: 'swsh05',   frName: 'Styles de Combat',             series: 'Sword & Shield' },
  { ptcgId: 'swsh6',    tcgdexId: 'swsh06',   frName: 'Règne de Glace',               series: 'Sword & Shield' },
  { ptcgId: 'swsh7',    tcgdexId: 'swsh07',   frName: 'Cieux Évolutifs',              series: 'Sword & Shield' },
  { ptcgId: 'swsh8',    tcgdexId: 'swsh08',   frName: 'Poing de Fusion',              series: 'Sword & Shield' },
  { ptcgId: 'swsh9',    tcgdexId: 'swsh09',   frName: 'Stars Brillantes',             series: 'Sword & Shield' },
  { ptcgId: 'swsh10',   tcgdexId: 'swsh10',   frName: 'Astres Radieux',               series: 'Sword & Shield' },
  { ptcgId: 'swsh11',   tcgdexId: 'swsh11',   frName: 'Origine Perdue',               series: 'Sword & Shield' },
  { ptcgId: 'swsh12',   tcgdexId: 'swsh12',   frName: 'Tempête Argentée',             series: 'Sword & Shield' },
  { ptcgId: 'swsh12pt5',tcgdexId: 'swsh12.5', frName: 'Zénith Suprême',              series: 'Sword & Shield' },

  // Sun & Moon
  { ptcgId: 'sm1',      tcgdexId: 'sm01',     frName: 'Soleil et Lune',               series: 'Sun & Moon' },
  { ptcgId: 'sm2',      tcgdexId: 'sm02',     frName: 'Gardiens Ascendants',          series: 'Sun & Moon' },
  { ptcgId: 'sm3',      tcgdexId: 'sm03',     frName: 'Ombres Ardentes',              series: 'Sun & Moon' },
  { ptcgId: 'sm35',     tcgdexId: 'sm03.5',   frName: 'Légendes Brillantes',          series: 'Sun & Moon' },
  { ptcgId: 'sm4',      tcgdexId: 'sm04',     frName: 'Invasion Carmin',              series: 'Sun & Moon' },
  { ptcgId: 'sm5',      tcgdexId: 'sm05',     frName: 'Ultra-Prisme',                 series: 'Sun & Moon' },
  { ptcgId: 'sm6',      tcgdexId: 'sm06',     frName: 'Lumière Interdite',            series: 'Sun & Moon' },
  { ptcgId: 'sm7',      tcgdexId: 'sm07',     frName: 'Tempête Céleste',              series: 'Sun & Moon' },
  { ptcgId: 'sm8',      tcgdexId: 'sm08',     frName: 'Tonnerre Perdu',               series: 'Sun & Moon' },
  { ptcgId: 'sm9',      tcgdexId: 'sm09',     frName: 'Alliance Infaillible',         series: 'Sun & Moon' },
  { ptcgId: 'sm10',     tcgdexId: 'sm10',     frName: 'Liens Indéfectibles',          series: 'Sun & Moon' },
  { ptcgId: 'sm11',     tcgdexId: 'sm11',     frName: 'Harmonie des Esprits',         series: 'Sun & Moon' },
  { ptcgId: 'sm115',    tcgdexId: 'sm11.5',   frName: 'Destins Cachés',               series: 'Sun & Moon' },
  { ptcgId: 'sm12',     tcgdexId: 'sm12',     frName: 'Eclipse Cosmique',             series: 'Sun & Moon' },

  // XY
  { ptcgId: 'xy1',      tcgdexId: 'xy01',     frName: 'XY',                           series: 'XY' },
  { ptcgId: 'xy2',      tcgdexId: 'xy02',     frName: 'Étincelles',                   series: 'XY' },
  { ptcgId: 'xy3',      tcgdexId: 'xy03',     frName: 'Poings Furieux',               series: 'XY' },
  { ptcgId: 'xy4',      tcgdexId: 'xy04',     frName: 'Forces Fantômes',              series: 'XY' },
  { ptcgId: 'xy5',      tcgdexId: 'xy05',     frName: 'Primo-Choc',                   series: 'XY' },
  { ptcgId: 'xy6',      tcgdexId: 'xy06',     frName: 'Ciel Rugissant',               series: 'XY' },
  { ptcgId: 'xy7',      tcgdexId: 'xy07',     frName: 'Origines Antiques',            series: 'XY' },
  { ptcgId: 'xy8',      tcgdexId: 'xy08',     frName: 'BREAKthrough',                 series: 'XY' },
  { ptcgId: 'xy9',      tcgdexId: 'xy09',     frName: 'BREAKpoint',                   series: 'XY' },
  { ptcgId: 'xy10',     tcgdexId: 'xy10',     frName: 'Destin de Collusion',          series: 'XY' },
  { ptcgId: 'xy11',     tcgdexId: 'xy11',     frName: 'Vapeur Assiégée',              series: 'XY' },
  { ptcgId: 'xy12',     tcgdexId: 'xy12',     frName: 'Évolutions',                   series: 'XY' },

  // Black & White
  { ptcgId: 'bw1',      tcgdexId: 'bw01',     frName: 'Noir et Blanc',                series: 'Black & White' },
  { ptcgId: 'bw2',      tcgdexId: 'bw02',     frName: 'Pouvoirs Émergents',           series: 'Black & White' },
  { ptcgId: 'bw3',      tcgdexId: 'bw03',     frName: 'Nobles Victoires',             series: 'Black & White' },
  { ptcgId: 'bw4',      tcgdexId: 'bw04',     frName: 'Prochaines Destinées',         series: 'Black & White' },
  { ptcgId: 'bw5',      tcgdexId: 'bw05',     frName: 'Explorateurs Obscurs',         series: 'Black & White' },
  { ptcgId: 'bw6',      tcgdexId: 'bw06',     frName: 'Dragons Exaltés',              series: 'Black & White' },
  { ptcgId: 'bw7',      tcgdexId: 'bw07',     frName: 'Frontières Franchies',         series: 'Black & White' },
  { ptcgId: 'bw8',      tcgdexId: 'bw08',     frName: 'Tempête Plasma',               series: 'Black & White' },
  { ptcgId: 'bw9',      tcgdexId: 'bw09',     frName: 'Glaciation Plasma',            series: 'Black & White' },
  { ptcgId: 'bw10',     tcgdexId: 'bw10',     frName: 'Explosion Plasma',             series: 'Black & White' },
  { ptcgId: 'bw11',     tcgdexId: 'bw11',     frName: 'Trésors Légendaires',          series: 'Black & White' },

  // HeartGold SoulSilver
  { ptcgId: 'hgss1',    tcgdexId: 'hgss01',   frName: 'HeartGold SoulSilver',         series: 'HeartGold & SoulSilver' },
  { ptcgId: 'hgss2',    tcgdexId: 'hgss02',   frName: 'Déchainement',                 series: 'HeartGold & SoulSilver' },
  { ptcgId: 'hgss3',    tcgdexId: 'hgss03',   frName: 'Triomphe',                     series: 'HeartGold & SoulSilver' },
  { ptcgId: 'hgss4',    tcgdexId: 'hgss04',   frName: 'Appel des Légendes',           series: 'HeartGold & SoulSilver' },

  // Platinum
  { ptcgId: 'pl1',      tcgdexId: 'pl01',     frName: 'Platine',                      series: 'Platinum' },
  { ptcgId: 'pl2',      tcgdexId: 'pl02',     frName: 'Rivaux Émergeants',            series: 'Platinum' },
  { ptcgId: 'pl3',      tcgdexId: 'pl03',     frName: 'Vainqueurs Suprêmes',          series: 'Platinum' },
  { ptcgId: 'pl4',      tcgdexId: 'pl04',     frName: 'Arceus',                       series: 'Platinum' },

  // Diamond & Pearl
  { ptcgId: 'dp1',      tcgdexId: 'dp01',     frName: 'Diamant et Perle',             series: 'Diamond & Pearl' },
  { ptcgId: 'dp2',      tcgdexId: 'dp02',     frName: 'Trésors Mystérieux',           series: 'Diamond & Pearl' },
  { ptcgId: 'dp3',      tcgdexId: 'dp03',     frName: 'Secrètes Merveilles',          series: 'Diamond & Pearl' },
  { ptcgId: 'dp4',      tcgdexId: 'dp04',     frName: 'Grands Combats',               series: 'Diamond & Pearl' },
  { ptcgId: 'dp5',      tcgdexId: 'dp05',     frName: 'Aube Majestueuse',             series: 'Diamond & Pearl' },
  { ptcgId: 'dp6',      tcgdexId: 'dp06',     frName: 'Éveil des Légendes',           series: 'Diamond & Pearl' },

  // EX Series (vintage modern)
  { ptcgId: 'ex1',      tcgdexId: 'ex01',     frName: 'EX Rubis et Saphir',           series: 'EX' },
  { ptcgId: 'ex2',      tcgdexId: 'ex02',     frName: 'EX Tempête de Sable',         series: 'EX' },
  { ptcgId: 'ex3',      tcgdexId: 'ex03',     frName: 'EX Dragon',                    series: 'EX' },
  { ptcgId: 'ex4',      tcgdexId: 'ex04',     frName: 'EX Rouge Feu Vert Feuille',   series: 'EX' },
  { ptcgId: 'ex5',      tcgdexId: 'ex05',     frName: 'EX Team Magma/Aqua',          series: 'EX' },
  { ptcgId: 'ex6',      tcgdexId: 'ex06',     frName: 'EX Créateurs de Légendes',    series: 'EX' },
  { ptcgId: 'ex7',      tcgdexId: 'ex07',     frName: 'EX Deoxys',                    series: 'EX' },
  { ptcgId: 'ex8',      tcgdexId: 'ex08',     frName: 'EX Émeraude',                  series: 'EX' },
  { ptcgId: 'ex9',      tcgdexId: 'ex09',     frName: 'EX Espèces Delta',             series: 'EX' },
  { ptcgId: 'ex10',     tcgdexId: 'ex10',     frName: 'EX Légendes Oubliées',        series: 'EX' },
  { ptcgId: 'ex11',     tcgdexId: 'ex11',     frName: 'EX Gardiens de Cristal',      series: 'EX' },
  { ptcgId: 'ex12',     tcgdexId: 'ex12',     frName: 'EX Horizon Dragon',            series: 'EX' },
  { ptcgId: 'ex13',     tcgdexId: 'ex13',     frName: 'EX Gardiens du Pouvoir',      series: 'EX' },
  { ptcgId: 'ex14',     tcgdexId: 'ex14',     frName: 'EX Île des Dragons',           series: 'EX' },
  { ptcgId: 'ex15',     tcgdexId: 'ex15',     frName: 'EX Destin Obscur',             series: 'EX' },
  { ptcgId: 'ex16',     tcgdexId: 'ex16',     frName: 'EX Fantômes Holon',            series: 'EX' },

  // Neo (vintage)
  { ptcgId: 'neo1',     tcgdexId: 'neo01',    frName: 'Neo Genèse',                   series: 'Neo' },
  { ptcgId: 'neo2',     tcgdexId: 'neo02',    frName: 'Neo Découverte',               series: 'Neo' },
  { ptcgId: 'neo3',     tcgdexId: 'neo03',    frName: 'Neo Révélation',               series: 'Neo' },
  { ptcgId: 'neo4',     tcgdexId: 'neo04',    frName: 'Neo Destinée',                 series: 'Neo' },

  // Base Set (vintage)
  { ptcgId: 'base1',    tcgdexId: 'base01',   frName: 'Édition de Base',              series: 'Base' },
  { ptcgId: 'base2',    tcgdexId: 'base02',   frName: 'Jungle',                       series: 'Base' },
  { ptcgId: 'base3',    tcgdexId: 'base03',   frName: 'Fossile',                      series: 'Base' },
  { ptcgId: 'base4',    tcgdexId: 'base04',   frName: 'Team Rocket',                  series: 'Base' },
  { ptcgId: 'base5',    tcgdexId: 'base05',   frName: 'Gym - Les Challengers',        series: 'Base' },
  { ptcgId: 'base6',    tcgdexId: 'base06',   frName: 'Gym - Les Champions',          series: 'Base' },
]

const ERA_FILTER: Record<string, string[]> = {
  sv: ['Scarlet & Violet'],
  swsh: ['Sword & Shield'],
  sm: ['Sun & Moon'],
  xy: ['XY'],
  bw: ['Black & White'],
  hgss: ['HeartGold & SoulSilver'],
  vintage: ['Platinum', 'Diamond & Pearl', 'EX', 'Neo', 'Base'],
  modern: ['Sword & Shield', 'Sun & Moon', 'XY', 'Black & White'],
  all: [], // vide = tous
}

const RARITY_MAP: Record<string, string> = {
  'Common': 'COMMON', 'Uncommon': 'UNCOMMON', 'Rare': 'RARE',
  'Rare Holo': 'RARE_HOLO', 'Rare Holo EX': 'RARE_HOLO_EX',
  'Rare Holo GX': 'RARE_HOLO_GX', 'Rare Holo V': 'RARE_HOLO_V',
  'Rare Holo VMAX': 'RARE_HOLO_VMAX', 'Rare Holo VSTAR': 'RARE_HOLO_VSTAR',
  'Double Rare': 'RARE_ULTRA', 'Rare Ultra': 'RARE_ULTRA', 'Ultra Rare': 'RARE_ULTRA',
  'Rare Rainbow': 'RARE_RAINBOW', 'Rare Secret': 'RARE_SECRET',
  'ACE SPEC Rare': 'RARE_SECRET', 'Illustration Rare': 'ILLUSTRATION_RARE',
  'Special Illustration Rare': 'SPECIAL_ILLUSTRATION_RARE',
  'Hyper Rare': 'HYPER_RARE', 'Trainer Gallery Rare Holo': 'TRAINER_GALLERY_HOLO',
  'Shiny Rare': 'RARE_SHINY', 'Shiny Ultra Rare': 'RARE_SHINY_GX',
  'Amazing Rare': 'AMAZING_RARE', 'Crown Rare': 'CROWN_RARE',
  'PROMO': 'PROMO', 'Promo': 'PROMO', 'Radiant Rare': 'RARE_SHINY',
  'Rare Shiny': 'RARE_SHINY', 'Rare Shiny GX': 'RARE_SHINY_GX',
  'LEGEND': 'LEGEND', 'Rare BREAK': 'RARE_HOLO',
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function fetchPtcgCards(setId: string): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&pageSize=250&page=${page}&select=id,name,number,rarity,supertype,subtypes,types,hp,evolvesFrom,attacks,abilities,weaknesses,resistances,retreatCost,regulationMark,nationalPokedexNumbers,illustrator,images,cardmarket,tcgplayer,set`,
      { signal: AbortSignal.timeout(20000) }
    )
    if (!res.ok) break
    const data = await res.json()
    const cards: any[] = data?.data ?? []
    all.push(...cards)
    if (cards.length < 250) break
    page++
    await sleep(500)
  }
  return all
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
  } catch { return {} }
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const era = searchParams.get('era') ?? 'swsh'
  const specificSetId = searchParams.get('setId')

  // Sélectionner les sets à traiter
  let setsToProcess = ALL_SETS
  if (specificSetId) {
    setsToProcess = ALL_SETS.filter((s) => s.ptcgId === specificSetId)
  } else if (era !== 'all') {
    const allowedSeries = ERA_FILTER[era] ?? []
    if (allowedSeries.length > 0) {
      setsToProcess = ALL_SETS.filter((s) => allowedSeries.includes(s.series))
    }
  }

  if (setsToProcess.length === 0) {
    return NextResponse.json({ error: 'Aucun set correspondant' }, { status: 400 })
  }

  const startedAt = Date.now()
  const stats = { sets: 0, cardsAdded: 0, cardsUpdated: 0, errors: 0 }

  for (const setDef of setsToProcess) {
    if (Date.now() - startedAt > 250_000) break // timeout safety

    try {
      // Vérifier si le set existe déjà
      const existingSet = await prisma.pokemonSet.findFirst({
        where: { OR: [{ externalId: setDef.ptcgId }, { externalId: setDef.tcgdexId }] },
      })

      // Récupérer les cartes pokemontcg.io
      const ptcgCards = await fetchPtcgCards(setDef.ptcgId)
      if (ptcgCards.length === 0) {
        console.log(`⚠ Aucune carte pour ${setDef.ptcgId}`)
        continue
      }

      const ptcgSetMeta = ptcgCards[0]?.set
      const frNames = await fetchFrNames(setDef.tcgdexId)

      // Upsert le set
      const dbSet = await prisma.pokemonSet.upsert({
        where: { externalId: setDef.ptcgId },
        create: {
          externalId: setDef.ptcgId,
          name: ptcgSetMeta?.name ?? setDef.frName,
          series: setDef.series,
          releaseDate: ptcgSetMeta?.releaseDate ? new Date(ptcgSetMeta.releaseDate) : new Date('2000-01-01'),
          totalCards: ptcgSetMeta?.total ?? ptcgCards.length,
          printedTotal: ptcgSetMeta?.printedTotal ?? ptcgCards.length,
          symbolUrl: ptcgSetMeta?.images?.symbol ?? null,
          logoUrl: ptcgSetMeta?.images?.logo ?? null,
          ptcgoCode: ptcgSetMeta?.ptcgoCode ?? null,
        },
        update: {
          totalCards: ptcgSetMeta?.total ?? ptcgCards.length,
          logoUrl: ptcgSetMeta?.images?.logo ?? null,
          symbolUrl: ptcgSetMeta?.images?.symbol ?? null,
        },
      })

      stats.sets++
      let setAdded = 0

      // Upsert chaque carte
      for (const card of ptcgCards) {
        try {
          const localId = card.number ?? card.id.split('-').pop()
          const frName = frNames[localId] ?? frNames[String(parseInt(localId, 10))]
          const rarity = RARITY_MAP[card.rarity] ?? 'UNKNOWN'

          const dbCard = await prisma.card.upsert({
            where: { externalId: card.id },
            create: {
              externalId: card.id,
              setId: dbSet.id,
              name: card.name,
              localeName: frName ? { fr: frName } : {},
              number: card.number ?? '',
              supertype: card.supertype ?? 'Pokémon',
              subtypes: card.subtypes ?? [],
              types: card.types ?? [],
              rarity: rarity as any,
              imageSmUrl: card.images?.small ?? null,
              imageLgUrl: card.images?.large ?? null,
              illustrator: card.illustrator ?? null,
              flavorText: card.flavorText ?? null,
              hp: card.hp ? parseInt(card.hp) : null,
              evolvesFrom: card.evolvesFrom ?? null,
              evolvesTo: card.evolvesTo ?? [],
              attacks: card.attacks ?? [],
              abilities: card.abilities ?? [],
              weaknesses: card.weaknesses ?? [],
              resistances: card.resistances ?? [],
              retreatCost: card.retreatCost ?? [],
              regulationMark: card.regulationMark ?? null,
              nationalPokedexNumbers: card.nationalPokedexNumbers ?? [],
            },
            update: {
              localeName: frName ? { fr: frName } : undefined,
              imageSmUrl: card.images?.small ?? null,
              imageLgUrl: card.images?.large ?? null,
            },
          })

          // Upsert les prix
          const cm = card.cardmarket?.prices
          if (cm) {
            const norm = normalizeCardmarketPrices(cm)
            if (norm && norm.market > 0) {
              await prisma.cardPrice.upsert({
                where: { cardId_source_variant: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL' } },
                create: {
                  cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
                  market: norm.market, mid: norm.mid, low: norm.low, high: norm.high,
                },
                update: { market: norm.market, mid: norm.mid, low: norm.low, high: norm.high, fetchedAt: new Date() },
              })

              // Historique reconstruit depuis avg1/avg7/avg30 réels
              const historyPoints = buildRealisticHistory(norm.market, norm.avg1, norm.avg7, norm.avg30, 90)
              // N'insérer que si l'historique est vide
              const existingHistory = await prisma.priceHistory.count({ where: { cardId: dbCard.id } })
              if (existingHistory === 0) {
                await prisma.priceHistory.createMany({
                  data: historyPoints.map(({ daysAgo, price }) => ({
                    cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
                    price, recordedAt: subDays(new Date(), daysAgo),
                  })),
                  skipDuplicates: true,
                })
              }

              // CardMarketData
              const rarityRank = RARITY_RANK[rarity] ?? 2
              const investmentScore = computeInvestmentScore({
                change7d: norm.change7d, change30d: norm.change30d,
                volatility: norm.volatility, rarityRank, price: norm.market, rsi: 50,
              })
              const trendDirection = norm.volatility > 0.25 ? 'VOLATILE' :
                norm.change7d > 0.05 ? 'BULLISH' : norm.change7d < -0.05 ? 'BEARISH' : 'STABLE'

              await prisma.cardMarketData.upsert({
                where: { cardId: dbCard.id },
                create: {
                  cardId: dbCard.id, marketCap: norm.market * 10000,
                  priceChange24h: norm.change24h, priceChange7d: norm.change7d, priceChange30d: norm.change30d,
                  volatility30d: norm.volatility, investmentScore, rarityScore: rarityRank * 10,
                  liquidityScore: norm.market > 50 ? 80 : norm.market > 10 ? 60 : 30,
                  trendDirection: trendDirection as any, allTimeHigh: norm.high, allTimeLow: norm.low,
                },
                update: {
                  priceChange24h: norm.change24h, priceChange7d: norm.change7d, priceChange30d: norm.change30d,
                  volatility30d: norm.volatility, investmentScore, trendDirection: trendDirection as any,
                },
              })
            }
          }

          setAdded++
          stats.cardsAdded++
        } catch { stats.errors++ }
      }

      console.log(`✅ ${setDef.ptcgId} (${setDef.frName}): ${setAdded} cartes`)
      await sleep(600)
    } catch (err) {
      console.error(`❌ Erreur set ${setDef.ptcgId}:`, err)
      stats.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    duration: Math.round((Date.now() - startedAt) / 1000),
    ...stats,
  })
}

export async function GET() {
  const total = await prisma.card.count()
  const sets = await prisma.pokemonSet.count()
  const bySeries = await prisma.pokemonSet.groupBy({
    by: ['series'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  })
  return NextResponse.json({ totalCards: total, totalSets: sets, bySeries })
}
