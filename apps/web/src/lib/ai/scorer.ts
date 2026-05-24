/**
 * Moteur de scoring investissement Pokémon TCG — calibré sur données réelles de marché.
 *
 * Sources : Charizard Price Tracker (1999-2026), Cards N Packs index, PokeInsider,
 *           TCGQuant LTS model, PSA Population Reports, Cardmarket historique EU.
 *
 * Principe : zéro donnée fictive. Chaque signal provient de données réelles en DB.
 * Poids : Fundamental(35%) + Momentum(25%) + Scarcity(20%) + Liquidity(15%) + Technical(5%)
 */

export interface ScoringInput {
  priceChange7d: number
  priceChange30d: number
  priceChange90d: number
  volatility30d: number
  rsi14: number
  ebayCount30d: number      // ventes réelles uniquement — pas de fallback fictif
  rarityRank: number        // 1-10 (COMMON=2, RARE_HOLO=5, SIR=9, CROWN=10)
  populationPsa10: number   // 999 = données PSA non disponibles
  setAgeDays: number
  isVintage: boolean        // Base Set, Jungle, Fossil, Neo, E-Card (avant 2003)
  isFirstEdition: boolean
  isShadowless: boolean
  isPromo: boolean
  isOOP: boolean            // set hors impression (offre fixe, signal clé investissement)
  pokemonPopularity: number // 0-100 (S-tier=90, A-tier=60, B-tier=30)
  athDropPct: number        // % de chute depuis ATH (0-100) — potentiel de recovery
}

export interface ScoringResult {
  investmentScore: number
  rarityScore: number
  liquidityScore: number
  riskLevel: number
  trendDirection: 'BULLISH' | 'BEARISH' | 'STABLE' | 'VOLATILE'
  bullishSignals: string[]
  bearishSignals: string[]
  keyInsight: string
  predictedRoi30d: number
  predictedRoi90d: number
}

export function scoreCard(inp: ScoringInput): ScoringResult {
  const fundamental = fundamentalScore(inp)
  const momentum    = momentumScore(inp)
  const scarcity    = scarcityScore(inp)
  const liquidity   = liquidityScore(inp)
  const technical   = technicalScore(inp)

  // Poids calibrés : facteurs structurels dominent (données plus fiables que prix court terme)
  const raw = (
    fundamental * 0.35 +
    momentum    * 0.25 +
    scarcity    * 0.20 +
    liquidity   * 0.15 +
    technical   * 0.05
  )

  const investmentScore = clamp(Math.round(raw), 0, 92)
  const rarityScore     = clamp(Math.round(scarcity), 0, 100)
  const liquidityScore_ = clamp(Math.round(liquidity), 0, 100)
  const riskLevel       = computeRisk(inp)

  // ROI prédit — mean-reversion ajustée par volatilité (fallback si buildPredictions indisponible)
  const volAdj = Math.max(0.25, 1 - Math.min(inp.volatility30d, 2.0) * 0.20)
  const baseMom30 = inp.priceChange7d * 0.35 + inp.priceChange30d * 0.65
  const baseMom90 = inp.priceChange30d * 0.70 + inp.priceChange90d * 0.30
  const predictedRoi30d = clamp(baseMom30 * 0.60 * volAdj / 100, -0.8, 3.0)
  const predictedRoi90d = clamp(baseMom90 * 0.35 * volAdj / 100, -0.8, 3.0)

  // Trend depuis variations réelles observées (pas depuis ROI prédit)
  // Calibré : volatilité normale vintage ~30-40%, moderne ~50-80% annualisé (source: PokeInsider 2026)
  const trendDirection: ScoringResult['trendDirection'] =
    inp.volatility30d > 0.65 ? 'VOLATILE'
    : inp.priceChange30d > 8  ? 'BULLISH'
    : inp.priceChange30d < -8 ? 'BEARISH'
    : inp.priceChange7d  > 5  ? 'BULLISH'
    : inp.priceChange7d  < -5 ? 'BEARISH'
    : 'STABLE'

  const { bullishSignals, bearishSignals } = extractSignals(inp)
  const keyInsight = generateInsight(inp, investmentScore, bullishSignals, bearishSignals)

  return {
    investmentScore,
    rarityScore,
    liquidityScore: liquidityScore_,
    riskLevel,
    trendDirection,
    bullishSignals: bullishSignals.slice(0, 5),
    bearishSignals: bearishSignals.slice(0, 5),
    keyInsight,
    predictedRoi30d,
    predictedRoi90d,
  }
}

