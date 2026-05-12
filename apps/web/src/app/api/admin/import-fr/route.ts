/**
 * POST /api/admin/import-fr
 * Importe TOUTES les extensions françaises depuis TCGdex FR.
 *
 * - Source cartes : https://api.tcgdex.net/v2/fr (noms français officiels)
 * - Source prix   : https://api.pokemontcg.io/v2 (Cardmarket, quand l'ID set correspond)
 * - Resumable : chaque appel traite ?batchSize=N sets manquants (défaut 4)
 * - Appelable en boucle jusqu'à "remaining: 0"
 *
 * Query params :
 *   ?batchSize=4    → sets par appel (max 8)
 *   ?setId=sv1      → forcer un set précis
 *   ?skipPrices=true → ne pas fetcher les prix pokemontcg.io
 *   ?dryRun=true    → affiche les manquants sans importer
 *
 * GET → état actuel (sets manquants, progression)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import {
  normalizeCardmarketPrices,
  computeInvestmentScore,
  RARITY_RANK,
  buildRealisticHistory,
} from '@/lib/pricing/normalize'
import { subDays } from 'date-fns'

export const runtime = 'nodejs'
export const maxDuration = 300

const TCGDEX  = 'https://api.tcgdex.net/v2/fr'
const PTCG    = 'https://api.pokemontcg.io/v2'
const TIMEOUT = 250_000

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

/* ── Rareté TCGdex → enum Prisma ────────────────────────────── */
const RARITY_MAP: Record<string, string> = {
  // Labels français TCGdex (cartes physiques)
  'Commune':                         'COMMON',
  'Peu commune':                     'UNCOMMON',
  'Rare':                            'RARE',
  'Rare Holo':                       'RARE_HOLO',
  'Rare Holo EX':                    'RARE_HOLO_EX',
  'Rare Holo GX':                    'RARE_HOLO_GX',
  'Rare Holo V':                     'RARE_HOLO_V',
  'Rare Holo VMAX':                  'RARE_HOLO_VMAX',
  'Rare Holo VSTAR':                 'RARE_HOLO_VSTAR',
  'Ultra-Rare':                      'RARE_ULTRA',
  'Ultra Rare':                      'RARE_ULTRA',
  'Rare Ultra':                      'RARE_ULTRA',
  'Deux fois Rare':                  'RARE_ULTRA',
  'Double Rare':                     'RARE_ULTRA',
  'Rare Arc-en-ciel':                'RARE_RAINBOW',
  'Rare Secrète':                    'RARE_SECRET',
  'Secret Rare':                     'RARE_SECRET',
  'Rare Brillante':                  'RARE_SHINY',
  'Rare Brillante GX':               'RARE_SHINY_GX',
  'Rare Étonnante':                  'AMAZING_RARE',
  'Amazing Rare':                    'AMAZING_RARE',
  'Rare d\'Illustration':            'ILLUSTRATION_RARE',
  'Illustration Rare':               'ILLUSTRATION_RARE',
  'Rare d\'Illustration Spéciale':   'SPECIAL_ILLUSTRATION_RARE',
  'Special Illustration Rare':       'SPECIAL_ILLUSTRATION_RARE',
  'Rare Hyper':                      'HYPER_RARE',
  'Hyper Rare':                      'HYPER_RARE',
  'Rare Couronne':                   'CROWN_RARE',
  'Crown Rare':                      'CROWN_RARE',
  'Légende':                         'LEGEND',
  'LEGEND':                          'LEGEND',
  'Promo':                           'PROMO',
  'PROMO':                           'PROMO',
  // TCG Pocket
  'Un Diamant':                      'COMMON',
  'Deux Diamants':                   'UNCOMMON',
  'Trois Diamants':                  'RARE',
  'Quatre Diamants':                 'RARE_ULTRA',
  'Un Étoile':                       'ILLUSTRATION_RARE',
  'Deux Étoiles':                    'SPECIAL_ILLUSTRATION_RARE',
  'Trois Étoiles':                   'HYPER_RARE',
  'Couronne':                        'CROWN_RARE',
  // Anglais (fallback)
  'Common':                          'COMMON',
  'Uncommon':                        'UNCOMMON',
}

/* ── TCGdex API ─────────────────────────────────────────────── */
async function tcgdexSets(): Promise<any[]> {
  try {
    const r = await fetch(`${TCGDEX}/sets`, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) return []
    return await r.json()
  } catch { return [] }
}

