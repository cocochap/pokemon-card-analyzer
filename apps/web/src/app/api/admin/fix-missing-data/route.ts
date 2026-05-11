/**
 * POST /api/admin/fix-missing-data
 * Corrige les données manquantes :
 *   1. CardMarketData manquant → créer entrée par défaut
 *   2. Images manquantes → reconstruire l'URL depuis TCGdex ou pokemontcg.io
 *   3. Prix manquants sur sets qui ont des données pokemontcg.io → sync
 *
 * Query:
 *   ?fix=marketdata   → créer CardMarketData manquants
 *   ?fix=images       → corriger images manquantes
 *   ?fix=prices       → sync prix via pokemontcg.io pour sets manquants
 *   ?fix=all          → tout (défaut)
 *   ?limit=500        → nb cartes par run
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { RARITY_RANK } from '@/lib/pricing/normalize'

export const runtime = 'nodejs'
export const maxDuration = 300

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)) }

async function fixMarketData(limit: number) {
  // Cartes sans CardMarketData
  const cards = await prisma.card.findMany({
    where: { marketData: { is: null } },
    select: { id: true, rarity: true, prices: { select: { market: true, source: true }, take: 1 } },
    take: limit,
  })

  if (cards.length === 0) return { fixed: 0 }

  let fixed = 0
  const data = cards.map((c) => {
    const price = Number(c.prices[0]?.market ?? 0)
    const rarityRank = RARITY_RANK[String(c.rarity)] ?? 2
    const investmentScore = Math.round(40 + rarityRank * 3 + (price > 50 ? 10 : price > 10 ? 5 : 0))
    return {
      cardId: c.id,
      priceChange24h: 0,
      priceChange7d: 0,
      priceChange30d: 0,
      volatility30d: 0.2,
      investmentScore,
      rarityScore: rarityRank * 10,
      liquidityScore: price > 50 ? 60 : price > 5 ? 30 : 10,
      trendDirection: 'STABLE' as const,
      allTimeHigh: price > 0 ? price : null,
      allTimeLow: price > 0 ? price * 0.7 : null,
    }
  })

  await prisma.cardMarketData.createMany({ data, skipDuplicates: true })
  fixed = data.length

  return { fixed }
}

async function fixImages(limit: number) {
  const cards = await prisma.card.findMany({
    where: { OR: [{ imageSmUrl: null }, { imageSmUrl: '' }] },
    select: { id: true, externalId: true },
    take: limit,
  })
  if (cards.length === 0) return { fixed: 0 }

  let fixed = 0
  const updates: { id: string; imageSmUrl: string; imageLgUrl: string }[] = []

  for (const card of cards) {
    const parts = card.externalId.split('-')
    const setId = parts[0]
    const localId = parts.slice(1).join('-')
    const isPocket = /^(A\d|B\d|P-A)/i.test(setId)

    // Pattern pokemontcg.io : sv1-1 → images.pokemontcg.io/sv1/1.png
    const ptcgSm = `https://images.pokemontcg.io/${setId}/${localId}.png`
    const ptcgLg = `https://images.pokemontcg.io/${setId}/${localId}_hires.png`

    // Pattern TCGdex Pocket
    const tcgdexBase = isPocket
      ? `https://assets.tcgdex.net/fr/tcgp/${setId}/${localId}`
      : `https://assets.tcgdex.net/fr/${setId}/${localId}`

    // Sans HEAD check (trop lent) — utiliser pokemontcg.io pour sets physiques, TCGdex pour Pocket
    if (isPocket) {
      updates.push({ id: card.id, imageSmUrl: `${tcgdexBase}/low.webp`, imageLgUrl: `${tcgdexBase}/high.webp` })
    } else {
      updates.push({ id: card.id, imageSmUrl: ptcgSm, imageLgUrl: ptcgLg })
    }
    fixed++
  }

  // Batch update
  await Promise.all(
    updates.map((u) =>
      prisma.card.update({
        where: { id: u.id },
        data: { imageSmUrl: u.imageSmUrl, imageLgUrl: u.imageLgUrl },
      })
    )
  )

  return { fixed }
}

async function fixPrices(limit: number) {
  // Sets avec des cartes sans prix qui ont des données pokemontcg.io
  const setsWithNoPrices = await prisma.pokemonSet.findMany({
    where: {
      cards: {
        some: { prices: { none: {} } },
      },
      // Exclure les sets TCG Pocket et kits (pas de prix physiques)
      NOT: {
        externalId: {
          in: [
            'A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a',
            'B1','B1a','B2','B2a','P-A','me01','me02','me02.5','me03','mee','mep',
          ],
        },
      },
    },
    select: { externalId: true, name: true },
    take: limit,
  })

  if (setsWithNoPrices.length === 0) return { syncedSets: 0 }

  let syncedSets = 0
  for (const set of setsWithNoPrices) {
    try {
      // Re-sync via pokemontcg.io
      const res = await fetch(
        `https://api.pokemontcg.io/v2/cards?q=set.id:${set.externalId}&pageSize=250&select=id,number,cardmarket,tcgplayer`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) continue
      const data = await res.json()
      const ptcgCards: any[] = data.data ?? []

      for (const ptcg of ptcgCards) {
        const cm = ptcg.cardmarket?.prices
        if (!cm?.trendPrice && !cm?.averageSellPrice) continue

        const dbCard = await prisma.card.findUnique({
          where: { externalId: ptcg.id },
          select: { id: true },
        })
        if (!dbCard) continue

        const market = cm.trendPrice ?? cm.averageSellPrice ?? 0
        if (market <= 0) continue

        await prisma.cardPrice.upsert({
          where: { cardId_source_variant: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL' } },
          create: {
            cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR',
            market, mid: cm.averageSellPrice ?? market,
            low: cm.lowPriceExPlus ?? cm.lowPrice ?? market * 0.7,
            high: market * 1.3,
          },
          update: { market, fetchedAt: new Date() },
        })
      }
      syncedSets++
      await sleep(500)
    } catch { /* continuer */ }
  }

  return { syncedSets }
}

