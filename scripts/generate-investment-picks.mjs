#!/usr/bin/env node
/**
 * Generate AI-powered investment picks for PokeScard premium.
 * Runs monthly (or manually) to produce:
 *   - 1 "Carte du mois" (monthly_featured)
 *   - 5 momentum picks (momentum)
 *   - 5 undervalued gems (undervalued)
 *   - 5 long-term holds (long_term)
 *
 * Usage: node scripts/generate-investment-picks.mjs [--period 2026-05] [--dry-run]
 */

import { PrismaClient } from '@prisma/client'
import Anthropic from '@anthropic-ai/sdk'

const prisma = new PrismaClient()
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

// ─── Main scoring ─────────────────────────────────────────────────────────
function scoreCard(card) {
  const md = card.marketData
  const price = Number(card.prices?.[0]?.market ?? 0)

  if (!price || price < 0.5) return null // skip unpriced or dirt cheap

  const ath = md?.allTimeHigh ? Number(md.allTimeHigh) : price
  const atl = md?.allTimeLow ? Number(md.allTimeLow) : price
  const change7d = md?.priceChange7d ? Number(md.priceChange7d) : 0
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const vol30d = md?.volatility30d ? Number(md.volatility30d) : 0

  // Momentum: positive momentum = good, but not too volatile
  const momentumRaw = (change30d * 0.6 + change7d * 0.4) / 100 // normalized
  const momentumScore = Math.max(0, Math.min(1, 0.5 + momentumRaw * 2))

  // Recovery: how far below ATH (room to grow back)
  const athRatio = ath > 0 ? price / ath : 1
  const recoveryScore = Math.max(0, 1 - athRatio) // 0 if at ATH, 1 if at 0

  // Stability: low volatility is better for long-term (cap at 50%)
  const stabilityScore = Math.max(0, 1 - Math.min(vol30d, 50) / 50)

  // Rarity weight
  const rarityWeight = rarityScore(card.rarity)

  // Character weight
  const charWeight = characterScore(card.name)

  // Value floor: minimum price to be interesting (>= €2 for picks)
  const valueMod = price >= 10 ? 1.0 : price >= 5 ? 0.85 : price >= 2 ? 0.7 : 0.4

  const score =
    momentumScore * 0.25 +
    recoveryScore * 0.20 +
    rarityWeight  * 0.22 +
    charWeight    * 0.18 +
    stabilityScore * 0.15

  const finalScore = Math.round(score * valueMod * 100)

  return {
    score: finalScore,
    signals: {
      price,
      ath,
      atl,
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

function investmentHorizon(pickType, signals) {
  if (pickType === 'momentum') return '1-3 mois'
  if (pickType === 'undervalued') return '3-9 mois'
  if (pickType === 'long_term') return '6-18 mois'
  return '3-6 mois'
}

function priceTargets(price, ath, pickType) {
  if (pickType === 'momentum') {
    return { targetLow: +(price * 1.15).toFixed(2), targetHigh: +(price * 1.40).toFixed(2) }
  }
  if (pickType === 'undervalued') {
    // Target recovery toward ATH
    const mid = (price + ath) / 2
    return { targetLow: +(mid * 0.8).toFixed(2), targetHigh: +(ath * 0.85).toFixed(2) }
  }
  // long_term / featured
  return { targetLow: +(price * 1.30).toFixed(2), targetHigh: +(price * 2.00).toFixed(2) }
}

// ─── Claude narrative generation ──────────────────────────────────────────
async function generateNarrative(card, signals, pickType, period) {
  const rarityLabel = card.rarity.replace(/_/g, ' ').toLowerCase()
  const setName = card.set?.name ?? 'Extension inconnue'
  const { price, ath, change7d, change30d, volatility30d, athDropPct } = signals

  const prompt = `Tu es un analyste expert en investissement de cartes Pokémon TCG, reconnu pour tes analyses précises et tes conseils d'investissement.
Génère une analyse d'investissement professionnelle et percutante en français pour la période ${period}.

Carte : ${card.name}
Extension : ${setName} (${card.set?.series ?? ''})
Rareté : ${rarityLabel}
Numéro : ${card.number}
Prix actuel (Cardmarket) : ${price}€
All-Time High : ${ath}€
Écart par rapport à l'ATH : -${athDropPct}%
Variation 7 jours : ${change7d > 0 ? '+' : ''}${change7d}%
Variation 30 jours : ${change30d > 0 ? '+' : ''}${change30d}%
Volatilité 30j : ${volatility30d}%
Catégorie du pick : ${pickType === 'momentum' ? 'Momentum' : pickType === 'undervalued' ? 'Sous-évalué' : pickType === 'long_term' ? 'Long terme' : 'Carte du mois'}

Génère une réponse JSON avec exactement ces champs :
{
  "narrative": "Analyse de 3-4 phrases percutantes et professionnelles qui explique pourquoi cette carte est un bon investissement en ce moment. Mentionne le contexte du marché, la rareté, et les catalyseurs potentiels.",
  "bullish": ["Signal haussier 1", "Signal haussier 2", "Signal haussier 3"],
  "bearish": ["Risque 1", "Risque 2"]
}

Les signaux doivent être concis (max 10 mots chacun), factuels et spécifiques à cette carte.
Réponds uniquement avec le JSON, sans markdown.`

  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = response.content[0].text.trim()
  try {
    return JSON.parse(text)
  } catch {
    // Fallback if JSON parsing fails
    return {
      narrative: `${card.name} présente un profil d'investissement intéressant sur le marché Pokémon TCG.`,
      bullish: ['Rareté élevée garantit la valeur', 'Forte demande des collectionneurs', 'Potentiel de revalorisation'],
      bearish: ['Volatilité du marché', 'Dépendance à la tendance Pokémon'],
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🎯 Generating investment picks for period: ${PERIOD}`)
  console.log(`   Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}\n`)

  // Fetch cards with all needed data
  const cards = await prisma.card.findMany({
    where: {
      prices: { some: { source: 'cardmarket', market: { not: null, gt: 0.5 } } },
      marketData: { isNot: null },
      imageSmUrl: { not: null },
    },
    include: {
      set: { select: { name: true, series: true, releaseDate: true } },
      prices: { where: { source: 'cardmarket' }, select: { market: true, mid: true } },
      marketData: true,
    },
    take: 3000,
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

  // 2. Momentum: strong positive 7d change
  for (const item of scored) {
    if (usedCardIds.has(item.card.id)) continue
    const { change7d, volatility30d } = item.signals
    if (change7d > 1.5 && volatility30d < 60) {
      picks.momentum.push(item)
      usedCardIds.add(item.card.id)
      if (picks.momentum.length >= 5) break
    }
  }

  // fallback: if still empty, take positively trending high-score cards
  if (picks.momentum.length === 0) {
    for (const item of scored) {
      if (usedCardIds.has(item.card.id)) continue
      const { change7d } = item.signals
      if (change7d >= 0) {
        picks.momentum.push(item)
        usedCardIds.add(item.card.id)
        if (picks.momentum.length >= 5) break
      }
    }
  }

  // 3. Undervalued: below ATH by >= 20%, decent rarity
  for (const item of scored) {
    if (usedCardIds.has(item.card.id)) continue
    const { athDropPct } = item.signals
    if (athDropPct >= 20 && rarityScore(item.card.rarity) >= 0.35) {
      picks.undervalued.push(item)
      usedCardIds.add(item.card.id)
      if (picks.undervalued.length >= 5) break
    }
  }

  // 4. Long term: fill remaining top scorers not yet picked
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

      console.log(`\n🤖 Generating narrative: ${card.name} [${pickType} #${rank}]`)

      let aiResult
      try {
        aiResult = await generateNarrative(card, signals, pickType, PERIOD)
      } catch (err) {
        console.error(`   ❌ AI failed for ${card.name}: ${err.message}`)
        aiResult = {
          narrative: `${card.name} présente des caractéristiques favorables pour les investisseurs Pokémon TCG.`,
          bullish: ['Rareté élevée', 'Demande soutenue', 'Potentiel de hausse'],
          bearish: ['Volatilité marché', 'Liquidité variable'],
        }
      }

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
        horizon: investmentHorizon(pickType, signals),
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
