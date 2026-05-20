/**
 * Logique d'investissement partagée entre le scan et l'analyse Elite.
 * Source unique de vérité pour les projections et scores.
 */

// ── Character tiers ───────────────────────────────────────────────────────────
const S_TIER_NAMES = [
  'dracaufeu','charizard','pikachu','mewtwo','mew','lucario','evoli','eevee',
  'ronflex','snorlax','lugia','ho-oh','rayquaza','arceus','dialga','palkia',
  'giratina','reshiram','zekrom','xerneas','yveltal','solgaleo','lunala',
  'zacian','zamazenta','calyrex','koraidon','miraidon','ectoplasma','gengar',
]
const A_TIER_NAMES = [
  'ditto','alakazam','dracolosse','dragonite','lokhlass','gyarados','salamèche',
  'charmander','bulbizarre','bulbasaur','carapuce','squirtle','noctali','umbreon',
  'mentali','espeon','nymphali','sylveon','félinferno','incineroar','décidueye',
  'primarina','corvaillus','corviknight','dragapex','regidrago','regieleki',
  'celebi','jirachi','deoxys','darkrai','shaymin','genesect','diancie','volcanion',
]

export function charTier(name: string): 'S' | 'A' | 'B' {
  const n = name.toLowerCase()
  if (S_TIER_NAMES.some(c => n.includes(c))) return 'S'
  if (A_TIER_NAMES.some(c => n.includes(c))) return 'A'
  return 'B'
}

// ── Rarity weights ────────────────────────────────────────────────────────────
export const RARITY_W: Record<string, number> = {
  SPECIAL_ILLUSTRATION_RARE: 1.0, HYPER_RARE: 1.0, CROWN_RARE: 1.0,
  ILLUSTRATION_RARE: 0.85, RARE_RAINBOW: 0.85, RARE_SECRET: 0.85,
  RARE_ULTRA: 0.70, RARE_HOLO_VMAX: 0.65, RARE_HOLO_VSTAR: 0.65,
  RARE_HOLO_EX: 0.60, RARE_HOLO_GX: 0.55, RARE_HOLO_V: 0.55,
  RARE_HOLO: 0.40, AMAZING_RARE: 0.50, RARE_SHINY_GX: 0.50,
  LEGEND: 0.60, PROMO: 0.30, RARE: 0.25, UNCOMMON: 0.10, COMMON: 0.05,
}

// ── Scarce sets ───────────────────────────────────────────────────────────────
const SCARCE_EXACT = new Set(['me01','me02','me03','mep','mee','meg','cel25','swsh35','dpp','hgssp','smp','tk-jn03a','xy0'])
const VINTAGE_SERIES = new Set(['base1','base2','base3','base4','base5','jungle','fossil','teamrocket','neo1','neo2','neo3','neo4','gym1','gym2','ecard1','ecard2','ecard3'])

export function scarcityScore(exId: string, rarity: string): number {
  if (SCARCE_EXACT.has(exId)) return 1.0
  if (VINTAGE_SERIES.has(exId)) return 0.90
  if (['pop','tk-','prswsh','prxy','prsm','np','wc'].some(p => exId.startsWith(p))) return 0.85
  if (rarity === 'PROMO') return 0.65
  return 0
}

export function detectEra(exId: string, series: string | null): 'vintage' | 'old' | 'swsh' | 'sv' | 'modern' {
  if (VINTAGE_SERIES.has(exId)) return 'vintage'
  const s = (series ?? '').toLowerCase()
  if (s.includes('écarlate') || s.includes('scarlet') || exId.startsWith('sv')) return 'sv'
  if (s.includes('épée') || s.includes('sword') || exId.startsWith('swsh')) return 'swsh'
  if (s.includes('xy') || s.includes('sol') || s.includes('sun') || s.includes('lune') || s.includes('moon')) return 'old'
  return 'modern'
}

