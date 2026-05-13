import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserTier, isEliteTier } from '@/lib/subscription'

export const runtime = 'nodejs'

// Inline scoring helpers (mirrors generate-investment-picks.mjs logic)
const RARITY_SCORES: Record<string, number> = {
  SPECIAL_ILLUSTRATION_RARE: 1.0, HYPER_RARE: 1.0, CROWN_RARE: 1.0,
  ILLUSTRATION_RARE: 0.85, RARE_RAINBOW: 0.85, RARE_SECRET: 0.85,
  RARE_ULTRA: 0.70, RARE_HOLO_VMAX: 0.65, RARE_HOLO_VSTAR: 0.65,
  RARE_HOLO_EX: 0.60, RARE_HOLO_GX: 0.55, RARE_HOLO_V: 0.55,
  RARE_HOLO: 0.40, AMAZING_RARE: 0.50, RARE_SHINY_GX: 0.50,
  LEGEND: 0.60, PROMO: 0.30, RARE: 0.25, UNCOMMON: 0.10, COMMON: 0.05, UNKNOWN: 0.05,
}

const SCARCE_EXACT = new Set(['me01','me02','me03','mep','mee','meg','cel25','swsh35','dpp','hgssp','smp'])

function scarcityScore(exId: string, rarity: string): number {
  if (SCARCE_EXACT.has(exId)) return 1.0
  if (['pop','tk-','prswsh','prxy','prsm','np','wc'].some(p => exId.startsWith(p))) return 0.85
  if (rarity === 'PROMO') return 0.70
  return 0
}

function investmentLabel(score: number): string {
  if (score >= 75) return 'Excellent'
  if (score >= 60) return 'Bon'
  if (score >= 45) return 'Moyen'
  if (score >= 30) return 'Faible'
  return 'Déconseillé'
}

function riskLabel(vol: number): string {
  if (vol > 35) return 'Élevé'
  if (vol > 20) return 'Modéré'
  return 'Faible'
}

export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ error: 'Connexion requise', requiresAuth: true }, { status: 401 })
  }

  const tier = await getUserTier(clerkId)
  if (!isEliteTier(tier)) {
    return NextResponse.json({ error: 'Abonnement Elite requis', requiresElite: true }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get('cardId')
  if (!cardId) return NextResponse.json({ error: 'cardId requis' }, { status: 400 })

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      set: { select: { name: true, externalId: true, series: true, releaseDate: true } },
      prices: { where: { source: 'cardmarket' }, select: { market: true, low: true, high: true } },
      marketData: true,
      priceHistory: {
        orderBy: { recordedAt: 'desc' },
        take: 90,
        select: { price: true, recordedAt: true },
      },
    },
  })

  if (!card) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })

  const price = Number(card.prices?.[0]?.market ?? 0)
  const md = card.marketData
  const ath = md?.allTimeHigh ? Number(md.allTimeHigh) : price
  const atl = md?.allTimeLow ? Number(md.allTimeLow) : price
  const change7d = md?.priceChange7d ? Number(md.priceChange7d) : 0
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const vol30d = md?.volatility30d ? Number(md.volatility30d) : 0
  const rsi = md?.rsi14 ? Number(md.rsi14) : null
  const rarityW = RARITY_SCORES[card.rarity] ?? 0.05
  const exId = card.set?.externalId ?? ''
  const scarce = scarcityScore(exId, card.rarity)
  const athDropPct = ath > price ? +(((ath - price) / ath) * 100).toFixed(1) : 0
  const investScore = md?.investmentScore ?? 0

  // Build bullish/bearish signals
  const bullish: string[] = []
  const bearish: string[] = []

  if (athDropPct > 20) bullish.push(`${athDropPct}% sous son All-Time High — fort potentiel de récupération`)
  if (change7d > 2) bullish.push(`Hausse de ${change7d.toFixed(1)}% sur 7 jours — momentum positif`)
  if (rarityW >= 0.7) bullish.push('Rareté parmi les plus élevées du TCG — offre naturellement limitée')
  if (scarce >= 0.85) bullish.push('Coffret / promo discontinué — supply définitivement figé')
  if (scarce >= 0.7) bullish.push('Pas de réimpression possible — rareté absolue garantie')
  if (rsi !== null && rsi < 35) bullish.push(`RSI à ${rsi.toFixed(0)} — zone de survente, rebond probable`)
  if (vol30d < 10) bullish.push('Faible volatilité — mouvement de prix stable et ordonné')

  if (change7d < -5) bearish.push(`Baisse de ${Math.abs(change7d).toFixed(1)}% sur 7 jours — pression vendeuse`)
  if (vol30d > 30) bearish.push(`Volatilité à ${vol30d.toFixed(0)}% — prix instable, entrée risquée`)
  if (rsi !== null && rsi > 70) bearish.push(`RSI à ${rsi.toFixed(0)} — zone de surachat, risque de correction`)
  if (price === ath) bearish.push('Prix à son All-Time High — upside limité à court terme')
  bearish.push('Risque de tendance générale du marché TCG')
  if (rarityW < 0.4) bearish.push('Rareté modeste — demande moins structurelle')

  // Horizon recommendation
  let horizon = '3-6 mois'
  let targetLow = 0
  let targetHigh = 0

  if (athDropPct > 30 && rarityW >= 0.5) {
    horizon = '6-12 mois'
    targetLow = +(price * 1.3).toFixed(2)
    targetHigh = +(ath * 0.85).toFixed(2)
  } else if (change7d > 3) {
    horizon = '1-2 mois'
    targetLow = +(price * 1.10).toFixed(2)
    targetHigh = +(price * 1.30).toFixed(2)
  } else if (scarce >= 0.85) {
    horizon = '6-18 mois'
    targetLow = +(price * 1.25).toFixed(2)
    targetHigh = +(price * 1.80).toFixed(2)
  } else {
    targetLow = +(price * 1.15).toFixed(2)
    targetHigh = +(price * 1.40).toFixed(2)
  }

  return NextResponse.json({
    card: {
      id: card.id,
      name: card.name,
      rarity: card.rarity,
      number: card.number,
      imageSmUrl: card.imageSmUrl,
      set: card.set,
    },
    analysis: {
      investmentScore: investScore,
      investmentLabel: investmentLabel(investScore),
      riskLevel: riskLabel(vol30d),
      horizon,
      price,
      ath,
      atl,
      athDropPct,
      change7d: +change7d.toFixed(2),
      change30d: +change30d.toFixed(2),
      volatility30d: +vol30d.toFixed(2),
      rsi: rsi ? +rsi.toFixed(1) : null,
      targetLow,
      targetHigh,
      scarcityScore: +(scarce * 100).toFixed(0),
      rarityScore: +(rarityW * 100).toFixed(0),
      bullish: bullish.slice(0, 4),
      bearish: bearish.slice(0, 3),
      priceHistory: card.priceHistory.map(h => ({
        price: Number(h.price),
        date: h.recordedAt,
      })).reverse(),
    },
  })
}
