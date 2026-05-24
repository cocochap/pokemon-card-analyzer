/**
 * Moteur de scoring IA — version TypeScript embarquée dans Next.js.
 * Reproduit la logique du service Python sans serveur séparé.
 */

export interface ScoringInput {
  priceChange7d: number
  priceChange30d: number
  priceChange90d: number
  volatility30d: number
  rsi14: number
  volume7d: number
  volumeAvg90d: number
  rarityRank: number        // 1-10
  populationPsa10: number
  setAgeDays: number
  isVintage: boolean
  isFirstEdition: boolean
  isShadowless: boolean
  isPromo: boolean
  pokemonPopularity: number // 0-100
  watchlistGrowth7d: number
  socialMentions7d: number
  ebayCount30d: number
  listingsCount: number
}

export interface ScoringResult {
  investmentScore: number   // 0-100
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
  const momentum  = momentumScore(inp)
  const scarcity  = scarcityScore(inp)
  const technical = technicalScore(inp)
  const social    = socialScore(inp)
  const liquidity = liquidityScore(inp)
  const fundamental = fundamentalScore(inp)

  const raw = (
    momentum   * 0.25 +
    scarcity   * 0.20 +
    fundamental * 0.20 +
    social     * 0.15 +
    technical  * 0.10 +
    liquidity  * 0.10
  )

  const investmentScore = clamp(Math.round(raw), 0, 100)
  const rarityScore     = clamp(Math.round(scarcity), 0, 100)
  const liquidityScore_ = clamp(Math.round(liquidity), 0, 100)
  const riskLevel       = computeRisk(inp)

  // Prédiction ROI : mean-reversion ajustée par la volatilité
  // (sera overridée par buildPredictions() dans la route, mais sert de fallback)
  const volAdj = Math.max(0.3, 1 - Math.min(inp.volatility30d, 2.0) * 0.20)
  const baseMom30 = inp.priceChange7d * 0.35 + inp.priceChange30d * 0.65
  const baseMom90 = inp.priceChange30d * 0.70 + inp.priceChange90d * 0.30
  const predictedRoi30d = clamp(baseMom30 * 0.60 * volAdj / 100, -0.8, 3.0)
  const predictedRoi90d = clamp(baseMom90 * 0.35 * volAdj / 100, -0.8, 3.0)