// ── Fundamental (35%) ─────────────────────────────────────────────────────────
// IP desirability = facteur #1 selon TCGQuant LTS model et professionnels TCG
function fundamentalScore(inp: ScoringInput): number {
  let s = 35

  // Popularité Pokémon : S-tier (Charizard, Pikachu) vs B-tier (générique)
  // Pondéré par la rareté : un Pikachu commun bénéficie moins qu'un Pikachu SIR
  const rarityMod = Math.min(1, inp.rarityRank / 7)  // commun(2)=0.29, holo(5)=0.71, SIR(9)=1.0
  s += Math.round(inp.pokemonPopularity * 0.22 * (0.4 + rarityMod * 0.6))  // 0-20 pts

  // Ancienneté du set : offre fixe = rareté croissante mécaniquement
  const years = inp.setAgeDays / 365
  if (years > 20)     s += 22  // vintage : offre définitivement fixe (Base Set 1999)
  else if (years > 10) s += 14
  else if (years > 5)  s += 7
  else if (years > 2)  s += 3
  else if (years < 1)  s -= 8  // set récent : dilution supply encore active

  // Statut OOP renforce la thèse fondamentale (offre cesse d'augmenter)
  if (inp.isOOP && years > 1) s += 8

  return clamp(s, 0, 100)
}

// ── Momentum (25%) ────────────────────────────────────────────────────────────
function momentumScore(inp: ScoringInput): number {
  let s = 40

  // Variations de prix observées (données réelles Cardmarket/eBay)
  s += inp.priceChange7d > 20 ? 20
     : inp.priceChange7d > 10 ? 12
     : inp.priceChange7d > 5  ? 6
     : inp.priceChange7d < -20 ? -20
     : inp.priceChange7d < -10 ? -12
     : inp.priceChange7d < -5  ? -6 : 0

  s += inp.priceChange30d > 30 ? 20
     : inp.priceChange30d > 15 ? 12
     : inp.priceChange30d > 5  ? 6
     : inp.priceChange30d < -30 ? -20
     : inp.priceChange30d < -15 ? -12
     : inp.priceChange30d < -5  ? -6 : 0

  // ATH recovery : bonus réduit si la chute est encore en cours (ne pas attraper un couteau qui tombe)
  // Documenté : Charizard Base crash 2022 a continué 4 mois avant retournement
  const stillFalling = inp.priceChange7d < -3 && inp.priceChange30d < -5
  const athMult = stillFalling ? 0.4 : 1
  if (inp.athDropPct > 40 && inp.isVintage)            s += Math.round(15 * athMult)
  else if (inp.athDropPct > 30 && inp.rarityRank >= 8) s += Math.round(10 * athMult)
  else if (inp.athDropPct > 30)                        s += Math.round(6 * athMult)
  else if (inp.athDropPct > 20)                        s += Math.round(3 * athMult)

  // Pénalité timing : tendance baissière confirmée sur les deux horizons = mauvais moment d'achat
  // RSI < 35 = oversold, signal de retournement → pénalité allégée
  if (inp.priceChange7d < -5 && inp.priceChange30d < -10) {
    s -= inp.rsi14 < 35 ? 5 : 15
  }

  return clamp(s, 0, 100)
}