async function tcgdexSet(id: string): Promise<any | null> {
  try {
    const r = await fetch(`${TCGDEX}/sets/${id}`, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

async function tcgdexCard(id: string): Promise<any | null> {
  try {
    const r = await fetch(`${TCGDEX}/cards/${id}`, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) return null
    return await r.json()
  } catch { return null }
}

/* ── Pokemontcg.io API (prix Cardmarket) ────────────────────── */
async function ptcgSetCards(setId: string): Promise<Map<string, any>> {
  const map = new Map<string, any>()
  try {
    let page = 1
    while (true) {
      const r = await fetch(
        `${PTCG}/cards?q=set.id:${setId}&pageSize=250&page=${page}` +
        `&select=id,number,cardmarket`,
        { signal: AbortSignal.timeout(20000) }
      )
      if (!r.ok) break
      const d = await r.json()
      for (const c of d.data ?? []) {
        // Indexer par numéro de carte (ex: "001" ou "1")
        const num = String(c.number ?? '').replace(/^0+(?=[0-9])/, '')
        map.set(num, c)
        map.set(String(c.number ?? ''), c)
      }
      if ((d.data ?? []).length < 250) break
      page++
    }
  } catch { /* prix non disponibles */ }
  return map
}

/* ── Upsert prix d'une carte ────────────────────────────────── */
async function upsertCardPrice(cardId: string, rarity: string, cm: any) {
  const norm = normalizeCardmarketPrices(cm)
  if (!norm || norm.market <= 0) return

  const today = new Date(); today.setHours(0, 0, 0, 0)

  await prisma.cardPrice.upsert({
    where: { cardId_source_variant: { cardId, source: 'cardmarket', variant: 'NORMAL' } },
    create: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', market: norm.market, mid: norm.mid, low: norm.low, high: norm.high },
    update: { market: norm.market, mid: norm.mid, low: norm.low, high: norm.high, fetchedAt: new Date() },
  })

  // Historique aujourd'hui
  const existingToday = await prisma.priceHistory.findFirst({
    where: { cardId, source: 'cardmarket', recordedAt: { gte: today } },
  })
  if (!existingToday) {
    await prisma.priceHistory.create({
      data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: norm.market, recordedAt: today },
    })
  }

  // avg7 / avg30 comme points historiques
  if (norm.avg7 > 0 && Math.abs(norm.avg7 - norm.market) > 0.01) {
    const d7 = subDays(today, 7)
    const ex7 = await prisma.priceHistory.findFirst({ where: { cardId, source: 'cardmarket', recordedAt: { gte: d7, lt: subDays(today, 6) } } })
    if (!ex7) await prisma.priceHistory.create({ data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: norm.avg7, recordedAt: d7 } })
  }
  if (norm.avg30 > 0 && Math.abs(norm.avg30 - norm.avg7) > 0.01) {
    const d30 = subDays(today, 30)
    const ex30 = await prisma.priceHistory.findFirst({ where: { cardId, source: 'cardmarket', recordedAt: { gte: d30, lt: subDays(today, 29) } } })
    if (!ex30) await prisma.priceHistory.create({ data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: norm.avg30, recordedAt: d30 } })
  }

  // CardMarketData
  const rarityRank = RARITY_RANK[rarity] ?? 2
  const score = computeInvestmentScore({ change7d: norm.change7d, change30d: norm.change30d, volatility: norm.volatility, rarityRank, price: norm.market, rsi: 50 })
  const trend = norm.volatility > 0.25 ? 'VOLATILE' : norm.change7d > 0.05 ? 'BULLISH' : norm.change7d < -0.05 ? 'BEARISH' : 'STABLE'
  const copiesMap: Record<string, number> = { CROWN_RARE: 800, HYPER_RARE: 1200, SPECIAL_ILLUSTRATION_RARE: 1500, ILLUSTRATION_RARE: 3000, RARE_SECRET: 2000, RARE_ULTRA: 4000, RARE_HOLO: 15000, RARE: 25000, UNCOMMON: 80000, COMMON: 200000 }
  const marketCap = norm.market * (copiesMap[rarity] ?? 10000)

  await prisma.cardMarketData.upsert({
    where: { cardId },
    create: { cardId, marketCap, priceChange24h: norm.change24h, priceChange7d: norm.change7d, priceChange30d: norm.change30d, volatility30d: norm.volatility, rsi14: 50, investmentScore: score, rarityScore: Math.round(rarityRank * 10), liquidityScore: norm.market > 50 ? 80 : norm.market > 10 ? 60 : norm.market > 2 ? 40 : 20, trendDirection: trend as any, allTimeHigh: norm.market, allTimeLow: norm.low },
    update: { marketCap, priceChange24h: norm.change24h, priceChange7d: norm.change7d, priceChange30d: norm.change30d, volatility30d: norm.volatility, investmentScore: score, trendDirection: trend as any },
  })
}