  // Trend depuis les variations observées (pas depuis le ROI prédit)
  const trendDirection: ScoringResult['trendDirection'] =
    inp.volatility30d > 0.65 ? 'VOLATILE'
    : inp.priceChange30d > 8 ? 'BULLISH'
    : inp.priceChange30d < -8 ? 'BEARISH'
    : inp.priceChange7d > 5 ? 'BULLISH'
    : inp.priceChange7d < -5 ? 'BEARISH'
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

function momentumScore(inp: ScoringInput): number {
  let s = 50
  s += inp.priceChange7d > 20 ? 15 : inp.priceChange7d > 10 ? 10 : inp.priceChange7d > 5 ? 5
    : inp.priceChange7d < -20 ? -15 : inp.priceChange7d < -10 ? -10 : inp.priceChange7d < -5 ? -5 : 0
  s += inp.priceChange30d > 30 ? 12 : inp.priceChange30d > 15 ? 8 : inp.priceChange30d > 5 ? 4
    : inp.priceChange30d < -30 ? -12 : inp.priceChange30d < -15 ? -8 : 0
  if (inp.volume7d > inp.volumeAvg90d * 2) s += 10
  else if (inp.volume7d > inp.volumeAvg90d * 1.5) s += 5
  return clamp(s, 0, 100)
}

function scarcityScore(inp: ScoringInput): number {
  let s = inp.rarityRank * 10
  if (inp.populationPsa10 < 10) s += 20
  else if (inp.populationPsa10 < 50) s += 12
  else if (inp.populationPsa10 < 200) s += 5
  else if (inp.populationPsa10 > 5000) s -= 10
  if (inp.isVintage) s += 15
  if (inp.isFirstEdition) s += 20
  if (inp.isShadowless) s += 15
  if (inp.isPromo) s += 10
  return clamp(s, 0, 100)
}

function technicalScore(inp: ScoringInput): number {
  let s = 50
  if (inp.rsi14 < 30) s += 20
  else if (inp.rsi14 < 40) s += 10
  else if (inp.rsi14 > 70) s -= 15
  else if (inp.rsi14 > 80) s -= 25
  // Seuils calibrés pour volatilité annualisée correcte (base √252)
  if (inp.volatility30d > 1.20) s -= 15
  else if (inp.volatility30d > 0.80) s -= 8
  else if (inp.volatility30d < 0.20) s += 5  // carte stable = signal positif
  return clamp(s, 0, 100)
}

function socialScore(inp: ScoringInput): number {
  let s = 30
  if (inp.watchlistGrowth7d > 50) s += 30
  else if (inp.watchlistGrowth7d > 20) s += 20
  else if (inp.watchlistGrowth7d > 10) s += 10
  if (inp.socialMentions7d > 500) s += 15
  else if (inp.socialMentions7d > 100) s += 8
  else if (inp.socialMentions7d > 20) s += 4
  return clamp(s, 0, 100)
}

function liquidityScore(inp: ScoringInput): number {
  let s = 20
  if (inp.ebayCount30d > 100) s += 40
  else if (inp.ebayCount30d > 50) s += 25
  else if (inp.ebayCount30d > 20) s += 15
  else if (inp.ebayCount30d > 5) s += 8
  else if (inp.ebayCount30d === 0) s -= 10
  if (inp.listingsCount > 200) s += 25
  else if (inp.listingsCount > 50) s += 15
  else if (inp.listingsCount > 10) s += 8
  else if (inp.listingsCount < 3) s -= 15
  return clamp(s, 0, 100)
}

function fundamentalScore(inp: ScoringInput): number {
  let s = 40
  s += inp.pokemonPopularity * 0.3
  const years = inp.setAgeDays / 365
  if (years > 20) s += 20
  else if (years > 10) s += 12
  else if (years > 5) s += 6
  else if (years < 1) s -= 5
  return clamp(s, 0, 100)
}

function computeRisk(inp: ScoringInput): number {
  let r = 25
  // Volatilité : calibré pour base √252 (valeurs typiques 0.20-1.50)
  r += Math.min(35, inp.volatility30d * 22)
  if (inp.ebayCount30d < 5) r += 20
  else if (inp.ebayCount30d < 15) r += 8
  if (inp.listingsCount < 5) r += 15
  if (inp.priceChange30d < -30) r += 20
  else if (inp.priceChange30d < -15) r += 10
  if (inp.rsi14 > 75) r += 15
  if (inp.setAgeDays < 60) r += 10
  // Bonus stabilité : set ancien + liquidité correcte = risque réduit
  if (inp.setAgeDays > 3650 && inp.ebayCount30d > 10) r -= 8
  return clamp(Math.round(r), 0, 100)
}

function extractSignals(inp: ScoringInput) {
  const bullishSignals: string[] = []
  const bearishSignals: string[] = []

  if (inp.priceChange7d > 15) bullishSignals.push(`Momentum fort : +${inp.priceChange7d.toFixed(1)}% sur 7 jours`)
  if (inp.priceChange30d > 20) bullishSignals.push(`Hausse soutenue : +${inp.priceChange30d.toFixed(1)}% sur 30 jours`)
  if (inp.volume7d > inp.volumeAvg90d * 2) bullishSignals.push('Pic de volume : 2× la moyenne 90 jours')
  if (inp.rsi14 < 30) bullishSignals.push(`RSI à ${inp.rsi14.toFixed(0)} — oversold, rebond probable`)
  if (inp.populationPsa10 < 50) bullishSignals.push(`Population PSA 10 très faible : ${inp.populationPsa10} copies`)
  if (inp.isFirstEdition) bullishSignals.push('1ère édition — prime collecteur élevée')
  if (inp.isVintage) bullishSignals.push('Carte vintage (avant 2003) — forte demande collector')
  if (inp.watchlistGrowth7d > 30) bullishSignals.push(`Watchlists +${inp.watchlistGrowth7d.toFixed(0)}% cette semaine`)

  if (inp.priceChange7d < -15) bearishSignals.push(`Chute : ${inp.priceChange7d.toFixed(1)}% sur 7 jours`)
  if (inp.priceChange30d < -20) bearishSignals.push(`Déclin prolongé : ${inp.priceChange30d.toFixed(1)}% sur 30 jours`)
  if (inp.rsi14 > 70) bearishSignals.push(`RSI à ${inp.rsi14.toFixed(0)} — overbought, correction possible`)
  if (inp.volatility30d > 1.5) bearishSignals.push(`Volatilité élevée (${inp.volatility30d.toFixed(2)} annualisée)`)
  if (inp.ebayCount30d < 3) bearishSignals.push('Volume d\'échange très faible — marché illiquide')
  if (inp.populationPsa10 > 5000) bearishSignals.push(`Offre PSA 10 abondante (${inp.populationPsa10}) — upside limité`)

  return { bullishSignals, bearishSignals }
}

function generateInsight(inp: ScoringInput, score: number, bullish: string[], bearish: string[]): string {
  if (score >= 80) return `Opportunité d'achat forte (score ${score}/100). ${inp.isFirstEdition ? '1ère édition' : 'Carte'} avec momentum positif et faible population PSA 10 de ${inp.populationPsa10}.`
  if (score >= 65) return `Profil au-dessus de la moyenne (score ${score}/100). RSI à ${inp.rsi14.toFixed(0)}, performance 30j : ${inp.priceChange30d > 0 ? '+' : ''}${inp.priceChange30d.toFixed(1)}%.`
  if (score >= 50) return `Profil neutre (score ${score}/100). ${inp.volatility30d > 1 ? 'Volatilité élevée — attention. ' : ''}Mieux adapté aux collectionneurs qu'aux investisseurs court terme.`
  return `Profil faible (score ${score}/100). ${bearish.length > 0 ? bearish[0] : 'Conditions de marché défavorables.'}`
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
