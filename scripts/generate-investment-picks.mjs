#!/usr/bin/env node
/**
 * Generate AI-powered investment picks for PokeScard premium.
 * Runs monthly (or manually) to produce:
 *   - 1 "Carte du mois" (monthly_featured)
 *   - 5 hype récente (recent_hype) — SV/SWSH SIR/Hyper Rare
 *   - 5 momentum picks (momentum)
 *   - 5 undervalued gems (undervalued)
 *   - 5 long-term holds (long_term)
 *
 * Usage: node scripts/generate-investment-picks.mjs [--period=2026-05] [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const periodArg = args.find(a => a.startsWith('--period='))
const PERIOD = periodArg
  ? periodArg.split('=')[1]
  : new Date().toISOString().slice(0, 7) // "2026-05"

// ─── Character tier scoring ────────────────────────────────────────────────
const CHARACTER_TIERS = {
  S: ['charizard', 'pikachu', 'mewtwo', 'lugia', 'rayquaza', 'mew', 'umbreon', 'eevee', 'gengar'],
  A: ['blastoise', 'venusaur', 'snorlax', 'espeon', 'gyarados', 'dragonite', 'articuno', 'zapdos', 'moltres', 'ho-oh', 'celebi'],
  B: ['bulbasaur', 'charmander', 'squirtle', 'raichu', 'vaporeon', 'jolteon', 'flareon', 'togekiss', 'sylveon', 'garchomp', 'lucario', 'zoroark', 'tyranitar'],
}

function characterScore(name) {
  const lower = name.toLowerCase()
  if (CHARACTER_TIERS.S.some(c => lower.includes(c))) return 1.0
  if (CHARACTER_TIERS.A.some(c => lower.includes(c))) return 0.75
  if (CHARACTER_TIERS.B.some(c => lower.includes(c))) return 0.5
  return 0.25
}

// ─── Rarity tier scoring ──────────────────────────────────────────────────
const RARITY_SCORES = {
  SPECIAL_ILLUSTRATION_RARE: 1.0,
  HYPER_RARE: 1.0,
  CROWN_RARE: 1.0,
  ILLUSTRATION_RARE: 0.85,
  RARE_RAINBOW: 0.85,
  RARE_SECRET: 0.85,
  RARE_ULTRA: 0.70,
  RARE_HOLO_VMAX: 0.65,
  RARE_HOLO_VSTAR: 0.65,
  RARE_HOLO_EX: 0.60,
  RARE_HOLO_GX: 0.55,
  RARE_HOLO_V: 0.55,
  AMAZING_RARE: 0.50,
  RARE_SHINY_GX: 0.50,
  RARE_SHINY: 0.45,
  RARE_PRISM: 0.45,
  RARE_HOLO: 0.40,
  TRAINER_GALLERY_HOLO_VMAX: 0.60,
  TRAINER_GALLERY_HOLO_V: 0.50,
  TRAINER_GALLERY_HOLO: 0.40,
  LEGEND: 0.60,
  PROMO: 0.30,
  RARE: 0.25,
  UNCOMMON: 0.10,
  COMMON: 0.05,
  UNKNOWN: 0.05,
}

function rarityScore(rarity) {
  return RARITY_SCORES[rarity] ?? 0.05
}

// ─── Recency helpers ──────────────────────────────────────────────────────
function isRecentSet(card) {
  const id = card.set?.externalId ?? ''
  return id.startsWith('sv') || id.startsWith('swsh')
}

// ─── Main scoring ─────────────────────────────────────────────────────────
function scoreCard(card) {
  const md = card.marketData
  const price = Number(card.prices?.[0]?.market ?? 0)

  if (!price || price < 0.5) return null

  const recent = isRecentSet(card)
  const ath = md?.allTimeHigh ? Number(md.allTimeHigh) : price
  const atl = md?.allTimeLow ? Number(md.allTimeLow) : price
  const change7d = md?.priceChange7d ? Number(md.priceChange7d) : 0
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const vol30d = md?.volatility30d ? Number(md.volatility30d) : 0

  const momentumRaw = (change30d * 0.6 + change7d * 0.4) / 100
  const momentumScore = Math.max(0, Math.min(1, 0.5 + momentumRaw * 2))

  const athRatio = ath > 0 ? price / ath : 1
  // Recent cards get a baseline recovery score: they haven't had time to build ATH history
  const baseRecovery = recent ? 0.25 : 0
  const recoveryScore = Math.max(baseRecovery, 1 - athRatio)

  const stabilityScore = Math.max(0, 1 - Math.min(vol30d, 50) / 50)
  const rarityWeight = rarityScore(card.rarity)
  const charWeight = characterScore(card.name)

  // Boost rarity weight for recent high-rarity cards (SIR/Hyper Rare = the premium SV market)
  const rarityMult = recent && rarityWeight >= 0.7 ? 1.3 : 1.0

  const valueMod = price >= 10 ? 1.0 : price >= 5 ? 0.85 : price >= 2 ? 0.7 : 0.4

  const score =
    momentumScore * 0.24 +
    recoveryScore * 0.18 +
    (rarityWeight * rarityMult) * 0.22 +
    charWeight * 0.18 +
    stabilityScore * 0.13 +
    (recent ? 0.05 : 0) // recency bonus

  return {
    score: Math.round(Math.min(score, 1) * valueMod * 100),
    signals: {
      price, ath, atl,
      change7d: +change7d.toFixed(2),
      change30d: +change30d.toFixed(2),
      volatility30d: +vol30d.toFixed(2),
      momentumScore: +(momentumScore * 100).toFixed(1),
      recoveryScore: +(recoveryScore * 100).toFixed(1),
      rarityWeight: +(rarityWeight * 100).toFixed(1),
      charWeight: +(charWeight * 100).toFixed(1),
      athDropPct: athRatio < 1 ? +(((1 - athRatio) * 100)).toFixed(1) : 0,
      isRecent: recent,
    },
  }
}

// ─── Pick categorization ──────────────────────────────────────────────────
function categorizePick(card, signals) {
  const { change7d, change30d, athDropPct, volatility30d } = signals

  // Momentum: both 7d and 30d positive + not too volatile
  if (change7d > 3 && change30d > 5 && volatility30d < 40) {
    return 'momentum'
  }
  // Undervalued: down >30% from ATH but high rarity
  if (athDropPct > 30 && rarityScore(card.rarity) >= 0.5) {
    return 'undervalued'
  }
  // Long term: high rarity/character, stable
  if (rarityScore(card.rarity) >= 0.65 || characterScore(card.name) >= 0.75) {
    return 'long_term'
  }
  return 'momentum'
}

function riskLevel(signals) {
  const { volatility30d, change30d } = signals
  if (volatility30d > 35 || Math.abs(change30d) > 30) return 'élevé'
  if (volatility30d > 20 || Math.abs(change30d) > 15) return 'modéré'
  return 'faible'
}

function investmentHorizon(pickType) {
  if (pickType === 'momentum') return '1-3 mois'
  if (pickType === 'recent_hype') return '2-6 mois'
  if (pickType === 'undervalued') return '3-9 mois'
  if (pickType === 'long_term') return '6-18 mois'
  return '3-6 mois'
}

function priceTargets(price, ath, pickType) {
  if (pickType === 'momentum') {
    return { targetLow: +(price * 1.15).toFixed(2), targetHigh: +(price * 1.40).toFixed(2) }
  }
  if (pickType === 'undervalued') {
    const mid = (price + ath) / 2
    return { targetLow: +(mid * 0.8).toFixed(2), targetHigh: +(ath * 0.85).toFixed(2) }
  }
  if (pickType === 'recent_hype') {
    return { targetLow: +(price * 1.20).toFixed(2), targetHigh: +(price * 1.70).toFixed(2) }
  }
  return { targetLow: +(price * 1.30).toFixed(2), targetHigh: +(price * 2.00).toFixed(2) }
}

// ─── Template narrative generation (no API cost) ─────────────────────────
const RARITY_LABELS = {
  SPECIAL_ILLUSTRATION_RARE: 'Illustration Spéciale Rare',
  HYPER_RARE: 'Hyper Rare',
  CROWN_RARE: 'Crown Rare',
  ILLUSTRATION_RARE: 'Illustration Rare',
  RARE_RAINBOW: 'Rainbow Rare',
  RARE_SECRET: 'Secret Rare',
  RARE_ULTRA: 'Ultra Rare',
  RARE_HOLO_VMAX: 'VMAX',
  RARE_HOLO_VSTAR: 'VSTAR',
  RARE_HOLO_EX: 'ex Holo',
  RARE_HOLO_GX: 'GX Holo',
  RARE_HOLO_V: 'V Holo',
  RARE_HOLO: 'Holo Rare',
  AMAZING_RARE: 'Amazing Rare',
  RARE_SHINY_GX: 'Shiny GX',
  RARE_SHINY: 'Shiny Rare',
  RARE_PRISM: 'Prism Star',
  LEGEND: 'LEGEND',
  PROMO: 'Promo',
  RARE: 'Rare',
}

const MOMENTUM_NARRATIVES = [
  (name, set, price, change7d, ath) =>
    `${name} affiche une dynamique remarquable avec une progression de ${change7d.toFixed(1)}% sur les 7 derniers jours, signalant un regain d'intérêt marqué des collectionneurs. Issu de l'extension ${set}, ce spécimen bénéficie d'une liquidité élevée sur Cardmarket, ce qui facilite les transactions. Avec un All-Time High à ${ath.toFixed(2)}€, le potentiel de revalorisation reste intact. Le momentum actuel suggère une fenêtre d'entrée favorable avant une prochaine résistance.`,
  (name, set, price, change7d, ath) =>
    `La carte ${name} de l'extension ${set} enregistre une accélération haussière de ${change7d.toFixed(1)}% cette semaine, portée par une demande croissante sur le marché secondaire. À ${price.toFixed(2)}€, elle se positionne encore bien en dessous de son sommet historique de ${ath.toFixed(2)}€, offrant un rapport risque/rendement attractif. Les volumes d'échanges en hausse confirment l'intérêt des investisseurs pour ce profil de carte. Une consolidation au-dessus du prix actuel renforcerait le signal d'entrée.`,
]

const UNDERVALUED_NARRATIVES = [
  (name, set, price, athDropPct, ath) =>
    `${name} de l'extension ${set} se négocie actuellement ${athDropPct.toFixed(0)}% sous son All-Time High de ${ath.toFixed(2)}€ — une décote qui ne reflète pas ses fondamentaux. Sa rareté et la popularité persistante du Pokémon en font un candidat naturel à la revalorisation dans un marché en normalisation. Les collectionneurs avisés reconnaissent dans cette correction une opportunité d'acquisition à prix réduit. La résistance historique à ${ath.toFixed(2)}€ constitue un objectif réaliste à moyen terme.`,
  (name, set, price, athDropPct, ath) =>
    `Avec une décote de ${athDropPct.toFixed(0)}% par rapport à son sommet historique, ${name} de l'extension ${set} représente l'une des meilleures opportunités de valeur du marché Pokémon TCG en ce moment. À ${price.toFixed(2)}€, le downside est limité par la rareté intrinsèque de la carte et la demande structurelle des collectionneurs. Un retour vers les ${ath.toFixed(2)}€ impliquerait un gain substantiel. C'est le type de setup que recherchent les investisseurs patients.`,
]

const LONGTERM_NARRATIVES = [
  (name, set, price) =>
    `${name} de l'extension ${set} présente un profil d'investissement long terme solide, combinant rareté élevée, popularité du Pokémon et offre limitée sur le marché secondaire. À ${price.toFixed(2)}€, la valorisation actuelle reste conservatrice au regard de l'engouement croissant pour le TCG Pokémon vintage et moderne. L'extension d'origine garantit une authenticité prisée des collectionneurs sérieux. Sur un horizon de 6 à 18 mois, les catalyseurs potentiels (anniversaires, tournois, médias) pourraient accélérer la revalorisation.`,
  (name, set, price) =>
    `La carte ${name} issue de ${set} s'impose comme un actif de fond de portefeuille incontournable pour tout investisseur Pokémon TCG. Sa rareté, combinée à la liquidité du marché Cardmarket, offre une flexibilité de sortie que peu de cartes peuvent garantir. À ${price.toFixed(2)}€, elle reste accessible tout en offrant une exposition à un segment premium du marché. Les tendances de long terme du collectible Pokémon plaident pour une appréciation soutenue sur 12 à 18 mois.`,
]

const FEATURED_NARRATIVES = [
  (name, set, price, score, ath) =>
    `${name} de l'extension ${set} est notre sélection premium pour ce mois — avec un score de ${score}/100, c'est la carte qui cumule le plus de signaux positifs sur l'ensemble du marché Pokémon TCG. Sa rareté exceptionnelle, la popularité mondiale du Pokémon et son positionnement par rapport à son ATH de ${ath.toFixed(2)}€ en font un investissement de premier ordre. La demande structurelle des collectionneurs garantit une liquidité saine, limitant le risque de blocage à la revente. Nous estimons un potentiel de revalorisation significatif sur les 3 à 6 prochains mois.`,
  (name, set, price, score, ath) =>
    `Notre algorithme d'analyse — croisant momentum, rareté, popularité et distance à l'ATH — désigne ${name} de l'extension ${set} comme la meilleure opportunité d'investissement Pokémon TCG de ce mois (score ${score}/100). À ${price.toFixed(2)}€, la carte offre un point d'entrée rationnel sur un actif dont l'ATH à ${ath.toFixed(2)}€ témoigne d'un fort potentiel de valorisation. La rareté de l'édition et la notoriété du Pokémon constituent des remparts solides contre la dépréciation. Un investissement à considérer sérieusement pour tout portefeuille orienté Pokémon.`,
]

const RECENT_HYPE_NARRATIVES = [
  (name, set, price) =>
    `${name} de l'extension ${set} s'impose comme l'une des cartes les plus recherchées du marché actuel. Sa rareté élevée combinée à une offre encore limitée sur Cardmarket crée un déséquilibre favorable aux acheteurs patients. À ${price.toFixed(2)}€, cette carte récente conserve un fort potentiel d'appréciation à mesure que le marché secondaire se développe. Les collectionneurs qui s'y positionnent maintenant pourraient bénéficier d'une prime de rareté croissante sur les prochains mois.`,
  (name, set, price) =>
    `Sortie récemment dans l'extension ${set}, ${name} représente une opportunité rare sur le marché Pokémon TCG actuel. Sa rareté parmi les plus élevées de la série Écarlate & Violet garantit une production limitée et une demande structurellement forte. À ${price.toFixed(2)}€, le point d'entrée reste attractif avant que la carte ne gagne en notoriété sur le marché secondaire international. Un pick idéal pour les investisseurs qui misent sur le potentiel des nouvelles extensions.`,
]

const BULLISH_POOL = {
  high_rarity: 'Rareté élevée — offre limitée sur le marché',
  popular_char: 'Pokémon iconique à forte demande mondiale',
  below_ath: 'Prix bien en dessous de son All-Time High',
  momentum: 'Momentum haussier confirmé sur 7 jours',
  old_set: 'Extension ancienne — cartes de plus en plus rares',
  new_extension: 'Extension récente — marché secondaire en construction',
  sir_rarity: 'Illustration Spéciale — tirage le plus rare de la série',
  liquid: 'Bonne liquidité sur Cardmarket EU',
  stable: 'Faible volatilité — mouvement de prix ordonné',
  tcg_growth: 'Marché TCG Pokémon en croissance structurelle',
}

const BEARISH_POOL = {
  volatility: 'Volatilité du marché Pokémon imprévisible',
  trend: 'Dépendance à la tendance générale du TCG',
  reprint_risk: 'Risque de réimpression par The Pokémon Company',
  low_price: 'Prix bas peut refléter un manque d\'intérêt',
  spread: 'Spread achat/vente parfois élevé sur Cardmarket',
  condition: 'Condition de la carte critique pour la valeur',
}

function selectBullish(card, signals, pickType) {
  const tags = []
  if (rarityScore(card.rarity) >= 0.6) tags.push(BULLISH_POOL.high_rarity)
  if (characterScore(card.name) >= 0.75) tags.push(BULLISH_POOL.popular_char)
  if (signals.athDropPct > 15) tags.push(BULLISH_POOL.below_ath)
  if (signals.change7d > 2) tags.push(BULLISH_POOL.momentum)
  if (signals.isRecent) {
    tags.push(BULLISH_POOL.new_extension)
    if (['SPECIAL_ILLUSTRATION_RARE','HYPER_RARE','CROWN_RARE'].includes(card.rarity)) tags.push(BULLISH_POOL.sir_rarity)
  }
  const setName = card.set?.name ?? ''
  if (['Base', 'Jungle', 'Fossil', 'Rocket'].some(s => setName.includes(s))) tags.push(BULLISH_POOL.old_set)
  if (signals.volatility30d < 15) tags.push(BULLISH_POOL.stable)
  tags.push(BULLISH_POOL.tcg_growth, BULLISH_POOL.liquid)
  return [...new Set(tags)].slice(0, 3)
}

function selectBearish(card, signals) {
  const tags = []
  if (signals.volatility30d > 20) tags.push(BEARISH_POOL.volatility)
  tags.push(BEARISH_POOL.trend)
  if (card.rarity === 'PROMO' || card.rarity === 'RARE') tags.push(BEARISH_POOL.reprint_risk)
  tags.push(BEARISH_POOL.spread)
  return [...new Set(tags)].slice(0, 2)
}

function pickRandom(arr, seed) {
  return arr[seed % arr.length]
}

function generateNarrative(card, signals, pickType, period) {
  const { price, ath, change7d, athDropPct } = signals
  const set = card.set?.name ?? 'Extension inconnue'
  const seed = card.id.charCodeAt(0) + card.id.charCodeAt(1)

  let narrative
  if (pickType === 'monthly_featured') {
    const tmpl = pickRandom(FEATURED_NARRATIVES, seed)
    narrative = tmpl(card.name, set, price, Math.round(signals.momentumScore + signals.rarityWeight), ath)
  } else if (pickType === 'momentum') {
    const tmpl = pickRandom(MOMENTUM_NARRATIVES, seed)
    narrative = tmpl(card.name, set, price, change7d, ath)
  } else if (pickType === 'undervalued') {
    const tmpl = pickRandom(UNDERVALUED_NARRATIVES, seed)
    narrative = tmpl(card.name, set, price, athDropPct, ath)
  } else if (pickType === 'recent_hype') {
    const tmpl = pickRandom(RECENT_HYPE_NARRATIVES, seed)
    narrative = tmpl(card.name, set, price)
  } else {
    const tmpl = pickRandom(LONGTERM_NARRATIVES, seed)
    narrative = tmpl(card.name, set, price)
  }

  return {
    narrative,
    bullish: selectBullish(card, signals, pickType),
    bearish: selectBearish(card, signals),
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎯 Generating investment picks for period: ${PERIOD}`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  const cardInclude = {
    set: { select: { name: true, series: true, externalId: true, releaseDate: true } },
    prices: { where: { source: 'cardmarket' }, select: { market: true, mid: true } },
    marketData: true,
  }
  const cardWhere = {
    prices: { some: { source: 'cardmarket', market: { not: null, gt: 0.5 } } },
    marketData: { isNot: null },
    imageSmUrl: { not: null },
  }

  // Fetch in two passes: recent high-rarity cards + general pool
  const [recentCards, generalCards] = await Promise.all([
    // Recent SV/SWSH cards with top rarity — all of them (few hundred)
    prisma.card.findMany({
      where: {
        ...cardWhere,
        set: { externalId: { in: await prisma.pokemonSet.findMany({ where: { OR: [{ externalId: { startsWith: 'sv' } }, { externalId: { startsWith: 'swsh' } }] }, select: { externalId: true } }).then(sets => sets.map(s => s.externalId)) } },
        rarity: { in: ['SPECIAL_ILLUSTRATION_RARE','HYPER_RARE','CROWN_RARE','ILLUSTRATION_RARE','RARE_RAINBOW','RARE_SECRET','RARE_ULTRA','RARE_HOLO_VMAX','RARE_HOLO_VSTAR'] },
      },
      include: cardInclude,
    }),
    // General pool (vintage + any remaining)
    prisma.card.findMany({
      where: cardWhere,
      include: cardInclude,
      take: 5000,
    }),
  ])

  // Merge, deduplicate by id
  const seenIds = new Set()
  const cards = [...recentCards, ...generalCards].filter(c => {
    if (seenIds.has(c.id)) return false
    seenIds.add(c.id)
    return true
  })

  console.log(`📊 Loaded ${cards.length} cards with price + market data`)

  // Score all cards
  const scored = cards
    .map(card => {
      const result = scoreCard(card)
      if (!result) return null
      return { card, ...result }
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score)

  console.log(`✅ Scored ${scored.length} cards\n`)
  console.log('Top 10 scores:')
  scored.slice(0, 10).forEach((c, i) => {
    console.log(`  ${i + 1}. ${c.card.name} (${c.card.set?.name}) — score: ${c.score} — €${c.signals.price}`)
  })

  // Categorize into pick buckets (separate passes per category for best results)
  const picks = {
    monthly_featured: [],
    recent_hype: [],
    momentum: [],
    undervalued: [],
    long_term: [],
  }

  const usedCardIds = new Set()

  // 1. Featured = #1 overall scorer
  if (scored.length > 0) {
    picks.monthly_featured.push(scored[0])
    usedCardIds.add(scored[0].card.id)
  }

  // 2. Recent hype: SV/SWSH SIR, Hyper Rare, Illustration Rare — price >= €5
  for (const item of scored) {
    if (usedCardIds.has(item.card.id)) continue
    const exId = item.card.set?.externalId ?? ''
    const isRecent = exId.startsWith('sv') || exId.startsWith('swsh')
    const topRarity = rarityScore(item.card.rarity) >= 0.7
    if (isRecent && topRarity && item.signals.price >= 5) {
      picks.recent_hype.push(item)
      usedCardIds.add(item.card.id)
      if (picks.recent_hype.length >= 5) break
    }
  }

  // 3. Momentum: strong positive 7d change
  for (const item of scored) {
    if (usedCardIds.has(item.card.id)) continue
    const { change7d, volatility30d } = item.signals
    if (change7d > 1.5 && volatility30d < 60) {
      picks.momentum.push(item)
      usedCardIds.add(item.card.id)
      if (picks.momentum.length >= 5) break
    }
  }
  if (picks.momentum.length === 0) {
    for (const item of scored) {
      if (usedCardIds.has(item.card.id)) continue
      if (item.signals.change7d >= 0) {
        picks.momentum.push(item)
        usedCardIds.add(item.card.id)
        if (picks.momentum.length >= 5) break
      }
    }
  }

  // 4. Undervalued: below ATH by >= 20%, decent rarity
  for (const item of scored) {
    if (usedCardIds.has(item.card.id)) continue
    const { athDropPct } = item.signals
    if (athDropPct >= 20 && rarityScore(item.card.rarity) >= 0.35) {
      picks.undervalued.push(item)
      usedCardIds.add(item.card.id)
      if (picks.undervalued.length >= 5) break
    }
  }

  // 5. Long term: fill remaining top scorers not yet picked
  for (const item of scored) {
    if (usedCardIds.has(item.card.id)) continue
    picks.long_term.push(item)
    usedCardIds.add(item.card.id)
    if (picks.long_term.length >= 5) break
  }

  console.log('\n📋 Pick distribution:')
  Object.entries(picks).forEach(([type, items]) => {
    console.log(`  ${type}: ${items.length} picks`)
  })

  if (DRY_RUN) {
    console.log('\n[DRY RUN] Skipping DB writes and AI generation.')
    await prisma.$disconnect()
    return
  }

  // Generate AI narratives and save
  let saved = 0
  for (const [pickType, items] of Object.entries(picks)) {
    for (let i = 0; i < items.length; i++) {
      const { card, score, signals } = items[i]
      const rank = i + 1

      console.log(`\n📝 Generating narrative: ${card.name} [${pickType} #${rank}]`)

      const aiResult = generateNarrative(card, signals, pickType, PERIOD)

      const { targetLow, targetHigh } = priceTargets(signals.price, signals.ath, pickType)

      const data = {
        period: PERIOD,
        pickType,
        rank,
        score,
        signals,
        narrative: aiResult.narrative,
        bullish: aiResult.bullish,
        bearish: aiResult.bearish,
        priceAtPick: signals.price,
        targetLow,
        targetHigh,
        horizon: investmentHorizon(pickType),
        riskLevel: riskLevel(signals),
      }

      await prisma.investmentPick.upsert({
        where: { cardId_period_pickType: { cardId: card.id, period: PERIOD, pickType } },
        create: { cardId: card.id, ...data },
        update: data,
      })

      saved++
      console.log(`   ✅ Saved — score: ${score} — target: ${targetLow}€–${targetHigh}€`)
    }
  }

  console.log(`\n🎉 Done! Saved ${saved} investment picks for ${PERIOD}`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
