/**
 * POST /api/admin/sync-sets
 *
 * Découverte automatique et seed de TOUS les sets pokemontcg.io.
 * - Appelle /v2/sets pour lister tous les sets existants
 * - Skip ceux déjà en base
 * - Traite les manquants en ordre (plus récent en premier)
 * - S'arrête proprement avant le timeout Vercel (300s)
 * - Appelable plusieurs fois : chaque appel avance le chargement
 *
 * Query:
 *   ?limit=10    → nombre max de sets à traiter (défaut: 10)
 *   ?setId=sv1   → forcer un set spécifique
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  normalizeCardmarketPrices,
  buildRealisticHistory,
  computeInvestmentScore,
  RARITY_RANK,
} from '@/lib/pricing/normalize'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

const PTCG_BASE = 'https://api.pokemontcg.io/v2'

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
  'LEGEND': 'LEGEND', 'Rare BREAK': 'RARE_HOLO', 'Rare Prime': 'RARE_HOLO',
  'Rare ACE': 'RARE_SECRET', 'Classic Collection': 'RARE_HOLO',
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

/** Récupère tous les sets depuis pokemontcg.io */
async function fetchAllPtcgSets(): Promise<any[]> {
  const sets: any[] = []
  let page = 1
  while (true) {
    const res = await fetch(`${PTCG_BASE}/sets?pageSize=250&page=${page}&orderBy=-releaseDate`, {
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) break
    const data = await res.json()
    sets.push(...(data.data ?? []))
    if ((data.data ?? []).length < 250) break
    page++
  }
  return sets
}

/** Récupère toutes les cartes d'un set pokemontcg.io */
async function fetchSetCards(setId: string): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    const res = await fetch(
      `${PTCG_BASE}/cards?q=set.id:${setId}&pageSize=250&page=${page}` +
      `&select=id,name,number,rarity,supertype,subtypes,types,hp,evolvesFrom,` +
      `attacks,abilities,weaknesses,resistances,retreatCost,regulationMark,` +
      `nationalPokedexNumbers,illustrator,images,cardmarket,tcgplayer,flavorText`,
      { signal: AbortSignal.timeout(20000) }
    )
    if (!res.ok) break
    const data = await res.json()
    const cards: any[] = data.data ?? []
    all.push(...cards)
    if (cards.length < 250) break
    page++
    await sleep(400)
  }
  return all
}

/**
 * Devine le TCGdex ID depuis le pokemontcg.io set ID.
 * TCGdex utilise souvent le même ID ou ajoute un zéro (sv1 → sv01).
 */
function guessTcgdexId(ptcgId: string): string[] {
  const candidates: string[] = [ptcgId]
  // Ajouter zéro : sv1 → sv01, swsh1 → swsh01
  const m = ptcgId.match(/^([a-z]+)(\d+)(.*)$/)
  if (m) {
    const padded = `${m[1]}0${m[2]}${m[3]}`
    candidates.push(padded)
    // swsh12pt5 → swsh12.5
    if (ptcgId.includes('pt5')) {
      candidates.push(ptcgId.replace('pt5', '.5'))
      candidates.push(`${m[1]}0${m[2]}.5`)
    }
    if (ptcgId.includes('pt3')) {
      candidates.push(ptcgId.replace('pt3', '.3'))
    }
  }
  // rsv10pt5 → sv10.5w, zsv10pt5 → sv10.5b (cas spéciaux)
  if (ptcgId === 'rsv10pt5') candidates.push('sv10.5w')
  if (ptcgId === 'zsv10pt5') candidates.push('sv10.5b')
  return candidates
}

