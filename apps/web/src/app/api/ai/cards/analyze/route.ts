import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserTier, isEliteTier } from '@/lib/subscription'

export const runtime = 'nodejs'

// ── Character tiers ──────────────────────────────────────────────────────────
const S_TIER = new Set([
  'dracaufeu','charizard','pikachu','mewtwo','mew','lucario','evoli','eevee',
  'ronflex','snorlax','lugia','ho-oh','rayquaza','arceus','dialga','palkia',
  'giratina','reshiram','zekrom','xerneas','yveltal','solgaleo','lunala',
  'zacian','zamazenta','calyrex','koraidon','miraidon','ectoplasma','gengar',
])
const A_TIER = new Set([
  'ditto','alakazam','dracolosse','dragonite','lokhlass','gyarados','salamèche',
  'charmander','bulbizarre','bulbasaur','carapuce','squirtle','noctali','umbreon',
  'mentali','espeon','nymphali','sylveon','félinferno','incineroar','décidueye',
  'primarina','corvaillus','corviknight','dragapex','regidrago','regieleki',
  'celebi','jirachi','deoxys','darkrai','shaymin','genesect','diancie','volcanion',
])

function charTier(name: string): 'S' | 'A' | 'B' {
  const n = name.toLowerCase()
  if ([...S_TIER].some(c => n.includes(c))) return 'S'
  if ([...A_TIER].some(c => n.includes(c))) return 'A'
  return 'B'
}