// ── Scarcity (20%) ────────────────────────────────────────────────────────────
// Calibré sur PSA Population Reports et prime shadowless documentée (300-400%)
function scarcityScore(inp: ScoringInput): number {
  let s = inp.rarityRank * 10

  // PSA 10 population — sweet spot investissable : <1000 à 24 mois (source: PokeInsider 2026)
  if (inp.populationPsa10 !== 999) {  // 999 = pas de données PSA
    if (inp.populationPsa10 < 10)        s += 25
    else if (inp.populationPsa10 < 50)   s += 20
    else if (inp.populationPsa10 < 200)  s += 14
    else if (inp.populationPsa10 < 1000) s += 8
    else if (inp.populationPsa10 > 5000) s -= 12
  }

  // Primes documentées par catégorie
  if (inp.isVintage)      s += 18  // offre fixe depuis 1999-2003
  if (inp.isFirstEdition) s += 22  // facteur collecteur #1, gap PSA9→10 = 11x sur Charizard
  if (inp.isShadowless)   s += 15  // shadowless premium ~300-400% vs unlimited
  if (inp.isPromo)        s += 8
  if (inp.isOOP)          s += 10  // set retiré = offre fixe désormais

  return clamp(s, 0, 100)
}

// ── Liquidity (15%) ───────────────────────────────────────────────────────────
// Basé exclusivement sur ventes réelles — seuil praticien : >20 ventes/mois = liquide
// (source: consensus marché TCG, Cardmarket guide 2026)
function liquidityScore(inp: ScoringInput): number {
  let s = 15
  if (inp.ebayCount30d > 50)      s += 55
  else if (inp.ebayCount30d > 20) s += 40  // seuil "liquide" praticien
  else if (inp.ebayCount30d > 10) s += 25
  else if (inp.ebayCount30d > 5)  s += 12
  else if (inp.ebayCount30d > 0)  s += 4
  else                             s -= 5   // aucune vente documentée = illiquidité
  return clamp(s, 0, 100)
}

// ── Technical (5%) ────────────────────────────────────────────────────────────
// Poids faible : signal utile mais moins fiable sur marché TCG peu profond
function technicalScore(inp: ScoringInput): number {
  let s = 50
  if (inp.rsi14 < 30)      s += 20  // oversold : signal d'achat (RSI Wilder)
  else if (inp.rsi14 < 40) s += 10
  else if (inp.rsi14 > 70) s -= 15  // overbought : correction probable
  else if (inp.rsi14 > 80) s -= 25
  // Seuils calibrés : vintage ~30-40% vol annualisée, moderne ~50-80% (source: PokeInsider 2026)
  if (inp.volatility30d > 0.65)      s -= 15
  else if (inp.volatility30d > 0.45) s -= 8
  else if (inp.volatility30d < 0.25) s += 8  // stabilité de prix = qualité d'actif
  return clamp(s, 0, 100)
}

// ── Risk (0-100, plus élevé = plus risqué) ────────────────────────────────────
// Calibré sur max drawdown observé TCG : -60% à -63% (crash 2022, données Cards N Packs)
function computeRisk(inp: ScoringInput): number {
  let r = 20

  // Volatilité annualisée : coefficients calibrés sur benchmarks réels
  r += Math.min(40, inp.volatility30d * 50)

  // Illiquidité = risque de sortie (spread effectif dealer retail→buylist : 25-40%)
  if (inp.ebayCount30d < 3)       r += 25
  else if (inp.ebayCount30d < 10) r += 12

  // Tendance de prix
  if (inp.priceChange30d < -30)   r += 20
  else if (inp.priceChange30d < -15) r += 10

  // RSI overbought
  if (inp.rsi14 > 75) r += 12

  // Set très récent : prix instables pendant les 90 premiers jours
  if (inp.setAgeDays < 90) r += 15

  // Réductions : actif établi, liquide, hors impression
  if (inp.isVintage && inp.ebayCount30d >= 5)  r -= 12
  if (inp.setAgeDays > 3650 && inp.isOOP)      r -= 8

  return clamp(Math.round(r), 0, 100)
}

