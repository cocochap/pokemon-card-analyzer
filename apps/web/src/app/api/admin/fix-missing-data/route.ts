/**
 * POST /api/admin/fix-missing-data
 * ?fix=marketdata  → créer CardMarketData manquants
 * ?fix=images      → reconstruire URLs images manquantes
 * ?fix=digital     → créer prix vides pour cartes Pocket/Méga
 * ?fix=all         → tout (défaut)
 * ?limit=200
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

const RARITY_RANK: Record<string, number> = {
  CROWN_RARE: 10, HYPER_RARE: 9, SPECIAL_ILLUSTRATION_RARE: 9,
  ILLUSTRATION_RARE: 8, RARE_SECRET: 8, RARE_RAINBOW: 7, RARE_ULTRA: 7,
  RARE_HOLO_VSTAR: 6, RARE_HOLO_VMAX: 6, RARE_HOLO_V: 5, RARE_HOLO_EX: 5,
  RARE_HOLO_GX: 5, RARE_HOLO: 4, RARE: 3, UNCOMMON: 2, COMMON: 1,
}

const DIGITAL_SET_IDS = [
  'A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a',
  'B1','B1a','B2','B2a','P-A',
  'me01','me02','me02.5','me03','mee','mep',
]

export async function POST(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const fix = searchParams.get('fix') ?? 'all'
  const limit = Math.min(500, parseInt(searchParams.get('limit') ?? '200'))

  const results: Record<string, any> = {}

  try {
    // ── 1. MarketData manquants ──────────────────────────────────────────────
    if (fix === 'all' || fix === 'marketdata') {
      const cards = await prisma.$queryRaw<{ id: string; rarity: string }[]>`
        SELECT c.id, c.rarity::text
        FROM "Card" c
        LEFT JOIN "CardMarketData" md ON md."cardId" = c.id
        WHERE md.id IS NULL
        LIMIT ${limit}
      `

      let mdFixed = 0
      if (cards.length > 0) {
        const priceMap = await prisma.cardPrice.findMany({
          where: { cardId: { in: cards.map((c) => c.id) }, source: 'cardmarket' },
          select: { cardId: true, market: true },
        })
        const priceByCard = new Map(priceMap.map((p) => [p.cardId, Number(p.market ?? 0)]))

        await prisma.cardMarketData.createMany({
          data: cards.map((c) => {
            const price = priceByCard.get(c.id) ?? 0
            const rr = RARITY_RANK[c.rarity] ?? 2
            return {
              cardId: c.id,
              investmentScore: Math.min(100, 40 + rr * 3 + (price > 50 ? 10 : price > 10 ? 5 : 0)),
              rarityScore: rr * 10,
              liquidityScore: price > 50 ? 60 : price > 5 ? 30 : 10,
              priceChange24h: 0, priceChange7d: 0, priceChange30d: 0,
              volatility30d: 0.2,
              trendDirection: 'STABLE',
              allTimeHigh: price > 0 ? price : null,
              allTimeLow: price > 0 ? price * 0.7 : null,
            }
          }),
          skipDuplicates: true,
        })
        mdFixed = cards.length
      }
      results.marketdata = { fixed: mdFixed }
    }

    // ── 2. Images manquantes ─────────────────────────────────────────────────
    if (fix === 'all' || fix === 'images') {
      const cards = await prisma.$queryRaw<{ id: string; externalId: string }[]>`
        SELECT id, "externalId"
        FROM "Card"
        WHERE "imageSmUrl" IS NULL OR "imageSmUrl" = ''
        LIMIT ${limit}
      `

      let imgFixed = 0
      for (const card of cards) {
        try {
          const parts = card.externalId.split('-')
          const setId = parts[0]
          const localId = parts.slice(1).join('-')
          const isPocket = /^(A\d|B\d|P-A)/i.test(setId)

          const imageSmUrl = isPocket
            ? `https://assets.tcgdex.net/fr/tcgp/${setId}/${localId}/low.webp`
            : `https://images.pokemontcg.io/${setId}/${localId}.png`
          const imageLgUrl = isPocket
            ? `https://assets.tcgdex.net/fr/tcgp/${setId}/${localId}/high.webp`
            : `https://images.pokemontcg.io/${setId}/${localId}_hires.png`

          await prisma.card.update({
            where: { id: card.id },
            data: { imageSmUrl, imageLgUrl },
          })
          imgFixed++
        } catch { /* skip */ }
      }
      results.images = { fixed: imgFixed }
    }

    // ── 3. Prix vides pour cartes digitales ─────────────────────────────────
    if (fix === 'all' || fix === 'digital') {
      const sets = await prisma.pokemonSet.findMany({
        where: { externalId: { in: DIGITAL_SET_IDS } },
        select: { id: true, externalId: true },
      })

      const setIds = sets.map((s) => s.id)
      if (setIds.length > 0) {
        const cards = await prisma.$queryRaw<{ id: string }[]>`
          SELECT c.id FROM "Card" c
          LEFT JOIN "CardPrice" cp ON cp."cardId" = c.id
          WHERE c."setId" = ANY(${setIds}::text[])
          AND cp.id IS NULL
          LIMIT ${limit}
        `

        let dgFixed = 0
        if (cards.length > 0) {
          await prisma.cardPrice.createMany({
            data: cards.map((c) => ({
              cardId: c.id, source: 'pocket', variant: 'NORMAL',
              currency: 'EUR', market: 0, low: 0, mid: 0, high: 0,
            })),
            skipDuplicates: true,
          })
          dgFixed = cards.length
        }
        results.digital = { fixed: dgFixed }
      } else {
        results.digital = { fixed: 0 }
      }
    }

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, ...results })
}

export async function GET() {
  const [noMarket, noImage, noPrice, total] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) FROM "Card" c
      LEFT JOIN "CardMarketData" md ON md."cardId" = c.id
      WHERE md.id IS NULL
    `.then((r) => Number(r[0].count)),
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
