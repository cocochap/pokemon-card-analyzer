import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 120

// Cardmarket search URL pattern for sealed products
function buildCardmarketUrl(product: { name: string; type: string; language: string }): string {
  const query = encodeURIComponent(product.name.replace(/[()]/g, '').trim())
  const lang = product.language === 'JP' ? 'jp' : 'fr'
  return `https://www.cardmarket.com/${lang}/Pokemon/Products/Search?searchString=${query}`
}

// Price multipliers based on type and discontinuation status
// Used as fallback when we can't scrape Cardmarket
function estimateMarketPrice(product: {
  retailPrice: number | null
  type: string
  isDiscontinued: boolean
  investmentScore: number | null
  releaseDate: Date | null
}): number | null {
  if (!product.retailPrice) return null

  const base = product.retailPrice
  const score = product.investmentScore ?? 50
  const ageYears = product.releaseDate
    ? (Date.now() - product.releaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365)
    : 0

  let multiplier = 1.0

  // Discontinued premium
  if (product.isDiscontinued) {
    if (ageYears > 5) multiplier *= 4.0      // vintage
    else if (ageYears > 3) multiplier *= 2.5  // old
    else if (ageYears > 1) multiplier *= 1.6  // recent discontinued
    else multiplier *= 1.2                    // just discontinued
  }

  // Score premium
  if (score >= 90) multiplier *= 1.3
  else if (score >= 80) multiplier *= 1.15
  else if (score >= 70) multiplier *= 1.05

  // Type premium (booster boxes hold value better)
  if (product.type === 'BOOSTER_BOX') multiplier *= 1.1

  return Math.round(base * multiplier * 100) / 100
}

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret') ?? req.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const products = await prisma.sealedProduct.findMany({
    select: {
      id: true, name: true, type: true, language: true,
      retailPrice: true, isDiscontinued: true,
      investmentScore: true, releaseDate: true,
      cardmarketUrl: true,
    },
  })

  let updated = 0
  const errors: string[] = []

  for (const product of products) {
    try {
      // Try to fetch real price from Cardmarket (if URL set)
      // For now, use the estimation model as base
      const estimatedPrice = estimateMarketPrice(product)

      if (estimatedPrice) {
        await prisma.sealedPriceHistory.create({
          data: {
            productId: product.id,
            price: estimatedPrice,
            source: 'estimate',
          },
        })

        // Keep only last 90 price points per product
        const old = await prisma.sealedPriceHistory.findMany({
          where: { productId: product.id },
          orderBy: { recordedAt: 'desc' },
          skip: 90,
          select: { id: true },
        })
        if (old.length > 0) {
          await prisma.sealedPriceHistory.deleteMany({ where: { id: { in: old.map(o => o.id) } } })
        }

        updated++
      }
    } catch (e: any) {
      errors.push(`${product.name}: ${e.message}`)
    }
  }

  return NextResponse.json({ updated, errors, total: products.length })
}
