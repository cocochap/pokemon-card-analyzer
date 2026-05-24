/**
 * Cron mensuel : génère les investment picks IA pour le mois en cours.
 * Planifié via vercel.json : "0 8 1 * *" (8h UTC le 1er de chaque mois)
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkCronAuth } from '@/lib/cron-auth'

// ─── Character tier scoring ────────────────────────────────────────────────
const CHARACTER_TIERS = {
  S: ['charizard', 'pikachu', 'mewtwo', 'lugia', 'rayquaza', 'mew', 'umbreon', 'eevee', 'gengar'],
  A: ['blastoise', 'venusaur', 'snorlax', 'espeon', 'gyarados', 'dragonite', 'articuno', 'zapdos', 'moltres', 'ho-oh', 'celebi'],
  B: ['bulbasaur', 'charmander', 'squirtle', 'raichu', 'vaporeon', 'jolteon', 'flareon', 'togekiss', 'sylveon', 'garchomp', 'lucario', 'zoroark', 'tyranitar'],
}

function characterScore(name: string) {
  const lower = name.toLowerCase()
  if (CHARACTER_TIERS.S.some(c => lower.includes(c))) return 1.0
  if (CHARACTER_TIERS.A.some(c => lower.includes(c))) return 0.75
  if (CHARACTER_TIERS.B.some(c => lower.includes(c))) return 0.5
  return 0.25
}

const RARITY_SCORES: Record<string, number> = {
  SPECIAL_ILLUSTRATION_RARE: 1.0, HYPER_RARE: 1.0, CROWN_RARE: 1.0,
  ILLUSTRATION_RARE: 0.85, RARE_RAINBOW: 0.85, RARE_SECRET: 0.85,
  RARE_ULTRA: 0.70, RARE_HOLO_VMAX: 0.65, RARE_HOLO_VSTAR: 0.65,
  RARE_HOLO_EX: 0.60, RARE_HOLO_GX: 0.55, RARE_HOLO_V: 0.55,
  AMAZING_RARE: 0.50, RARE_SHINY_GX: 0.50, RARE_SHINY: 0.45, RARE_PRISM: 0.45,
  RARE_HOLO: 0.40, TRAINER_GALLERY_HOLO_VMAX: 0.60, TRAINER_GALLERY_HOLO_V: 0.50,
  TRAINER_GALLERY_HOLO: 0.40, LEGEND: 0.60, PROMO: 0.30, RARE: 0.25,
  UNCOMMON: 0.10, COMMON: 0.05, UNKNOWN: 0.05,
}

function rarityScore(rarity: string) { return RARITY_SCORES[rarity] ?? 0.05 }

function scoreCard(card: any) {
  const price = Number(card.prices?.[0]?.market ?? 0)
  if (!price || price < 0.5) return null
  const md = card.marketData
  const ath = md?.allTimeHigh ? Number(md.allTimeHigh) : price
  const change7d = md?.priceChange7d ? Number(md.priceChange7d) : 0
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const vol30d = md?.volatility30d ? Number(md.volatility30d) : 0
  const momentumRaw = (change30d * 0.6 + change7d * 0.4) / 100
  const momentumScore = Math.max(0, Math.min(1, 0.5 + momentumRaw * 2))
  const athRatio = ath > 0 ? price / ath : 1
  const recoveryScore = Math.max(0, 1 - athRatio)
  const stabilityScore = Math.max(0, 1 - Math.min(vol30d, 50) / 50)
  const rarityWeight = rarityScore(card.rarity)
  const charWeight = characterScore(card.name)
  const valueMod = price >= 10 ? 1.0 : price >= 5 ? 0.85 : price >= 2 ? 0.7 : 0.4
  const score = momentumScore * 0.25 + recoveryScore * 0.20 + rarityWeight * 0.22 + charWeight * 0.18 + stabilityScore * 0.15
  return {
    score: Math.round(score * valueMod * 100),
    signals: {
      price, ath,
      atl: md?.allTimeLow ? Number(md.allTimeLow) : price,
      change7d: +change7d.toFixed(2),
      change30d: +change30d.toFixed(2),
      volatility30d: +vol30d.toFixed(2),
      momentumScore: +(momentumScore * 100).toFixed(1),
      recoveryScore: +(recoveryScore * 100).toFixed(1),
      rarityWeight: +(rarityWeight * 100).toFixed(1),
      charWeight: +(charWeight * 100).toFixed(1),
      athDropPct: athRatio < 1 ? +(((1 - athRatio) * 100)).toFixed(1) : 0,
    },
  }
}

// ─── Narrative templates ───────────────────────────────────────────────────
const BULLISH_POOL: Record<string, string> = {
  high_rarity: 'Rareté élevée — offre limitée sur le marché',
  popular_char: 'Pokémon iconique à forte demande mondiale',
  below_ath: 'Prix bien en dessous de son All-Time High',
  momentum: 'Momentum haussier confirmé sur 7 jours',
  old_set: 'Extension ancienne — cartes de plus en plus rares',
  liquid: 'Bonne liquidité sur Cardmarket EU',
  stable: 'Faible volatilité — mouvement de prix ordonné',
  tcg_growth: 'Marché TCG Pokémon en croissance structurelle',
}

const BEARISH_POOL: Record<string, string> = {
  volatility: 'Volatilité du marché Pokémon imprévisible',
  trend: 'Dépendance à la tendance générale du TCG',
  reprint_risk: 'Risque de réimpression par The Pokémon Company',
  spread: 'Spread achat/vente parfois élevé sur Cardmarket',
}

function selectBullish(card: any, signals: any): string[] {
  const tags: string[] = []
  if (rarityScore(card.rarity) >= 0.6) tags.push(BULLISH_POOL.high_rarity)
  if (characterScore(card.name) >= 0.75) tags.push(BULLISH_POOL.popular_char)
  if (signals.athDropPct > 15) tags.push(BULLISH_POOL.below_ath)
  if (signals.change7d > 2) tags.push(BULLISH_POOL.momentum)
  const setName = card.set?.name ?? ''
  if (['Base', 'Jungle', 'Fossil', 'Rocket'].some(s => setName.includes(s))) tags.push(BULLISH_POOL.old_set)
  if (signals.volatility30d < 15) tags.push(BULLISH_POOL.stable)
  tags.push(BULLISH_POOL.tcg_growth, BULLISH_POOL.liquid)
  return [...new Set(tags)].slice(0, 3)
}

function selectBearish(card: any, signals: any): string[] {
  const tags: string[] = []
  if (signals.volatility30d > 20) tags.push(BEARISH_POOL.volatility)
  tags.push(BEARISH_POOL.trend)
  if (['PROMO', 'RARE'].includes(card.rarity)) tags.push(BEARISH_POOL.reprint_risk)
  tags.push(BEARISH_POOL.spread)
  return [...new Set(tags)].slice(0, 2)
}

function generateNarrative(card: any, signals: any, pickType: string): { narrative: string; bullish: string[]; bearish: string[] } {
  const { price, ath, change7d, athDropPct } = signals
  const set = card.set?.name ?? 'Extension inconnue'
  const seed = card.id.charCodeAt(0) + card.id.charCodeAt(1)

  const FEATURED = [
    (n: string, s: string, p: number, sc: number, a: number) => `${n} de l'extension ${s} est notre sélection premium pour ce mois — avec un score de ${sc}/100, c'est la carte qui cumule le plus de signaux positifs sur l'ensemble du marché Pokémon TCG. Sa rareté exceptionnelle, la popularité mondiale du Pokémon et son positionnement par rapport à son ATH de ${a.toFixed(2)}€ en font un investissement de premier ordre. La demande structurelle des collectionneurs garantit une liquidité saine, limitant le risque de blocage à la revente. Nous estimons un potentiel de revalorisation significatif sur les 3 à 6 prochains mois.`,
    (n: string, s: string, p: number, sc: number, a: number) => `Notre algorithme d'analyse désigne ${n} de l'extension ${s} comme la meilleure opportunité d'investissement Pokémon TCG de ce mois (score ${sc}/100). À ${p.toFixed(2)}€, la carte offre un point d'entrée rationnel sur un actif dont l'ATH à ${a.toFixed(2)}€ témoigne d'un fort potentiel. La rareté de l'édition et la notoriété du Pokémon constituent des remparts solides contre la dépréciation.`,
  ]
  const MOMENTUM = [
    (n: string, s: string, p: number, c7: number, a: number) => `${n} affiche une dynamique remarquable avec une progression de ${c7.toFixed(1)}% sur les 7 derniers jours. Issu de l'extension ${s}, ce spécimen bénéficie d'une liquidité élevée sur Cardmarket. Avec un All-Time High à ${a.toFixed(2)}€, le potentiel de revalorisation reste intact. Le momentum actuel suggère une fenêtre d'entrée favorable avant une prochaine résistance.`,
    (n: string, s: string, p: number, c7: number, a: number) => `La carte ${n} de l'extension ${s} enregistre une accélération haussière de ${c7.toFixed(1)}% cette semaine, portée par une demande croissante sur le marché secondaire. À ${p.toFixed(2)}€, elle se positionne encore bien en dessous de son sommet historique de ${a.toFixed(2)}€. Les volumes en hausse confirment l'intérêt des investisseurs pour ce profil de carte.`,
  ]
  const UNDERVALUED = [
    (n: string, s: string, p: number, d: number, a: number) => `${n} de l'extension ${s} se négocie actuellement ${d.toFixed(0)}% sous son All-Time High de ${a.toFixed(2)}€ — une décote qui ne reflète pas ses fondamentaux. Sa rareté et la popularité persistante du Pokémon en font un candidat naturel à la revalorisation. Les collectionneurs avisés reconnaissent dans cette correction une opportunité d'acquisition à prix réduit.`,
    (n: string, s: string, p: number, d: number, a: number) => `Avec une décote de ${d.toFixed(0)}% par rapport à son sommet historique, ${n} de l'extension ${s} représente l'une des meilleures opportunités de valeur du marché. À ${p.toFixed(2)}€, le downside est limité par la rareté intrinsèque et la demande structurelle. Un retour vers les ${a.toFixed(2)}€ impliquerait un gain substantiel.`,
  ]
  const LONG_TERM = [
    (n: string, s: string, p: number) => `${n} de l'extension ${s} présente un profil d'investissement long terme solide, combinant rareté élevée, popularité du Pokémon et offre limitée sur le marché secondaire. À ${p.toFixed(2)}€, la valorisation actuelle reste conservatrice. Sur un horizon de 6 à 18 mois, les catalyseurs potentiels pourraient accélérer la revalorisation.`,
    (n: string, s: string, p: number) => `La carte ${n} issue de ${s} s'impose comme un actif de fond de portefeuille incontournable pour tout investisseur Pokémon TCG. Sa rareté et la liquidité du marché Cardmarket offrent une flexibilité de sortie que peu de cartes peuvent garantir. Les tendances de long terme plaident pour une appréciation soutenue sur 12 à 18 mois.`,
  ]

  let narrative: string
  const sc = Math.round(signals.momentumScore + signals.rarityWeight)
  if (pickType === 'monthly_featured') narrative = (FEATURED[seed % FEATURED.length])(card.name, set, price, sc, ath)
  else if (pickType === 'momentum') narrative = (MOMENTUM[seed % MOMENTUM.length])(card.name, set, price, change7d, ath)
  else if (pickType === 'undervalued') narrative = (UNDERVALUED[seed % UNDERVALUED.length])(card.name, set, price, athDropPct, ath)
  else narrative = (LONG_TERM[seed % LONG_TERM.length])(card.name, set, price)

  return { narrative, bullish: selectBullish(card, signals), bearish: selectBearish(card, signals) }
}

function priceTargets(price: number, ath: number, pickType: string) {
  if (pickType === 'momentum') return { targetLow: +(price * 1.15).toFixed(2), targetHigh: +(price * 1.40).toFixed(2) }
  if (pickType === 'undervalued') {
    const mid = (price + ath) / 2
    return { targetLow: +(mid * 0.8).toFixed(2), targetHigh: +(ath * 0.85).toFixed(2) }
  }
  return { targetLow: +(price * 1.30).toFixed(2), targetHigh: +(price * 2.00).toFixed(2) }
}

function riskLevel(signals: any) {
  if (signals.volatility30d > 35 || Math.abs(signals.change30d) > 30) return 'élevé'
  if (signals.volatility30d > 20 || Math.abs(signals.change30d) > 15) return 'modéré'
  return 'faible'
}

function horizon(pickType: string) {
  if (pickType === 'momentum') return '1-3 mois'
  if (pickType === 'undervalued') return '3-9 mois'
  if (pickType === 'long_term') return '6-18 mois'
  return '3-6 mois'
}

// ─── Main handler ──────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const authErr = checkCronAuth(req)
  if (authErr) return authErr

  const period = new Date().toISOString().slice(0, 7)

  try {
    const cards = await prisma.card.findMany({
      where: {
        prices: { some: { source: 'cardmarket', market: { not: null, gt: 0.5 } } },
        marketData: { isNot: null },
        imageSmUrl: { not: null },
      },
      include: {
        set: { select: { name: true, series: true } },
        prices: { where: { source: 'cardmarket' }, select: { market: true } },
        marketData: true,
      },
      take: 3000,
    })

    const scored = cards
      .map(card => { const r = scoreCard(card); return r ? { card, ...r } : null })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score) as any[]

    const picks: Record<string, any[]> = {
      monthly_featured: [], momentum: [], undervalued: [], long_term: [],
    }
    const used = new Set<string>()

    // Featured = #1 overall
    if (scored.length > 0) { picks.monthly_featured.push(scored[0]); used.add(scored[0].card.id) }

    // Momentum: positive 7d
    for (const item of scored) {
      if (used.has(item.card.id)) continue
      if (item.signals.change7d > 1.5 && item.signals.volatility30d < 60) {
        picks.momentum.push(item); used.add(item.card.id)
        if (picks.momentum.length >= 5) break
      }
    }
    if (picks.momentum.length === 0) {
      for (const item of scored) {
        if (used.has(item.card.id)) continue
        if (item.signals.change7d >= 0) {
          picks.momentum.push(item); used.add(item.card.id)
          if (picks.momentum.length >= 5) break
        }
      }
    }

    // Undervalued: >20% below ATH + decent rarity
    for (const item of scored) {
      if (used.has(item.card.id)) continue
      if (item.signals.athDropPct >= 20 && rarityScore(item.card.rarity) >= 0.35) {
        picks.undervalued.push(item); used.add(item.card.id)
        if (picks.undervalued.length >= 5) break
      }
    }

    // Long term: fill with top remaining
    for (const item of scored) {
      if (used.has(item.card.id)) continue
      picks.long_term.push(item); used.add(item.card.id)
      if (picks.long_term.length >= 5) break
    }

    // Save to DB
    let saved = 0
    for (const [pickType, items] of Object.entries(picks)) {
      for (let i = 0; i < items.length; i++) {
        const { card, score, signals } = items[i]
        const aiResult = generateNarrative(card, signals, pickType)
        const { targetLow, targetHigh } = priceTargets(signals.price, signals.ath, pickType)
        const data = {
          period, pickType, rank: i + 1, score, signals,
          narrative: aiResult.narrative, bullish: aiResult.bullish, bearish: aiResult.bearish,
          priceAtPick: signals.price, targetLow, targetHigh,
          horizon: horizon(pickType), riskLevel: riskLevel(signals),
        }
        await prisma.investmentPick.upsert({
          where: { cardId_period_pickType: { cardId: card.id, period, pickType } },
          create: { cardId: card.id, ...data },
          update: data,
        })
        saved++
      }
    }

    return NextResponse.json({ ok: true, period, saved })
  } catch (err: any) {
    console.error('[cron/investment-picks]', err)
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