// ── Signaux bullish/bearish ───────────────────────────────────────────────────
function extractSignals(inp: ScoringInput) {
  const bullishSignals: string[] = []
  const bearishSignals: string[] = []

  if (inp.priceChange7d > 15)
    bullishSignals.push(`Momentum fort : +${inp.priceChange7d.toFixed(1)}% sur 7 jours`)
  if (inp.priceChange30d > 20)
    bullishSignals.push(`Hausse soutenue : +${inp.priceChange30d.toFixed(1)}% sur 30 jours`)
  if (inp.rsi14 < 30)
    bullishSignals.push(`RSI ${inp.rsi14.toFixed(0)} — oversold, rebond technique probable`)
  if (inp.populationPsa10 !== 999 && inp.populationPsa10 < 200)
    bullishSignals.push(`Population PSA 10 faible : ${inp.populationPsa10} — sweet spot investissement`)
  if (inp.isFirstEdition)
    bullishSignals.push('1ère édition — prime collecteur maximale (gap PSA 9→10 documenté)')
  if (inp.isVintage)
    bullishSignals.push('Carte vintage (avant 2003) — offre fixe, demande nostalgie structurelle')
  if (inp.isOOP && !inp.isVintage)
    bullishSignals.push('Set hors impression — fin de la dilution supply')
  if (inp.athDropPct > 30)
    bullishSignals.push(`${inp.athDropPct.toFixed(0)}% sous ATH — potentiel de recovery significatif`)

  if (inp.priceChange7d < -15)
    bearishSignals.push(`Chute : ${inp.priceChange7d.toFixed(1)}% sur 7 jours`)
  if (inp.priceChange30d < -20)
    bearishSignals.push(`Déclin prolongé : ${inp.priceChange30d.toFixed(1)}% sur 30 jours`)
  if (inp.rsi14 > 70)
    bearishSignals.push(`RSI ${inp.rsi14.toFixed(0)} — overbought, correction à surveiller`)
  if (inp.volatility30d > 0.65)
    bearishSignals.push(`Volatilité élevée (${inp.volatility30d.toFixed(2)} annualisée) — profil spéculatif`)
  if (inp.ebayCount30d < 3)
    bearishSignals.push('Volume d\'échange très faible — sortie de position difficile')
  if (inp.populationPsa10 !== 999 && inp.populationPsa10 > 5000)
    bearishSignals.push(`Offre PSA 10 abondante (${inp.populationPsa10}) — upside limité`)
  if (!inp.isOOP && inp.setAgeDays < 400)
    bearishSignals.push('Set encore en impression — dilution supply active, pression baissière')

  return { bullishSignals, bearishSignals }
}

// ── Key insight ───────────────────────────────────────────────────────────────
function generateInsight(inp: ScoringInput, score: number, bullish: string[], bearish: string[]): string {
  const oopStr = inp.isOOP ? (inp.isVintage ? 'vintage, ' : 'hors impression, ') : ''
  const athStr = inp.athDropPct > 25 ? ` ${inp.athDropPct.toFixed(0)}% sous ATH.` : ''

  if (score >= 80) {
    const top = bullish[0] ?? `performance 30j : ${inp.priceChange30d > 0 ? '+' : ''}${inp.priceChange30d.toFixed(1)}%`
    return `Opportunité forte (${score}/100). ${oopStr}${top}.${athStr}`
  }
  if (score >= 65)
    return `Profil solide (${score}/100). ${oopStr}Performance 30j : ${inp.priceChange30d > 0 ? '+' : ''}${inp.priceChange30d.toFixed(1)}%.${athStr}`
  if (score >= 50)
    return `Profil neutre (${score}/100). ${inp.volatility30d > 0.45 ? 'Volatilité élevée — risque spéculatif. ' : ''}Adapté collectionneurs plutôt qu'investissement court terme.`
  return `Profil prudent (${score}/100). ${bearish[0] ?? 'Conditions de marché défavorables.'}`
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