// ── Investment score from profile ─────────────────────────────────────────────
// Score cohérent basé sur charTier, rareté, scarcité, era — sans dépendre du batch.
export function investmentScoreFromProfile(
  charTierVal: 'S' | 'A' | 'B',
  rarityW: number,
  scarce: number,
  era: string,
  athDropPct: number,
  change7d: number,
  change30d: number,
): number {
  let score = 30

  // Char tier (0-30 pts)
  if (charTierVal === 'S') score += 30
  else if (charTierVal === 'A') score += 18
  else score += 6

  // Rarity (0-25 pts)
  score += Math.round(rarityW * 25)

  // Scarcity (0-15 pts)
  score += Math.round(scarce * 15)

  // Era (0-10 pts)
  if (era === 'vintage') score += 10
  else if (era === 'old') score += 5

  // ATH discount boost (0-8 pts)
  if (athDropPct > 40) score += 8
  else if (athDropPct > 20) score += 4

  // Recent momentum (0-7 pts)
  if (change7d > 10 || change30d > 15) score += 7
  else if (change7d > 5 || change30d > 8) score += 4
  else if (change7d < -10 || change30d < -15) score -= 5

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Price targets ─────────────────────────────────────────────────────────────
// Multiplicateurs fondés sur l'analyse de cartes comparables réelles.
// Source unique utilisée par le scan ET l'analyse Elite pour cohérence.
export function buildTargets(
  price: number,
  ath: number,
  charTierVal: 'S' | 'A' | 'B',
  rarityW: number,
  scarce: number,
  era: string,
  athDropPct: number,
) {
  const isSIR = rarityW >= 0.85
  const isVintage = era === 'vintage'

  let mult1y = 1.10
  let mult3y = 1.35
  let mult5y = 1.70
  let horizon = '6-12 mois'
  let conviction: 'FORTE' | 'MODÉRÉE' | 'FAIBLE' = 'MODÉRÉE'

  if (isVintage && charTierVal === 'S') {
    mult1y = 1.45; mult3y = 3.0; mult5y = 5.5
    horizon = '3-5 ans'; conviction = 'FORTE'
  } else if (isVintage && charTierVal === 'A') {
    mult1y = 1.25; mult3y = 2.2; mult5y = 4.0
    horizon = '3-5 ans'; conviction = 'FORTE'
  } else if (isVintage) {
    mult1y = 1.15; mult3y = 1.8; mult5y = 3.0
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'
  } else if (isSIR && charTierVal === 'S') {
    mult1y = 1.45; mult3y = 2.5; mult5y = 4.0
    horizon = '1-3 ans'; conviction = 'FORTE'
  } else if (isSIR && charTierVal === 'A') {
    mult1y = 1.30; mult3y = 2.0; mult5y = 3.2
    horizon = '1-3 ans'; conviction = 'FORTE'
  } else if (isSIR) {
    mult1y = 1.15; mult3y = 1.7; mult5y = 2.5
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'
  } else if (scarce >= 0.85 && charTierVal === 'S') {
    mult1y = 1.35; mult3y = 2.2; mult5y = 3.8
    horizon = '1-2 ans'; conviction = 'FORTE'
  } else if (charTierVal === 'S') {
    mult1y = 1.20; mult3y = 1.75; mult5y = 2.5
    horizon = '1-2 ans'; conviction = 'MODÉRÉE'
  } else if (charTierVal === 'A') {
    mult1y = 1.10; mult3y = 1.50; mult5y = 2.0
    horizon = '2-3 ans'; conviction = 'MODÉRÉE'
  } else {
    mult1y = 1.05; mult3y = 1.25; mult5y = 1.60
    horizon = '3-5 ans'; conviction = 'FAIBLE'
  }

  // ATH recovery boost
  if (athDropPct > 40) { mult1y *= 1.15; mult3y *= 1.10 }
  else if (athDropPct > 20) { mult1y *= 1.08 }

  // Round cleanly
  mult1y = +mult1y.toFixed(3)
  mult3y = +mult3y.toFixed(3)
  mult5y = +mult5y.toFixed(3)

  // y10 : CAGR implicite des 5 ans appliqué jusqu'à 10 ans, plafonné à 6x
  const cagr5 = Math.pow(mult5y, 1 / 5) - 1
  const mult10 = Math.min(6.0, +Math.pow(1 + cagr5, 10).toFixed(2))

  const t1y  = +(price * mult1y).toFixed(2)
  const t3y  = +(price * mult3y).toFixed(2)
  const t5y  = +(price * mult5y).toFixed(2)
  const t10y = +(price * mult10).toFixed(2)
  const athTarget = ath > price ? +(ath * 1.05).toFixed(2) : null

  return { t1y, t3y, t5y, t10y, athTarget, horizon, conviction, mult1y, mult3y, mult5y, mult10 }
}