/* ── Import d'un set complet ────────────────────────────────── */
async function importSet(
  setData: any,
  ptcgPrices: Map<string, any>,
  skipPrices: boolean,
  startedAt: number,
): Promise<{ cards: number; errors: number; timedOut: boolean }> {
  const cards: any[] = setData.cards ?? []
  let cardsAdded = 0, errors = 0

  // Déterminer série et type
  const serieName = setData.serie?.name ?? setData.serie ?? 'Autre'
  const isPocket = /^(A\d|B\d|P-A)/i.test(setData.id ?? '')
  const isPromo = /promo|sve|svp/i.test(setData.id ?? '')

  // Upsert le set
  const dbSet = await prisma.pokemonSet.upsert({
    where: { externalId: setData.id },
    create: {
      externalId: setData.id,
      name: setData.name ?? setData.id,
      series: isPocket ? 'TCG Pocket' : serieName,
      language: 'FR',
      releaseDate: setData.releaseDate ? new Date(setData.releaseDate) : null,
      totalCards: setData.cardCount?.official ?? setData.cardCount?.total ?? cards.length,
      printedTotal: setData.cardCount?.official ?? cards.length,
      symbolUrl: setData.symbol ?? null,
      logoUrl: setData.logo ?? null,
    },
    update: {
      name: setData.name ?? setData.id,
      series: isPocket ? 'TCG Pocket' : serieName,
      language: 'FR',
      symbolUrl: setData.symbol ?? null,
      logoUrl: setData.logo ?? null,
    },
  })

  // Cartes — fetch les détails complets pour les petits sets ou TCG Pocket
  const fetchFull = cards.length <= 80 || isPocket

  for (const stub of cards) {
    if (Date.now() - startedAt > TIMEOUT) return { cards: cardsAdded, errors, timedOut: true }

    try {
      // Détails complets de la carte
      let card = stub
      if (fetchFull) {
        const full = await tcgdexCard(stub.id ?? `${setData.id}-${stub.localId}`)
        if (full) card = full
        await sleep(60)
      }

      const cardId = card.id ?? stub.id ?? `${setData.id}-${stub.localId}`
      const localId = card.localId ?? stub.localId ?? ''
      const rarity = RARITY_MAP[card.rarity ?? ''] ?? 'UNKNOWN'

      // Image TCGdex (format FR)
      const imageBase = card.image ?? stub.image ?? null
      const imageSm = imageBase ? `${imageBase}/low.webp` : null
      const imageLg = imageBase ? `${imageBase}/high.webp` : null

      // Supertype
      const supertype =
        card.category === 'Énergie' || card.category === 'Energy' ? 'Energy'
        : card.category === 'Dresseur' || card.category === 'Trainer' ? 'Trainer'
        : 'Pokémon'

      const dbCard = await prisma.card.upsert({
        where: { externalId: cardId },
        create: {
          externalId: cardId,
          setId: dbSet.id,
          name: card.name ?? stub.name ?? cardId,
          localeName: { fr: card.name ?? stub.name ?? '', en: '' },
          number: localId,
          supertype,
          subtypes: card.stage ? [card.stage] : [],
          types: card.types ?? [],
          rarity: rarity as any,
          language: 'FR',
          imageSmUrl: imageSm,
          imageLgUrl: imageLg,
          illustrator: card.illustrator ?? null,
          flavorText: card.description ?? card.effect ?? null,
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
          name: card.name ?? stub.name ?? cardId,
          localeName: { fr: card.name ?? stub.name ?? '', en: '' },
          imageSmUrl: imageSm,
          imageLgUrl: imageLg,
          rarity: rarity as any,
          language: 'FR',
        },
      })

      // Prix depuis pokemontcg.io (si disponible et même ID de set)
      if (!skipPrices && ptcgPrices.size > 0) {
        const numClean = localId.replace(/^0+(?=[0-9])/, '')
        const ptcg = ptcgPrices.get(numClean) ?? ptcgPrices.get(localId)
        if (ptcg?.cardmarket?.prices) {
          await upsertCardPrice(dbCard.id, rarity, ptcg.cardmarket.prices).catch(() => {})
        }
      }

      cardsAdded++
    } catch (err) {
      console.error(`Erreur carte ${stub.id}:`, err)
      errors++
    }
  }

  return { cards: cardsAdded, errors, timedOut: false }
}

