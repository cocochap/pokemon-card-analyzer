/**
 * POST /api/admin/sync-pokecardex
 *
 * Récupère les prix FRANÇAIS depuis pokecardex.com (données Cardmarket FR).
 * Fonctionne set par set, resumable.
 *
 * Stratégie :
 *   1. Fetch /series/{code} → déchiffre → liste de cartes (id_card, num_card, name_fr)
 *   2. Pour chaque carte : find in DB par numéro + set → fetch /carte/{id_card} → prix Cardmarket FR
 *   3. Upsert CardPrice avec source='cardmarket' et les vraies valeurs FR
 *
 * Query params :
 *   ?seriesCode=SVI       → forcer un set spécifique
 *   ?limit=30             → nb max de cartes à pricer par appel (défaut 30)
 *   ?offset=0             → pour reprendre où on s'est arrêté
 *   ?dryRun=true          → voir les cartes sans écrire en DB
 *
 * GET → état (sets connus de pokecardex, combien ont des prix FR)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { fetchDecrypt, fetchCardPrice } from '@/lib/pokecardex/decrypt'
import {
  computeInvestmentScore,
  RARITY_RANK,
} from '@/lib/pricing/normalize'
import { subDays } from 'date-fns'

export const runtime  = 'nodejs'
export const maxDuration = 300

const TIMEOUT_MS = 240_000

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

// Mapping pokecardex nom_court → externalId TCGdex/notre DB
// Basé sur les noms de sets identifiés sur pokecardex.com
const SERIES_MAP: Record<string, string> = {
  // Écarlate et Violet
  'SVI':   'sv1',     'PAL':   'sv2',    'OBF':   'sv3',
  'MEW':   'sv3pt5',  'PAR':   'sv4',    'PAF':   'sv4pt5',
  'TEF':   'sv5',     'TWM':   'sv6',    'SFA':   'sv6pt5',
  'SCR':   'sv7',     'SSP':   'sv8',    'PRE':   'sv8pt5',
  'JTG':   'sv9',     'DRI':   'sv10',   'SVP':   'svp',
  // Épée et Bouclier
  'SWSHb': 'swsh1',  'REB':   'swsh2',  'TEN':   'swsh3',
  'VIV':   'swsh4',  'BST':   'swsh5',  'CRE':   'swsh6',
  'EVS':   'swsh7',  'FST':   'swsh8',  'BRS':   'swsh9',
  'ASR':   'swsh10', 'LOR':   'swsh11', 'SIT':   'swsh12',
  'CRZ':   'swsh12pt5','SWSH35':'swsh35','SWSH45':'swsh45',
  'CEL':   'cel25',  'PGO':   'pgo',    'PRSWSH':'swshp',
  // Soleil et Lune
  'SL01':  'sm1',    'SL02':  'sm2',    'SL03':  'sm3',
  'SL035': 'sm3pt5', 'SL04':  'sm4',    'SL05':  'sm5',
  'SL06':  'sm6',    'SL07':  'sm7',    'SL08':  'sm8',
  'SL09':  'sm9',    'SL10':  'sm10',   'SL11':  'sm11',
  'SL12':  'sm12',   'SLE':   'smp',
  // XY
  'XY':    'xy1',    'XY2':   'xy2',    'XY3':   'xy3',
  'XY4':   'xy4',    'XY5':   'xy5',    'XY6':   'xy6',
  'XY7':   'xy7',    'XY8':   'xy8',    'XY9':   'xy9',
  'XY10':  'xy10',   'XY11':  'xy11',   'XY12':  'xy12',
  'PRXY':  'xyp',
  // Noir et Blanc
  'NB':    'bw1',    'NB2':   'bw2',    'NB3':   'bw3',
  'NB4':   'bw4',    'NB5':   'bw5',    'NB6':   'bw6',
  'NB7':   'bw7',    'NB8':   'bw8',    'NB9':   'bw9',
  'NB10':  'bw10',   'NB11':  'bw11',   'PRNB':  'bwp',
  // HeartGold SoulSilver
  'HGSS':  'hgss1',  'HGSS2': 'hgss2',  'HGSS3': 'hgss3',
  'HGSS4': 'hgss4',  'PRHGSS':'hgssp',
  // Platine
  'PT':    'pl1',    'PT2':   'pl2',    'PT3':   'pl3',
  'PT4':   'pl4',
  // Diamant et Perle
  'DP':    'dp1',    'DP2':   'dp2',    'DP3':   'dp3',
  'DP4':   'dp4',    'DP5':   'dp5',    'DP6':   'dp6',
  'PRDP':  'dpp',
  // EX
  'EX1':   'ex1',    'EX2':   'ex2',    'EX3':   'ex3',
  'EX4':   'ex4',    'EX5':   'ex5',    'EX6':   'ex6',
  'EX7':   'ex7',    'EX8':   'ex8',    'EX9':   'ex9',
  'EX10':  'ex10',   'EX11':  'ex11',   'EX12':  'ex12',
  'EX13':  'ex13',   'EX14':  'ex14',   'EX15':  'ex15',
  'EX16':  'ex16',
  // Wizards (Série de Base)
  'BS':    'base1',  'JU':    'base2',  'FO':    'base3',
  'TR':    'base4',  'B2':    'base5',  'LG':    'base6',
  // Neo
  'NEO1':  'neo1',   'NEO2':  'neo2',   'NEO3':  'neo3',
  'NEO4':  'neo4',
}

async function upsertFrPrice(
  cardId: string,
  rarity: string,
  p: NonNullable<Awaited<ReturnType<typeof fetchCardPrice>>>
) {
  const market = p.trendPrice ?? p.averageSellPrice ?? 0
  const low    = p.lowPrice ?? market * 0.7
  const high   = market * 1.3
  const mid    = p.averageSellPrice ?? market
  const avg7   = p.avg7 ?? market
  const avg30  = p.avg30 ?? market

  if (market <= 0) return

  const today = new Date(); today.setHours(0, 0, 0, 0)

  // Prix principal
  await prisma.cardPrice.upsert({
    where: { cardId_source_variant: { cardId, source: 'cardmarket', variant: 'NORMAL' } },
    create: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', market, mid, low, high },
    update: { market, mid, low, high, fetchedAt: new Date() },
  })

  // Reverse holo si différent
  if (p.reverseHoloTrend && p.reverseHoloTrend > 0 && Math.abs(p.reverseHoloTrend - market) > 0.05) {
    await prisma.cardPrice.upsert({
      where: { cardId_source_variant: { cardId, source: 'cardmarket', variant: 'REVERSE_HOLO' } },
      create: { cardId, source: 'cardmarket', variant: 'REVERSE_HOLO', currency: 'EUR', market: p.reverseHoloTrend, mid: p.reverseHoloTrend, low: p.reverseHoloTrend * 0.7, high: p.reverseHoloTrend * 1.3 },
      update: { market: p.reverseHoloTrend, fetchedAt: new Date() },
    })
  }

  // Historique aujourd'hui
  const todayExists = await prisma.priceHistory.findFirst({
    where: { cardId, source: 'cardmarket', recordedAt: { gte: today } },
  })
  if (!todayExists) {
    await prisma.priceHistory.create({
      data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: market, recordedAt: today },
    })
  }

  // avg7 / avg30 historiques
  if (avg7 > 0 && Math.abs(avg7 - market) > 0.01) {
    const d7 = subDays(today, 7)
    const ex7 = await prisma.priceHistory.findFirst({ where: { cardId, source: 'cardmarket', recordedAt: { gte: d7, lt: subDays(today, 6) } } })
    if (!ex7) await prisma.priceHistory.create({ data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: avg7, recordedAt: d7 } })
  }
  if (avg30 > 0 && Math.abs(avg30 - avg7) > 0.01) {
    const d30 = subDays(today, 30)
    const ex30 = await prisma.priceHistory.findFirst({ where: { cardId, source: 'cardmarket', recordedAt: { gte: d30, lt: subDays(today, 29) } } })
    if (!ex30) await prisma.priceHistory.create({ data: { cardId, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: avg30, recordedAt: d30 } })
  }

  // CardMarketData (scores investissement)
  const rarityRank = RARITY_RANK[rarity] ?? 2
  const change7d  = avg7  > 0 ? (market - avg7)  / avg7  : 0
  const change30d = avg30 > 0 ? (market - avg30) / avg30 : 0
  const volatility = avg30 > 0 ? Math.abs(market - avg30) / avg30 : 0
  const score = computeInvestmentScore({ change7d, change30d, volatility, rarityRank, price: market, rsi: 50 })
  const trend = volatility > 0.25 ? 'VOLATILE' : change7d > 0.05 ? 'BULLISH' : change7d < -0.05 ? 'BEARISH' : 'STABLE'
  const copiesMap: Record<string, number> = { CROWN_RARE: 800, HYPER_RARE: 1200, SPECIAL_ILLUSTRATION_RARE: 1500, ILLUSTRATION_RARE: 3000, RARE_SECRET: 2000, RARE_ULTRA: 4000, RARE_HOLO: 15000, RARE: 25000, UNCOMMON: 80000, COMMON: 200000 }
  const marketCap = market * (copiesMap[rarity] ?? 10000)

  await prisma.cardMarketData.upsert({
    where: { cardId },
    create: { cardId, marketCap, priceChange24h: 0, priceChange7d: change7d, priceChange30d: change30d, volatility30d: volatility, rsi14: 50, investmentScore: score, rarityScore: Math.round(rarityRank * 10), liquidityScore: market > 50 ? 80 : market > 10 ? 60 : market > 2 ? 40 : 20, trendDirection: trend as any, allTimeHigh: market, allTimeLow: low },
    update: { marketCap, priceChange7d: change7d, priceChange30d: change30d, volatility30d: volatility, investmentScore: score, trendDirection: trend as any },
  })
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const seriesCode = searchParams.get('seriesCode')
  const limit      = Math.min(50, parseInt(searchParams.get('limit') ?? '30'))
  const offset     = parseInt(searchParams.get('offset') ?? '0')
  const dryRun     = searchParams.get('dryRun') === 'true'
  const startedAt  = Date.now()

  if (!seriesCode) {
    return NextResponse.json({
      error: 'Paramètre ?seriesCode= obligatoire (ex: SVI, PAL, OBF...)',
      availableCodes: Object.keys(SERIES_MAP),
    }, { status: 400 })
  }

  const ourSetId = SERIES_MAP[seriesCode.toUpperCase()]
  if (!ourSetId) {
    return NextResponse.json({
      error: `Set "${seriesCode}" non mappé`,
      hint: 'Ajoute le mapping dans SERIES_MAP ou utilise seriesCode parmi les clés disponibles',
      availableCodes: Object.keys(SERIES_MAP),
    }, { status: 400 })
  }

  // 1. Fetch liste des cartes depuis pokecardex
  console.log(`[pokecardex] Fetch série ${seriesCode}...`)
  const seriesData = await fetchDecrypt(`/series/${seriesCode}`)
  if (!seriesData) {
    return NextResponse.json({ error: `Impossible de fetcher /series/${seriesCode}` }, { status: 502 })
  }

  const pokecardexCards: any[] = seriesData.cartes ?? []
  const batch = pokecardexCards.slice(offset, offset + limit)

  if (batch.length === 0) {
    return NextResponse.json({ ok: true, message: 'Toutes les cartes de ce set ont été traitées', total: pokecardexCards.length })
  }

  // 2. Charger le set depuis notre DB
  const dbSet = await prisma.pokemonSet.findFirst({ where: { externalId: ourSetId } })
  if (!dbSet) {
    return NextResponse.json({ error: `Set ${ourSetId} introuvable en DB — importe d'abord avec /api/admin/import-fr` }, { status: 404 })
  }

  const stats = { found: 0, priced: 0, notFound: 0, errors: 0 }
  const results: any[] = []

  for (const pcCard of batch) {
    if (Date.now() - startedAt > TIMEOUT_MS) {
      results.push({ status: 'timeout', nextOffset: offset + results.length })
      break
    }

    const numCard = String(pcCard.num_card ?? '').trim()
    const idCard  = pcCard.id_card as number
    const nameFr  = pcCard.name_card_fr ?? pcCard.name_card_en ?? ''

    if (!numCard || !idCard) continue

    try {
      // Chercher la carte dans notre DB par numéro
      const numClean = numCard.replace(/^0+(?=[0-9])/, '')
      const dbCard = await prisma.card.findFirst({
        where: {
          setId: dbSet.id,
          OR: [
            { number: numCard },
            { number: numClean },
            { number: numCard.padStart(3, '0') },
          ],
        },
        select: { id: true, name: true, rarity: true, number: true },
      })

      if (!dbCard) {
        stats.notFound++
        if (dryRun) results.push({ pcNum: numCard, nameFr, status: 'not_found_in_db' })
        continue
      }

      stats.found++

      if (dryRun) {
        results.push({ pcNum: numCard, nameFr, dbName: dbCard.name, idCard, status: 'found' })
        continue
      }

      // Fetch prix depuis pokecardex
      const prices = await fetchCardPrice(idCard)
      if (!prices || !prices.trendPrice) {
        stats.errors++
        results.push({ pcNum: numCard, nameFr, status: 'no_price' })
        await sleep(400)
        continue
      }

      await upsertFrPrice(dbCard.id, dbCard.rarity, prices)
      stats.priced++
      results.push({
        num: numCard, name: dbCard.name,
        market: prices.trendPrice, avg7: prices.avg7, avg30: prices.avg30,
        status: 'ok',
      })

      // Rate limiting — respecter pokecardex.com
      await sleep(700)
    } catch (e: any) {
      stats.errors++
      results.push({ pcNum: numCard, error: e.message?.slice(0, 60) })
    }
  }

  const remaining = pokecardexCards.length - (offset + batch.length)

  return NextResponse.json({
    ok: true,
    dryRun,
    seriesCode,
    ourSetId,
    duration: Math.round((Date.now() - startedAt) / 1000) + 's',
    total: pokecardexCards.length,
    processed: batch.length,
    ...stats,
    remaining,
    nextOffset: remaining > 0 ? offset + batch.length : null,
    results,
    message: remaining > 0
      ? `${remaining} cartes restantes — relancer avec ?seriesCode=${seriesCode}&offset=${offset + batch.length}`
      : `✅ Set ${seriesCode} complet !`,
  })
}

export async function GET() {
  const [totalCards, pricedCards, totalSets] = await Promise.all([
    prisma.card.count(),
    prisma.cardPrice.count({ where: { source: 'cardmarket' } }),
    prisma.pokemonSet.count(),
  ])

  return NextResponse.json({
    totalCards,
    cardsWithFrPrice: pricedCards,
    priceCoverage: totalCards > 0 ? `${((pricedCards / totalCards) * 100).toFixed(1)}%` : '0%',
    totalSets,
    availableSeriesCodes: Object.keys(SERIES_MAP),
    totalMappedSeries: Object.keys(SERIES_MAP).length,
    hint: 'POST ?seriesCode=SVI&limit=30 pour pricer un set. Relancer avec ?offset=N pour continuer.',
    example: 'POST /api/admin/sync-pokecardex?seriesCode=SVI&limit=30',
  })
}