// Crée des entrées prix vides pour les cartes digitales (Pocket, kits) sans prix
async function fixDigitalPrices(limit: number) {
  const digitalSets = [
    'A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a',
    'B1','B1a','B2','B2a','P-A',
    'me01','me02','me02.5','me03','mee','mep',
  ]

  const cards = await prisma.card.findMany({
    where: {
      prices: { none: {} },
      set: { externalId: { in: digitalSets } },
    },
    select: { id: true, externalId: true },
    take: limit,
  })

  if (cards.length === 0) return { fixed: 0 }

  await prisma.cardPrice.createMany({
    data: cards.map((c) => ({
      cardId: c.id, source: 'pocket', variant: 'NORMAL', currency: 'EUR',
      market: 0, low: 0, mid: 0, high: 0,
    })),
    skipDuplicates: true,
  })

  return { fixed: cards.length }
}

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const fix = searchParams.get('fix') ?? 'all'
  const limit = parseInt(searchParams.get('limit') ?? '500')

  const startedAt = Date.now()
  const results: Record<string, any> = {}

  if (fix === 'all' || fix === 'marketdata') {
    results.marketdata = await fixMarketData(limit)
  }

  if (fix === 'all' || fix === 'images') {
    results.images = await fixImages(Math.min(limit, 1000))
  }

  if (fix === 'all' || fix === 'prices') {
    results.prices = await fixPrices(Math.min(limit, 20))
  }

  if (fix === 'all' || fix === 'digital') {
    results.digital = await fixDigitalPrices(limit)
  }

  return NextResponse.json({
    ok: true,
    duration: Math.round((Date.now() - startedAt) / 1000) + 's',
    ...results,
  })
}

export async function GET() {
  const [noMarket, noImage, noPrice, total] = await Promise.all([
    prisma.card.count({ where: { marketData: { is: null } } }),
    prisma.card.count({ where: { OR: [{ imageSmUrl: null }, { imageSmUrl: '' }] } }),
    prisma.card.count({ where: { prices: { none: {} } } }),
    prisma.card.count(),
  ])
  return NextResponse.json({
    total,
    noMarketData: noMarket,
    noImage,
    noPrice,
    coverage: {
      marketData: `${((total - noMarket) / total * 100).toFixed(1)}%`,
      images: `${((total - noImage) / total * 100).toFixed(1)}%`,
      prices: `${((total - noPrice) / total * 100).toFixed(1)}%`,
    },
  })
}