/* ── POST handler ───────────────────────────────────────────── */
export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const batchSize  = Math.min(8, parseInt(searchParams.get('batchSize') ?? '4'))
  const specificId = searchParams.get('setId')
  const skipPrices = searchParams.get('skipPrices') === 'true'
  const dryRun     = searchParams.get('dryRun') === 'true'
  const startedAt  = Date.now()

  // 1. Récupérer tous les sets FR depuis TCGdex
  let allFrSets: any[] = []
  if (specificId) {
    allFrSets = [{ id: specificId }]
  } else {
    allFrSets = await tcgdexSets()
    if (allFrSets.length === 0) {
      return NextResponse.json({ ok: false, error: 'TCGdex inaccessible' }, { status: 502 })
    }
  }

  // 2. Identifier les sets manquants en base
  const existingIds = new Set(
    (await prisma.pokemonSet.findMany({ select: { externalId: true } })).map(s => s.externalId)
  )
  const missing = allFrSets.filter(s => !existingIds.has(s.id))

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      totalFrSets: allFrSets.length,
      alreadyInDb: existingIds.size,
      missing: missing.length,
      nextBatch: missing.slice(0, batchSize).map(s => s.id),
    })
  }

  if (missing.length === 0) {
    return NextResponse.json({ ok: true, message: 'Toutes les extensions françaises sont importées ✓', remaining: 0 })
  }

  // 3. Traiter le premier batch
  const toProcess = missing.slice(0, batchSize)
  const results: any[] = []
  let totalCards = 0

  for (const setStub of toProcess) {
    if (Date.now() - startedAt > TIMEOUT) {
      results.push({ setId: setStub.id, status: 'timeout — relancer pour continuer' })
      break
    }

    try {
      // Détails complets du set
      const setData = await tcgdexSet(setStub.id)
      if (!setData) { results.push({ setId: setStub.id, status: 'error: set introuvable sur TCGdex' }); continue }

      // Prix pokemontcg.io (si l'ID set est compatible)
      let ptcgPrices = new Map<string, any>()
      if (!skipPrices) {
        ptcgPrices = await ptcgSetCards(setStub.id)
        if (ptcgPrices.size > 0) await sleep(300)
      }

      const { cards, errors, timedOut } = await importSet(setData, ptcgPrices, skipPrices, startedAt)
      totalCards += cards

      results.push({
        setId: setStub.id,
        name: setData.name,
        status: timedOut ? 'partial-timeout' : 'ok',
        cards,
        hasPrices: ptcgPrices.size > 0,
        errors,
      })

      if (timedOut) break
      await sleep(200)
    } catch (err: any) {
      results.push({ setId: setStub.id, status: `error: ${err.message?.slice(0, 60)}` })
    }
  }

  const remaining = missing.length - results.filter(r => r.status === 'ok').length

  return NextResponse.json({
    ok: true,
    duration: Math.round((Date.now() - startedAt) / 1000) + 's',
    processed: results.length,
    totalCards,
    results,
    remaining: Math.max(0, remaining),
    totalFrSets: allFrSets.length,
    message: remaining > 0
      ? `${remaining} extensions restantes — relance POST /api/admin/import-fr pour continuer`
      : '🎉 Toutes les extensions françaises importées !',
  })
}

/* ── GET → état actuel ──────────────────────────────────────── */
export async function GET() {
  const [allFrSets, dbSets, cards] = await Promise.all([
    tcgdexSets(),
    prisma.pokemonSet.findMany({ select: { externalId: true, name: true, totalCards: true, language: true } }),
    prisma.card.count(),
  ])

  const existingIds = new Set(dbSets.map(s => s.externalId))
  const missing = allFrSets.filter(s => !existingIds.has(s.id))

  return NextResponse.json({
    tcgdexFrSets: allFrSets.length,
    inDb: dbSets.length,
    cards,
    missing: missing.length,
    coverage: `${((dbSets.length / Math.max(allFrSets.length, 1)) * 100).toFixed(1)}%`,
    missingSets: missing.slice(0, 30).map(s => s.id),
    hint: 'POST ?batchSize=4 pour importer le prochain batch',
  })
}