// ── Rarity tiers ─────────────────────────────────────────────────────────────
const RARITY_W: Record<string, number> = {
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

function scarcityScore(exId: string, rarity: string): number {
  if (SCARCE_EXACT.has(exId)) return 1.0
  if (VINTAGE_SERIES.has(exId)) return 0.90
  if (['pop','tk-','prswsh','prxy','prsm','np','wc'].some(p => exId.startsWith(p))) return 0.85
  if (rarity === 'PROMO') return 0.65
  return 0
}

// ── Era detection ─────────────────────────────────────────────────────────────
function detectEra(exId: string, series: string | null): 'vintage' | 'old' | 'swsh' | 'sv' | 'modern' {
  if (VINTAGE_SERIES.has(exId)) return 'vintage'
  const s = (series ?? '').toLowerCase()
  if (s.includes('écarlate') || s.includes('scarlet') || exId.startsWith('sv')) return 'sv'
  if (s.includes('épée') || s.includes('sword') || exId.startsWith('swsh')) return 'swsh'
  if (s.includes('xy') || s.includes('sol') || s.includes('sun') || s.includes('lune') || s.includes('moon')) return 'old'
  return 'modern'
}

// ── Real-world comparable explosions ─────────────────────────────────────────
interface Comparable {
  card: string
  from: string
  to: string
  pct: string
  timeframe: string
}

function getComparables(charTierVal: 'S' | 'A' | 'B', rarity: string, era: string, scarce: number): Comparable[] {
  const comps: Comparable[] = []
  const rarityW = RARITY_W[rarity] ?? 0.05
  const isSIR = ['SPECIAL_ILLUSTRATION_RARE','HYPER_RARE','ILLUSTRATION_RARE','RARE_RAINBOW'].includes(rarity)
  const isHolo = rarity.includes('HOLO') || rarity === 'RARE'

  if (era === 'vintage' && charTierVal === 'S') {
    comps.push({ card: 'Dracaufeu Holo Base Set 1ère Éd. (PSA 10)', from: '€15', to: '€420 000', pct: '+2 800 000%', timeframe: '1999→2022' })
    comps.push({ card: 'Pikachu Illustrateur (1998)', from: '€5 000', to: '€5 100 000', pct: '+101 900%', timeframe: '2014→2022' })
    comps.push({ card: 'Mewtwo Holo Base Set 1ère Éd. (PSA 10)', from: '€20', to: '€25 000', pct: '+124 900%', timeframe: '2000→2023' })
  } else if (era === 'vintage') {
    comps.push({ card: 'Dracaufeu Holo Base Set (PSA 10, non 1ère Éd.)', from: '€30', to: '€8 000', pct: '+26 566%', timeframe: '2005→2023' })
    comps.push({ card: 'Lugia Néo Genesis Holo 1ère Éd. (PSA 10)', from: '€40', to: '€35 000', pct: '+87 400%', timeframe: '2002→2023' })
  }

  if (isSIR && charTierVal === 'S') {
    comps.push({ card: 'Dracaufeu ex SIR Flammes Obsidiennes', from: '€3', to: '€280', pct: '+9 233%', timeframe: 'aoû 2023→mai 2024' })
    comps.push({ card: 'Dracaufeu VMAX Alt Art Astres Radieux', from: '€2', to: '€280', pct: '+13 900%', timeframe: '2022→2024' })
  } else if (isSIR && charTierVal === 'A') {
    comps.push({ card: 'Umbreon VMAX Alternate Art Évol. Céleste', from: '€2', to: '€200', pct: '+9 900%', timeframe: '2021→2023' })
    comps.push({ card: 'Glaceon VMAX Alt Art Royaume Glaciaire', from: '€2', to: '€95', pct: '+4 650%', timeframe: '2022→2024' })
  } else if (isSIR) {
    comps.push({ card: 'Lugia V Alt Art Origine Perdue', from: '€2', to: '€130', pct: '+6 400%', timeframe: '2022→2024' })
  }

  if (scarce >= 0.85 && charTierVal === 'S') {
    comps.push({ card: 'Méga-Dracaufeu X promo Méga-Évolution', from: '€25', to: '€280', pct: '+1 020%', timeframe: '2016→2024' })
    comps.push({ card: 'Mew promo Célébrations 25 ans', from: '€0.50', to: '€28', pct: '+5 500%', timeframe: 'oct 2021→2023' })
  } else if (scarce >= 0.85) {
    comps.push({ card: 'Pikachu or 25 ans (Célébrations)', from: '€1', to: '€80', pct: '+7 900%', timeframe: '2021→2023' })
    comps.push({ card: 'Pikachu POP Series 5 holo', from: '€20', to: '€800', pct: '+3 900%', timeframe: '2010→2023' })
  }

  if (isHolo && era === 'swsh' && charTierVal === 'S') {
    comps.push({ card: 'Dracaufeu VSTAR Astres Radieux (rainbow)', from: '€3', to: '€85', pct: '+2 733%', timeframe: '2022→2024' })
  }

  if (comps.length === 0) {
    comps.push({ card: 'Dracaufeu Holo (non 1ère Éd.) (PSA 10)', from: '€30', to: '€8 000', pct: '+26 566%', timeframe: '2005→2023' })
  }

  return comps.slice(0, 3)
}

// ── PSA potential ─────────────────────────────────────────────────────────────
function psaPotential(rarity: string, era: string, charTierVal: 'S' | 'A' | 'B', price: number) {
  const rarityW = RARITY_W[rarity] ?? 0.05
  let psaMultiplier = 1
  let popEstimate = ''
  let worthy = false

  if (era === 'vintage') {
    psaMultiplier = charTierVal === 'S' ? 15 : charTierVal === 'A' ? 8 : 4
    popEstimate = 'PSA 10 pop <500 exemplaires estimés'
    worthy = true
  } else if (rarityW >= 0.85) {
    psaMultiplier = charTierVal === 'S' ? 6 : charTierVal === 'A' ? 4 : 2.5
    popEstimate = 'PSA 10 pop <2 000 exemplaires estimés'
    worthy = price > 20
  } else if (rarityW >= 0.65) {
    psaMultiplier = charTierVal === 'S' ? 3 : 1.8
    popEstimate = 'PSA 10 pop <5 000 exemplaires estimés'
    worthy = price > 40
  } else {
    psaMultiplier = charTierVal === 'S' ? 2 : 1.3
    popEstimate = 'PSA 10 pop >10 000 estimés'
    worthy = price > 80 && charTierVal === 'S'
  }

  return {
    worthy,
    multiplier: psaMultiplier,
    estimatedPsa10: +(price * psaMultiplier).toFixed(0),
    popEstimate,
    recommendation: worthy
      ? `Faire grader cette carte est fortement recommandé. Un PSA 10 se négocierait autour de €${Math.round(price * psaMultiplier).toLocaleString('fr-FR')}.`
      : `Le ratio coût/bénéfice du grading est peu favorable à ce prix de marché.`,
  }
}

// ── Market catalysts ──────────────────────────────────────────────────────────
function detectCatalysts(cardName: string, setName: string | null, era: string): string[] {
  const name = cardName.toLowerCase()
  const catalysts: string[] = []

  if (name.includes('pikachu') || name.includes('dracaufeu') || name.includes('charizard') || name.includes('mewtwo')) {
    catalysts.push('Personnage iconique présent dans chaque nouveau jeu/anime — exposition médiatique permanente')
  }
  if (era === 'vintage') {
    catalysts.push('Vague de nostalgie Gen 1 portée par les Millennials entrant dans leur pic de revenus (30-40 ans)')
    catalysts.push('Certifications PSA/BGS de plus en plus recherchées — marché grading en expansion')
  }
  if (era === 'sv' || era === 'swsh') {
    catalysts.push('Discontinuation imminente du set → supply figé, demande structurelle maintenue')
  }
  catalysts.push('Marché TCG Pokémon en phase d\'institutionnalisation — fonds d\'investissement alternatifs entrent sur ce marché')
  if (name.includes('lugia') || name.includes('ho-oh') || name.includes('rayquaza')) {
    catalysts.push('Légendale — demand cross-générationnel, popularité stable depuis 25+ ans')
  }

  return catalysts.slice(0, 4)
}

// ── Price targets (ambitieux mais fondés) ─────────────────────────────────────
function buildTargets(price: number, ath: number, charTierVal: 'S' | 'A' | 'B', rarityW: number, scarce: number, era: string, athDropPct: number) {
  const isSIR = rarityW >= 0.85
  const isVintage = era === 'vintage'

  let mult1y = 1.15
  let mult3y = 1.4
  let mult5y = 1.8
  let horizon = '6-12 mois'
  let conviction: 'FORTE' | 'MODÉRÉE' | 'FAIBLE' = 'MODÉRÉE'

  if (isVintage && charTierVal === 'S') {
    mult1y = 1.5; mult3y = 3.5; mult5y = 7
    horizon = '3-5 ans'; conviction = 'FORTE'
  } else if (isVintage && charTierVal === 'A') {
    mult1y = 1.3; mult3y = 2.5; mult5y = 5
    horizon = '3-5 ans'; conviction = 'FORTE'
  } else if (isVintage) {
    mult1y = 1.2; mult3y = 2; mult5y = 3.5
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'
  } else if (isSIR && charTierVal === 'S') {
    mult1y = 1.6; mult3y = 3; mult5y = 5
    horizon = '1-3 ans'; conviction = 'FORTE'
  } else if (isSIR && charTierVal === 'A') {
    mult1y = 1.4; mult3y = 2.5; mult5y = 4
    horizon = '1-3 ans'; conviction = 'FORTE'
  } else if (isSIR) {
    mult1y = 1.2; mult3y = 2; mult5y = 3
    horizon = '2-4 ans'; conviction = 'MODÉRÉE'
  } else if (scarce >= 0.85 && charTierVal === 'S') {
    mult1y = 1.5; mult3y = 2.8; mult5y = 5
    horizon = '1-2 ans'; conviction = 'FORTE'
  } else if (charTierVal === 'S') {
    mult1y = 1.25; mult3y = 2; mult5y = 3
    horizon = '1-2 ans'; conviction = 'MODÉRÉE'
  } else if (charTierVal === 'A') {
    mult1y = 1.15; mult3y = 1.7; mult5y = 2.5
    horizon = '2-3 ans'; conviction = 'MODÉRÉE'
  } else {
    mult1y = 1.1; mult3y = 1.4; mult5y = 1.8
    horizon = '3-5 ans'; conviction = 'FAIBLE'
  }

  // ATH recovery boost
  if (athDropPct > 40) { mult1y *= 1.2; mult3y *= 1.15 }
  else if (athDropPct > 20) { mult1y *= 1.1 }

  const t1y  = +(price * mult1y).toFixed(2)
  const t3y  = +(price * mult3y).toFixed(2)
  const t5y  = +(price * mult5y).toFixed(2)
  const athTarget = ath > price ? +(ath * 1.05).toFixed(2) : null

  return { t1y, t3y, t5y, athTarget, horizon, conviction, mult1y, mult3y, mult5y }
}

// ── Narrative generation ──────────────────────────────────────────────────────
function buildNarrative(
  name: string, setName: string | null, charTierVal: 'S' | 'A' | 'B',
  era: string, scarce: number, rarityW: number, price: number,
  targets: ReturnType<typeof buildTargets>, psa: ReturnType<typeof psaPotential>
): string {
  const isSIR = rarityW >= 0.85
  const isVintage = era === 'vintage'
  const charLabel = charTierVal === 'S' ? 'Tier S' : charTierVal === 'A' ? 'Tier A' : 'standard'

  let narrative = ''

  if (isVintage && charTierVal === 'S') {
    narrative = `${name} est un actif de collection de classe mondiale. Les cartes vintage de personnages Tier S sont les équivalents Pokémon des montres Patek Philippe ou des vins grands crus — leur valeur est fondée sur une rareté absolue et une demande trans-générationnelle qui ne faiblit pas. À ${era === 'vintage' ? 'l\'ère actuelle' : 'ce stade'}, les exemplaires en excellent état se font de plus en plus rares sur le marché. Notre projection à 5 ans de €${targets.t5y.toLocaleString('fr-FR')} représente un multiple de ${targets.mult5y}x sur le prix actuel, cohérent avec les performances historiques de cartes comparables.`
  } else if (isSIR && charTierVal === 'S') {
    narrative = `${name} cumule deux avantages structurels majeurs : un personnage de rang S avec une demande mondiale permanente, et une rareté de type SIR dont le tirage moyen est d'1 exemplaire pour 180-200 boosters. Cette combinaison crée un déséquilibre offre/demande durable. Les SIR Dracaufeu comparables ont multiplié leur valeur par 8 à 15x dans les 18-24 mois suivant leur sortie. Notre cible à 3 ans de €${targets.t3y.toLocaleString('fr-FR')} est conservatrice.`
  } else if (scarce >= 0.85 && charTierVal === 'S') {
    narrative = `${name} provient d'un set/coffret discontinué dont le stock est définitivement figé. La demande pour ce personnage iconique est structurelle et permanente, tandis que l'offre ne peut qu'éroder avec le temps (cartes endommagées, perdues, gradées). C'est la définition d'un actif à offre décroissante face à une demande croissante. Horizon recommandé : ${targets.horizon}.`
  } else if (charTierVal === 'S') {
    narrative = `${name} est un personnage de référence du TCG Pokémon avec une liquidité élevée et une demande structurelle. Même sans rareté extrême, la demande internationale pour ce personnage soutient une trajectoire haussière régulière. L'entrée à ce niveau de prix représente un point de départ raisonnable avec un potentiel de €${targets.t3y.toLocaleString('fr-FR')} à 3 ans.`
  } else {
    narrative = `${name} présente un profil d'investissement ${charTierVal === 'A' ? 'solide avec un personnage reconnu et une rareté correcte' : 'spéculatif, à réserver aux connaisseurs du set'}. Le potentiel de revalorisation est réel mais nécessite patience et bonne compréhension du marché.`
  }

  if (psa.worthy) {
    narrative += ` Le grading PSA/BGS est fortement recommandé — un PSA 10 pourrait se négocier autour de €${psa.estimatedPsa10.toLocaleString('fr-FR')} (×${psa.multiplier} vs brut).`
  }

  return narrative
}

// ── Main signals builder ──────────────────────────────────────────────────────
function buildSignals(
  charTierVal: 'S' | 'A' | 'B', rarityW: number, scarce: number, era: string,
  price: number, ath: number, athDropPct: number,
  change7d: number, change30d: number, vol30d: number, rsi: number | null,
  name: string
) {
  const bullish: string[] = []
  const bearish: string[] = []
  const isSIR = rarityW >= 0.85

  // Char tier
  if (charTierVal === 'S') bullish.push(`${name.split(' ')[0]} : personnage Tier S — demande mondiale permanente depuis 25 ans, impossible à créer ex nihilo`)
  else if (charTierVal === 'A') bullish.push(`Personnage Tier A — audience fidèle et demande cross-générationelle`)

  // Rarity
  if (isSIR) bullish.push(`SIR/Hyper Rare : 1 exemplaire pour ~200 boosters en moyenne — offre structurellement limitée`)
  else if (rarityW >= 0.65) bullish.push(`Rareté élevée (${rarityW >= 0.65 ? 'VMAX/VSTAR/GX' : 'Rare Holo'}) — tirage limité par design`)

  // Scarcity
  if (scarce >= 0.85) bullish.push(`Set/coffret discontinué définitivement — supply figé, seule la demande évolue`)
  else if (scarce >= 0.65) bullish.push(`Tirage promotionnel ou limité — reproductibilité nulle`)

  // Era
  if (era === 'vintage') bullish.push(`Carte vintage (+15 ans) — usure naturelle réduit le stock de qualité grade chaque année`)

  // Technical
  if (athDropPct > 35) bullish.push(`${athDropPct}% sous son ATH historique (€${ath.toFixed(0)}) — fenêtre d'entrée attractive`)
  else if (athDropPct > 15) bullish.push(`Décote de ${athDropPct}% vs ATH — potentiel de récupération solide`)
  if (change7d > 3) bullish.push(`+${change7d.toFixed(1)}% sur 7 jours — momentum haussier confirmé`)
  if (change30d > 8) bullish.push(`+${change30d.toFixed(1)}% sur 30 jours — tendance de fond positive`)
  if (rsi !== null && rsi < 35) bullish.push(`RSI ${rsi.toFixed(0)} : zone de survente technique — rebond statistiquement probable`)
  if (vol30d < 12) bullish.push(`Faible volatilité (${vol30d.toFixed(0)}%) — prix stable, achat sans précipitation possible`)

  // Bearish
  if (change7d < -8) bearish.push(`-${Math.abs(change7d).toFixed(1)}% sur 7 jours — pression vendeuse à court terme`)
  if (vol30d > 35) bearish.push(`Volatilité élevée (${vol30d.toFixed(0)}%) — timing d'entrée critique`)
  if (rsi !== null && rsi > 72) bearish.push(`RSI ${rsi.toFixed(0)} : zone de surachat — attendre une consolidation`)
  if (price >= ath && ath > 0) bearish.push(`Prix au niveau ATH — upside limité à court terme, risque de correction`)
  if (charTierVal === 'B') bearish.push(`Personnage hors top-tier — liquidité réduite, revente plus difficile`)
  if (!isSIR && rarityW < 0.4) bearish.push(`Rareté modeste — peu de défenses contre une offre abondante`)
  bearish.push(`Risque macro TCG : une correction générale du marché affecterait toutes les raretés`)

  return {
    bullish: bullish.slice(0, 5),
    bearish: bearish.slice(0, 4),
  }
}

// ── Main handler ──────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Connexion requise', requiresAuth: true }, { status: 401 })

  const tier = await getUserTier(clerkId)
  if (!isEliteTier(tier)) return NextResponse.json({ error: 'Elite requis', requiresElite: true }, { status: 403 })

  const cardId = new URL(req.url).searchParams.get('cardId')
  if (!cardId) return NextResponse.json({ error: 'cardId requis' }, { status: 400 })

  const card = await prisma.card.findUnique({
    where: { id: cardId },
    include: {
      set: { select: { name: true, externalId: true, series: true, releaseDate: true } },
      prices: { where: { source: 'cardmarket' }, select: { market: true, low: true, high: true } },
      marketData: true,
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 90, select: { price: true, recordedAt: true } },
    },
  })

  if (!card) return NextResponse.json({ error: 'Carte introuvable' }, { status: 404 })

  const price     = Number(card.prices?.[0]?.market ?? 0)
  const md        = card.marketData
  const ath       = md?.allTimeHigh ? Number(md.allTimeHigh) : price
  const atl       = md?.allTimeLow  ? Number(md.allTimeLow)  : price
  const change7d  = md?.priceChange7d  ? Number(md.priceChange7d)  : 0
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const vol30d    = md?.volatility30d  ? Number(md.volatility30d)  : 0
  const rsi       = md?.rsi14 ? Number(md.rsi14) : null
  const rarityW   = RARITY_W[card.rarity] ?? 0.05
  const exId      = card.set?.externalId ?? ''
  const scarce    = scarcityScore(exId, card.rarity)
  const era       = detectEra(exId, card.set?.series ?? null)
  const charTierVal = charTier(card.name)
  const athDropPct  = ath > price ? +(((ath - price) / ath) * 100).toFixed(1) : 0
  const investScore = md?.investmentScore ?? 0

  const comparables = getComparables(charTierVal, card.rarity, era, scarce)
  const psa         = psaPotential(card.rarity, era, charTierVal, price)
  const targets     = buildTargets(price, ath, charTierVal, rarityW, scarce, era, athDropPct)
  const catalysts   = detectCatalysts(card.name, card.set?.name ?? null, era)
  const { bullish, bearish } = buildSignals(charTierVal, rarityW, scarce, era, price, ath, athDropPct, change7d, change30d, vol30d, rsi, card.name)
  const narrative   = buildNarrative(card.name, card.set?.name ?? null, charTierVal, era, scarce, rarityW, price, targets, psa)

  return NextResponse.json({
    card: { id: card.id, name: card.name, rarity: card.rarity, number: card.number, imageSmUrl: card.imageSmUrl, set: card.set },
    analysis: {
      // Scores
      investmentScore: investScore,
      investmentLabel: targets.conviction === 'FORTE' ? 'Excellent' : targets.conviction === 'MODÉRÉE' ? 'Bon' : 'Moyen',
      conviction: targets.conviction,
      charTier: charTierVal,
      rarityScore: +(rarityW * 100).toFixed(0),
      scarcityScore: +(scarce * 100).toFixed(0),
      era,

      // Prices
      price, ath, atl, athDropPct,
      change7d:  +change7d.toFixed(2),
      change30d: +change30d.toFixed(2),
      volatility30d: +vol30d.toFixed(2),
      rsi: rsi ? +rsi.toFixed(1) : null,
      riskLevel: vol30d > 35 ? 'Élevé' : vol30d > 20 ? 'Modéré' : 'Faible',

      // Targets
      horizon: targets.horizon,
      targetLow:  targets.t1y,
      targetHigh: targets.t3y,
      target1y:   targets.t1y,
      target3y:   targets.t3y,
      target5y:   targets.t5y,
      athTarget:  targets.athTarget,
      mult1y: targets.mult1y,
      mult3y: targets.mult3y,
      mult5y: targets.mult5y,

      // Analysis
      bullish,
      bearish,
      narrative,
      comparables,
      catalysts,
      psa,

      priceHistory: card.priceHistory.map(h => ({ price: Number(h.price), date: h.recordedAt })).reverse(),
    },
  })
}
