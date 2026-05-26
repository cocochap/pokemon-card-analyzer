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
  const id = exId.toLowerCase()
  if (s.includes('écarlate') || s.includes('scarlet') || id.startsWith('sv')) return 'sv'
  if (s.includes('épée') || s.includes('sword') || id.startsWith('swsh')) return 'swsh'
  // XY / Soleil-Lune / Sun-Moon
  if (s.includes('xy') || s.includes('sol') || s.includes('sun') || s.includes('lune') || s.includes('moon')) return 'old'
  // Noir-Blanc / Black-White (2010-2013)
  if (s.includes('noir') || s.includes('black') || s.includes('blanc') || s.includes('white') || id.startsWith('bw')) return 'old'
  // HeartGold SoulSilver (2009-2011)
  if (s.includes('heartgold') || s.includes('soulsilver') || s.includes('or') || s.includes('argent') || id.startsWith('hgss')) return 'old'
  // Diamant-Perle / Diamond-Pearl / Platine (2006-2009)
  if (s.includes('diamond') || s.includes('pearl') || s.includes('platinum') || s.includes('diamant') || s.includes('perle') || s.includes('platine') || id.startsWith('dp') || id.startsWith('pl')) return 'old'
  // Série EX (2003-2007) — borderline vintage/old, traité comme 'old'
  if (s.includes(' ex') || id.startsWith('ex')) return 'old'
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
  else if (era === 'old' || era === 'swsh') score += 5

  // ATH discount boost (0-8 pts)
  if (athDropPct > 40) score += 8
  else if (athDropPct > 20) score += 4

  // Recent momentum timing — double négatif confirmé = mauvais point d'entrée
  if (change7d > 10 || change30d > 15) score += 7
  else if (change7d > 5 || change30d > 8) score += 4
  else if (change7d < -5 && change30d < -10) score -= 12  // tendance baissière confirmée
  else if (change7d < -10 || change30d < -15) score -= 7

  return Math.max(0, Math.min(100, Math.round(score)))
}

// ── Price targets ─────────────────────────────────────────────────────────────
// Estimations réalistes basées sur l'historique réel du marché Pokémon TCG.
// Principe : honnêteté > optimisme. La plupart des cartes modernes ne s'apprécient pas.
//
// Données de référence (Cardmarket, 2020-2025) :
// - Vintage S-tier (Charizard Base, Pikachu promo) : +15-25%/an sur 5 ans
// - SIR/SAR iconiques hors impression : +10-20%/an après 12 mois de set arrêté
// - SV encore en impression : flat à -10% possible (dilution supply)
// - Communs/Uncommons modernes : -10% à -30% sur 3 ans (remplacement par nouveaux sets)