/** Tente de récupérer les noms FR depuis TCGdex */
async function fetchFrNames(ptcgId: string): Promise<Record<string, string>> {
  const candidates = guessTcgdexId(ptcgId)
  for (const id of candidates) {
    try {
      const res = await fetch(`https://api.tcgdex.net/v2/fr/sets/${id}`, {
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const map: Record<string, string> = {}
      for (const c of data?.cards ?? []) {
        if (c.localId && c.name) {
          map[String(c.localId)] = c.name
          map[String(parseInt(c.localId, 10))] = c.name
        }
      }
      if (Object.keys(map).length > 0) return map
    } catch { /* essayer prochain candidat */ }
  }
  return {}
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const limit = Math.min(20, parseInt(searchParams.get('limit') ?? '10'))
  const specificSet = searchParams.get('setId')

  const startedAt = Date.now()
  const TIMEOUT_MS = 240_000 // 4 minutes, marge de sécurité

  // 1. Récupérer tous les sets pokemontcg.io
  let allPtcgSets: any[]
  try {
    allPtcgSets = await fetchAllPtcgSets()
  } catch {
    return NextResponse.json({ error: 'Impossible de récupérer les sets pokemontcg.io' }, { status: 502 })
  }

  // 2. Récupérer les externalIds déjà en base
  const existingIds = new Set(
    (await prisma.pokemonSet.findMany({ select: { externalId: true } }))
      .map((s) => s.externalId)
  )

  // 3. Sélectionner les sets à traiter
  let toProcess = specificSet
    ? allPtcgSets.filter((s) => s.id === specificSet)
    : allPtcgSets.filter((s) => !existingIds.has(s.id))

  const remaining = toProcess.length
  toProcess = toProcess.slice(0, limit)

  const stats = { setsProcessed: 0, cardsAdded: 0, errors: 0, remaining: remaining - toProcess.length }

  // 4. Traiter chaque set
  for (const ptcgSet of toProcess) {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      stats.remaining += (toProcess.length - stats.setsProcessed)
      break
    }

    try {
      // Fetch cartes
      const cards = await fetchSetCards(ptcgSet.id)
      if (cards.length === 0) continue

      // Noms FR
      const frNames = await fetchFrNames(ptcgSet.id)

      // Upsert set
      const dbSet = await prisma.pokemonSet.upsert({
        where: { externalId: ptcgSet.id },
        create: {
          externalId: ptcgSet.id,
          name: ptcgSet.name,
          series: ptcgSet.series ?? 'Other',
          releaseDate: ptcgSet.releaseDate ? new Date(ptcgSet.releaseDate) : new Date('2000-01-01'),
          totalCards: ptcgSet.total ?? cards.length,
          printedTotal: ptcgSet.printedTotal ?? cards.length,
          symbolUrl: ptcgSet.images?.symbol ?? null,
          logoUrl: ptcgSet.images?.logo ?? null,
          ptcgoCode: ptcgSet.ptcgoCode ?? null,
        },
        update: {
          logoUrl: ptcgSet.images?.logo ?? null,
          symbolUrl: ptcgSet.images?.symbol ?? null,
          totalCards: ptcgSet.total ?? cards.length,
        },
      })

      // Upsert chaque carte
      for (const card of cards) {
        if (Date.now() - startedAt > TIMEOUT_MS) break
        try {
          const localId = card.number ?? ''
          const frName = frNames[localId] ?? frNames[String(parseInt(localId, 10))] ?? null
          const rarity = (RARITY_MAP[card.rarity ?? ''] ?? 'UNKNOWN') as any

          const dbCard = await prisma.card.upsert({
            where: { externalId: card.id },
            create: {
              externalId: card.id,
              setId: dbSet.id,
              name: card.name ?? '',
              localeName: frName ? { fr: frName } : {},
              number: card.number ?? '',
              supertype: card.supertype ?? 'Pokémon',
              subtypes: card.subtypes ?? [],
              types: card.types ?? [],
              rarity,
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
              imageSmUrl: card.images?.small ?? null,
              imageLgUrl: card.images?.large ?? null,
              localeName: frName ? { fr: frName } : undefined,
            },
          })

          // Prix Cardmarket
          const cm = card.cardmarket?.prices
          if (cm) {
            const norm = normalizeCardmarketPrices(cm)
            if (norm && norm.market > 0) {
              await prisma.cardPrice.upsert({
                where: { cardId_source_variant: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL' } },
                create: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', market: norm.market, mid: norm.mid, low: norm.low, high: norm.high },
                update: { market: norm.market, mid: norm.mid, low: norm.low, high: norm.high, fetchedAt: new Date() },
              })

              // Historique reconstruit (seulement si vide)
              const hasHistory = await prisma.priceHistory.count({ where: { cardId: dbCard.id } })
              if (hasHistory === 0) {
                const pts = buildRealisticHistory(norm.market, norm.avg1, norm.avg7, norm.avg30, 90)
                await prisma.priceHistory.createMany({
                  data: pts.map(({ daysAgo, price }) => ({
                    cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL',
                    currency: 'EUR', price, recordedAt: subDays(new Date(), daysAgo),
                  })),
                  skipDuplicates: true,
                })
              }

              // MarketData
              const rarityRank = RARITY_RANK[String(rarity)] ?? 2
              const investmentScore = computeInvestmentScore({
                change7d: norm.change7d, change30d: norm.change30d,
                volatility: norm.volatility, rarityRank, price: norm.market, rsi: 50,
              })
              const trend = norm.volatility > 0.25 ? 'VOLATILE' : norm.change7d > 0.05 ? 'BULLISH' : norm.change7d < -0.05 ? 'BEARISH' : 'STABLE'

              await prisma.cardMarketData.upsert({
                where: { cardId: dbCard.id },
                create: {
                  cardId: dbCard.id, marketCap: norm.market * 10000,
                  priceChange24h: norm.change24h, priceChange7d: norm.change7d, priceChange30d: norm.change30d,
                  volatility30d: norm.volatility, investmentScore, rarityScore: rarityRank * 10,
                  liquidityScore: norm.market > 50 ? 80 : norm.market > 10 ? 60 : 30,
                  trendDirection: trend as any, allTimeHigh: norm.high, allTimeLow: norm.low,
                },
                update: {
                  priceChange24h: norm.change24h, priceChange7d: norm.change7d, priceChange30d: norm.change30d,
                  volatility30d: norm.volatility, investmentScore, trendDirection: trend as any,
                },
              })
            }
          }

          // Prix TCGPlayer USD
          const tcp = card.tcgplayer?.prices
          const tcpMain = tcp?.holofoil ?? tcp?.normal
          if (tcpMain?.market) {
            await prisma.cardPrice.upsert({
              where: { cardId_source_variant: { cardId: dbCard.id, source: 'tcgplayer', variant: 'NORMAL' } },
              create: { cardId: dbCard.id, source: 'tcgplayer', variant: 'NORMAL', currency: 'USD', market: tcpMain.market, low: tcpMain.low ?? tcpMain.market * 0.8, mid: tcpMain.mid ?? tcpMain.market, high: tcpMain.high ?? tcpMain.market * 1.2 },
              update: { market: tcpMain.market, fetchedAt: new Date() },
            })
          }

          stats.cardsAdded++
        } catch { stats.errors++ }
      }

      stats.setsProcessed++
      console.log(`✅ ${ptcgSet.id} (${ptcgSet.name}): ${cards.length} cartes, ${Object.keys(frNames).length} noms FR`)
      await sleep(300)
    } catch (err) {
      console.error(`❌ ${ptcgSet.id}:`, err)
      stats.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    duration: Math.round((Date.now() - startedAt) / 1000) + 's',
    totalPtcgSets: allPtcgSets.length,
    alreadyInDb: existingIds.size,
    ...stats,
    message: stats.remaining > 0
      ? `${stats.remaining} sets restants — rappeler l'endpoint pour continuer`
      : 'Tous les sets sont synchronisés ✓',
  })
}

export async function GET() {
  const [ptcgRes, dbSets, dbCards] = await Promise.all([
    fetch(`${PTCG_BASE}/sets?pageSize=1`, { signal: AbortSignal.timeout(5000) })
      .then((r) => r.json()).then((d) => d.totalCount ?? '?').catch(() => '?'),
    prisma.pokemonSet.count(),
    prisma.card.count(),
  ])
  return NextResponse.json({
    ptcgTotalSets: ptcgRes,
    dbSets,
    dbCards,
    missing: typeof ptcgRes === 'number' ? ptcgRes - dbSets : '?',
  })
}