export function buildTargets(
  price: number,
  ath: number,
  charTierVal: 'S' | 'A' | 'B',
  rarityW: number,
  scarce: number,
  era: string,
  athDropPct: number,
  isOOP = false,
  isPromo = false,
) {
  const isSIR     = rarityW >= 0.85   // Special/Hyper/Crown Rare
  const isUltra   = rarityW >= 0.55   // Ultra Rare, VMAX, VSTAR, ex...
  const isHolo    = rarityW >= 0.25   // Rare Holo+
  const isVintage = era === 'vintage'
  // Promos = supply fixe dès la sortie → traiter comme set rare/limité
  const isScarce  = scarce >= 0.85 || (isPromo && scarce >= 0.60)
  // SV encore en impression = pas encore OOP (ex: set sorti il y a <14 mois)
  // Bug corrigé : un SV OOP (151, Failles Paradoxe…) ne doit PAS être traité comme "en impression"
  const isModernSV = era === 'sv' && !isOOP

  let mult1y: number
  let mult3y: number
  let mult5y: number
  let horizon: string
  let conviction: 'FORTE' | 'MODÉRÉE' | 'FAIBLE'

  // ── Vintage WOTC (Base Set, Neo, E-Card…) ───────────────────────
  // Sources : CardLadder Pokemon Index +3261% depuis 2004 ; Charizard Base PSA 10 CAGR
  // 2015-2025 ~34-37%/an (1st Ed) ; CAGR conservateur sur panier diversifié : 15-25%/an
  if (isVintage && charTierVal === 'S') {
    mult1y = 1.22; mult3y = 1.82; mult5y = 2.70  // 22%/an — Charizard/Pikachu vintage
    horizon = '3-5 ans'; conviction = 'FORTE'
  } else if (isVintage && charTierVal === 'A') {
    mult1y = 1.10; mult3y = 1.33; mult5y = 1.61  // 10%/an — personnages A-tier vintage
    horizon = '3-5 ans'; conviction = 'FORTE'
  } else if (isVintage) {
    mult1y = 1.06; mult3y = 1.19; mult5y = 1.34  // 6%/an — bulk vintage WOTC
    horizon = '5-8 ans'; conviction = 'MODÉRÉE'

  // ── Sets rares / promos limitées (cel25, smp…) ─────────────────
  } else if (isScarce && charTierVal === 'S') {
    mult1y = 1.18; mult3y = 1.62; mult5y = 2.35  // 19%/an — promo iconique mascotte
    horizon = '2-4 ans'; conviction = 'FORTE'
  } else if (isScarce) {
    mult1y = 1.10; mult3y = 1.33; mult5y = 1.61  // 10%/an — promo populaire
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'

  // ── SIR/SAR hors impression (SWSH OOP + SV OOP post rotation 2026) ──
  // Sources : Umbreon VMAX Alt Art (Evolving Skies) : ~54% CAGR PSA 10 sur 4.75 ans
  // SWSH alt art non-outlier : 25-45%/an ; SV SIR mascotte OOP : 20-40%/an (projection)
  // Charizard ex SIR 151 (OOP SV) : $90→$410 en <3 ans ≈ 66%/an (réimpression risk)
  } else if (!isModernSV && isSIR && charTierVal === 'S') {
    mult1y = 1.25; mult3y = 1.95; mult5y = 2.98  // 25%/an — mascotte SIR OOP
    horizon = '1-3 ans'; conviction = 'FORTE'
  } else if (!isModernSV && isSIR && charTierVal === 'A') {
    mult1y = 1.14; mult3y = 1.48; mult5y = 1.93  // 14%/an — A-tier SIR OOP
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'
  } else if (!isModernSV && isSIR) {
    mult1y = 1.04; mult3y = 1.12; mult5y = 1.22  // 4%/an — SIR non-mascotte OOP
    horizon = '4-6 ans'; conviction = 'FAIBLE'

  // ── SIR/SAR SV encore en impression ─────────────────────────────
  // Données : en impression active = flat à -5%/an ; attendre OOP avant d'investir
  } else if (isModernSV && isSIR && charTierVal === 'S') {
    mult1y = 0.95; mult3y = 1.28; mult5y = 1.80  // attente OOP ~18 mois puis +25%/an
    horizon = '2-4 ans (attendre fin impression)'; conviction = 'MODÉRÉE'
  } else if (isModernSV && isSIR) {
    mult1y = 0.80; mult3y = 0.92; mult5y = 1.10  // pression impression active
    horizon = '3-5 ans'; conviction = 'FAIBLE'

  // ── Ultra Rare (ex, V, GX, VMAX) hors impression ────────────────
  // Sources : seuls les Charizard/Pikachu Ultra Rare OOP s'apprécient (8-18%/an)
  // Médiane non-mascotte OOP Ultra Rare : -2% à +5%/an
  } else if (!isModernSV && isUltra && charTierVal === 'S') {
    mult1y = 1.10; mult3y = 1.33; mult5y = 1.61  // 10%/an — mascotte Ultra OOP
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'
  } else if (!isModernSV && isUltra) {
    mult1y = 1.01; mult3y = 1.04; mult5y = 1.08  // 2%/an — non-mascotte Ultra OOP (flat)
    horizon = '5+ ans'; conviction = 'FAIBLE'

  // ── Ultra Rare SV encore en impression ──────────────────────────
  } else if (isModernSV && isUltra) {
    mult1y = 0.88; mult3y = 0.96; mult5y = 1.10  // baisse active, horizon incertain
    horizon = '4-6 ans'; conviction = 'FAIBLE'

  // ── Rare Holo / commune / peu commune ───────────────────────────
  // Réalité marché : médiane des cartes modernes perd de la valeur (remplacement par nouveaux sets)
  } else if (isHolo && charTierVal === 'S') {
    mult1y = 1.04; mult3y = 1.12; mult5y = 1.22  // 4%/an — holo mascotte (flat-ish)
    horizon = '3-5 ans'; conviction = 'FAIBLE'
  } else {
    mult1y = 0.82; mult3y = 0.68; mult5y = 0.56  // bulk et cartes sans potentiel
    horizon = 'Non recommandé'; conviction = 'FAIBLE'
  }

  // ── ATH recovery bonus ────────────────────────────────────────────
  // Documenté : cartes de qualité retournent vers l'ATH sur 2-4 ans si fondamentaux intacts
  if (athDropPct > 40 && (isSIR || isVintage || isScarce)) {
    mult1y = Math.min(mult1y * 1.15, 1.45)
    mult3y = Math.min(mult3y * 1.10, 2.80)
  } else if (athDropPct > 20 && (isSIR || isVintage)) {
    mult1y = Math.min(mult1y * 1.07, 1.35)
  }

  // Arrondi réaliste (pas de fausse précision)
  mult1y = +mult1y.toFixed(2)
  mult3y = +mult3y.toFixed(2)
  mult5y = +mult5y.toFixed(2)

  // 10 ans : extrapolation CAGR 5 ans avec plafond réaliste
  // Vintage top-tier : jusqu'à 5x (documenté) ; moderne : 3x max (spéculatif)
  const cagr5 = Math.pow(mult5y, 1 / 5) - 1
  const maxMult10 = isVintage && charTierVal === 'S' ? 5.0 : isVintage ? 3.0 : isScarce ? 3.5 : 2.5
  const mult10 = +Math.min(maxMult10, Math.pow(1 + cagr5, 10)).toFixed(2)

  const t1y  = +(price * mult1y).toFixed(2)
  const t3y  = +(price * mult3y).toFixed(2)
  const t5y  = +(price * mult5y).toFixed(2)
  const t10y = +(price * mult10).toFixed(2)
  const athTarget = ath > price && (isSIR || isVintage) ? +(ath * 1.02).toFixed(2) : null

  return { t1y, t3y, t5y, t10y, athTarget, horizon, conviction, mult1y, mult3y, mult5y, mult10 }
}
