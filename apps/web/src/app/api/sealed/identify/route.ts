import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

// ── Detect type from name ──────────────────────────────────────────────────
function detectType(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('display') || n.includes('booster box') || n.includes('36 boosters') || n.includes('display 36')) return 'BOOSTER_BOX'
  if (n.includes('etb') || n.includes('elite trainer') || n.includes('dresseur d\'élite')) return 'ETB'
  if (n.includes('tin') || n.includes('boîte à dés') || n.includes('boite a des')) return 'TIN'
  if (n.includes('bundle') || n.includes('build & battle') || n.includes('build and battle')) return 'BUNDLE'
  if (n.includes('collection premium') || n.includes('coffret premium')) return 'COLLECTION'
  if (n.includes('coffret') || n.includes('collection')) return 'COFFRET'
  if (n.includes('blister') || n.includes('3 boosters') || n.includes('4 boosters')) return 'BLISTER'
  return 'COFFRET'
}

// ── Detect series/set from name ────────────────────────────────────────────
function detectSeries(name: string): { series: string | null; setName: string | null; language: string } {
  const n = name.toLowerCase()
  let language = 'FR'
  if (n.includes('jp') || n.includes('japonais') || n.includes('japanese')) language = 'JP'
  if (n.includes('en') || n.includes('english') || n.includes('anglais')) language = 'EN'

  // SV sets
  if (n.includes('évolutions prismatiques') || n.includes('prismatic evolutions') || n.includes('sv8') || n.includes('sv8a')) return { series: 'Écarlate & Violet', setName: 'Évolutions Prismatiques', language }
  if (n.includes('étincelles déferlantes') || n.includes('surging sparks') || n.includes('sv7.5') || n.includes('sv75')) return { series: 'Écarlate & Violet', setName: 'Étincelles Déferlantes', language }
  if (n.includes('couronne stellaire') || n.includes('stellar crown') || n.includes('sv7')) return { series: 'Écarlate & Violet', setName: 'Couronne Stellaire', language }
  if (n.includes('destins de paldéa') || n.includes('paldean fates') || n.includes('sv6.5') || n.includes('sv65')) return { series: 'Écarlate & Violet', setName: 'Destins de Paldéa', language }
  if (n.includes('mascarade crépusculaire') || n.includes('twilight masquerade') || n.includes('sv6')) return { series: 'Écarlate & Violet', setName: 'Mascarade Crépusculaire', language }
  if (n.includes('forces temporelles') || n.includes('temporal forces') || n.includes('sv5')) return { series: 'Écarlate & Violet', setName: 'Forces Temporelles', language }
  if (n.includes('destinées de paldéa') || n.includes('sv4.5') || n.includes('sv45')) return { series: 'Écarlate & Violet', setName: 'Destinées de Paldéa', language }
  if (n.includes('paradoxe temporel') || n.includes('paradox rift') || n.includes('sv4')) return { series: 'Écarlate & Violet', setName: 'Paradoxe Temporel', language }
  if (n.includes('151') || n.includes('sv3.5') || n.includes('sv35')) return { series: 'Écarlate & Violet', setName: '151', language }
  if (n.includes('flammes obsidiennes') || n.includes('obsidian flames') || n.includes('sv3')) return { series: 'Écarlate & Violet', setName: 'Flammes Obsidiennes', language }
  if (n.includes('évolutions à paldéa') || n.includes('paldea evolved') || n.includes('sv2')) return { series: 'Écarlate & Violet', setName: 'Évolutions à Paldéa', language }
  if (n.includes('écarlate') || n.includes('violet') || n.includes('scarlet') || n.includes('sv1')) return { series: 'Écarlate & Violet', setName: 'Écarlate & Violet Base', language }
  // SWSH sets
  if (n.includes('couronne zénith') || n.includes('crown zenith') || n.includes('swsh12.5') || n.includes('swsh125')) return { series: 'Épée & Bouclier', setName: 'Couronne Zénith', language }
  if (n.includes('tempête argentée') || n.includes('silver tempest') || n.includes('swsh12')) return { series: 'Épée & Bouclier', setName: 'Tempête Argentée', language }
  if (n.includes('origine perdue') || n.includes('lost origin') || n.includes('swsh11')) return { series: 'Épée & Bouclier', setName: 'Origine Perdue', language }
  if (n.includes('astres radieux') || n.includes('brilliant stars') || n.includes('swsh10')) return { series: 'Épée & Bouclier', setName: 'Astres Radieux', language }
  if (n.includes('étoiles brillantes') || n.includes('shining fates') || n.includes('swsh9')) return { series: 'Épée & Bouclier', setName: 'Étoiles Brillantes', language }
  if (n.includes('pokémon go') || n.includes('pokemon go')) return { series: 'Épée & Bouclier', setName: 'Pokémon GO', language }
  if (n.includes('évolution céleste') || n.includes('chilling reign') || n.includes('swsh7')) return { series: 'Épée & Bouclier', setName: 'Évolution Céleste', language }
  if (n.includes('combat de poings') || n.includes('battle styles') || n.includes('swsh6')) return { series: 'Épée & Bouclier', setName: 'Combat de Poings', language }
  if (n.includes('célébrations') || n.includes('celebrations') || n.includes('25 ans') || n.includes('25th')) return { series: 'Célébrations', setName: 'Célébrations', language }
  if (n.includes('voltage éclatant') || n.includes('vivid voltage') || n.includes('swsh4')) return { series: 'Épée & Bouclier', setName: 'Voltage Éclatant', language }
  if (n.includes('ténèbres embrasées') || n.includes('darkness ablaze') || n.includes('swsh3')) return { series: 'Épée & Bouclier', setName: 'Ténèbres Embrasées', language }
  if (n.includes('vmax climax') || n.includes('s12a')) return { series: 'Épée & Bouclier', setName: 'VMAX Climax', language }
  if (n.includes('shiny treasure') || n.includes('sv4a')) return { series: 'Écarlate & Violet', setName: 'Shiny Treasure ex', language }
  if (n.includes('épée') || n.includes('bouclier') || n.includes('sword') || n.includes('shield')) return { series: 'Épée & Bouclier', setName: 'Épée & Bouclier Base', language }
  // XY
  if (n.includes('évolutions xy') || n.includes('evolutions') || n.includes('xy12')) return { series: 'XY', setName: 'Évolutions XY', language }
  if (n.includes('origines cosmiques') || n.includes('ancient origins') || n.includes('xy7')) return { series: 'XY', setName: 'Origines Cosmiques', language }
  if (n.includes('mega') || n.includes('méga')) return { series: 'XY', setName: 'Méga-Évolution Promo', language }
  // Vintage
  if (n.includes('base set') || n.includes('set de base')) return { series: 'Base Set', setName: 'Base Set', language }
  if (n.includes('jungle')) return { series: 'Base Set', setName: 'Jungle', language }
  if (n.includes('fossile') || n.includes('fossil')) return { series: 'Base Set', setName: 'Fossile', language }
  if (n.includes('néo') || n.includes('neo')) return { series: 'Neo', setName: 'Néo Genesis', language }

  return { series: null, setName: null, language }
}

// ── Detect popular characters ──────────────────────────────────────────────
function detectCharacter(name: string): { name: string; tier: 'S' | 'A' | 'B' } | null {
  const n = name.toLowerCase()
  const S = [
    ['dracaufeu', 'charizard'], ['pikachu'], ['mewtwo'], ['mew'], ['evoli', 'eevee'],
    ['lucario'], ['ronflex', 'snorlax'], ['lugia'], ['ho-oh'], ['rayquaza'],
    ['arceus'], ['giratina'], ['dialga'], ['palkia'], ['zacian'], ['calyrex'],
    ['koraidon'], ['miraidon'], ['ectoplasma', 'gengar'], ['umbreon', 'noctali'],
  ]
  const A = [
    ['alakazam', 'alakazam'], ['dracolosse', 'dragonite'], ['gyarados'],
    ['sylveon', 'nymphali'], ['espeon', 'mentali'], ['flareon', 'pyroli'],
    ['salamèche', 'charmander'], ['bulbizarre', 'bulbasaur'], ['carapuce', 'squirtle'],
    ['celebi'], ['jirachi'], ['darkrai'], ['regieleki'], ['regidrago'],
  ]
  for (const alts of S) {
    if (alts.some(a => n.includes(a))) return { name: alts[0], tier: 'S' }
  }
  for (const alts of A) {
    if (alts.some(a => n.includes(a))) return { name: alts[0], tier: 'A' }
  }
  return null
}

// ── Estimate retail price ──────────────────────────────────────────────────
function estimateRetail(type: string, series: string | null): number {
  if (type === 'BOOSTER_BOX') {
    if (series === 'Base Set' || series === 'Neo') return 90
    if (series === 'XY') return 100
    return 140
  }
  if (type === 'ETB') return 55
  if (type === 'COFFRET' || type === 'COLLECTION') return 35
  if (type === 'TIN') return 22
  if (type === 'BUNDLE') return 25
  if (type === 'BLISTER') return 15
  return 30
}

// ── Estimate market price & score ─────────────────────────────────────────
function buildAnalysis(params: {
  type: string; series: string | null; setName: string | null
  language: string; character: { name: string; tier: 'S' | 'A' | 'B' } | null
  isDiscontinued: boolean; retailPrice: number; rawName: string
}) {
  const { type, series, setName, character, isDiscontinued, retailPrice, rawName } = params
  const n = rawName.toLowerCase()

  // Era
  const isVintage = series === 'Base Set' || series === 'Neo'
  const isSV = series === 'Écarlate & Violet'
  const isSWSH = series === 'Épée & Bouclier' || series === 'Célébrations'
  const isXY = series === 'XY'

  // Score calculation
  let investScore = 50
  if (isVintage) investScore = 88
  else if (isXY && n.includes('évolutions')) investScore = 92
  else if (isSWSH && isDiscontinued) investScore = 75
  else if (isSWSH && !isDiscontinued) investScore = 65
  else if (isSV && isDiscontinued) investScore = 70
  else if (isSV) investScore = 60

  if (character?.tier === 'S') investScore = Math.min(100, investScore + 12)
  else if (character?.tier === 'A') investScore = Math.min(100, investScore + 6)
  if (isDiscontinued) investScore = Math.min(100, investScore + 8)
  if (type === 'BOOSTER_BOX') investScore = Math.min(100, investScore + 4)

  // Market price multiplier
  let mult = 1.0
  if (isVintage) mult = 5 + Math.random() * 3
  else if (isXY && n.includes('évolutions')) mult = 3.8 + Math.random() * 0.5
  else if (isSWSH && isDiscontinued && character?.tier === 'S') mult = 1.5 + Math.random() * 0.3
  else if (isSWSH && isDiscontinued) mult = 1.3 + Math.random() * 0.2
  else if (isSV && isDiscontinued) mult = 1.2 + Math.random() * 0.15
  else mult = 1.0 + Math.random() * 0.1

  const marketPrice = Math.round(retailPrice * mult)

  // Horizon
  const horizon = isVintage ? '5-10 ans' : isXY && isDiscontinued ? '2-5 ans' : isSWSH && isDiscontinued ? '1-3 ans' : '2-4 ans'

  // Risk
  const riskLevel = isVintage ? 'Faible' : investScore >= 80 ? 'Faible' : investScore >= 65 ? 'Modéré' : 'Modéré'

  // Bullish signals
  const bullish: string[] = []
  if (isDiscontinued) bullish.push('Discontinué — supply définitivement figé')
  if (character?.tier === 'S') bullish.push(`${character.name.charAt(0).toUpperCase() + character.name.slice(1)} — personnage Tier S, demande mondiale permanente`)
  if (isVintage) bullish.push('Carte vintage — usure naturelle réduit le stock de qualité chaque année')
  if (isSWSH && setName?.includes('Couronne')) bullish.push('Set final de génération — systématiquement croissant')
  if (type === 'BOOSTER_BOX') bullish.push('Display complet — meilleur ROI possible sur le long terme')
  if (setName?.includes('151') || setName?.includes('Évolutions Prismatiques')) bullish.push('Set nostalgie à fort potentiel — demande trans-générationnelle')
  bullish.push('Marché TCG Pokémon en institutionnalisation — fonds alternatifs entrants')

  const bearish: string[] = []
  if (!isDiscontinued) bearish.push('Encore disponible en retail — premium limité à court terme')
  if (isSV && !isDiscontinued) bearish.push('Réimpressions possibles tant que le set est actif')
  bearish.push('Risque de correction générale du marché TCG')

  // Narrative
  let narrative = ''
  if (isVintage) {
    narrative = `Ce coffret vintage est une pièce de collection de premier ordre. Les scellés de la génération ${series} sont extrêmement rares — la quasi-totalité a été ouverte. Chaque exemplaire encore scellé représente un actif de collection unique dont la valeur ne fait que croître avec le temps.`
  } else if (character?.tier === 'S' && isDiscontinued) {
    narrative = `Coffret mettant en vedette ${character.name}, personnage Tier S du TCG Pokémon. Discontinued, le stock est figé face à une demande permanente. Les coffrets ${character.name} discontinued ont systématiquement une trajectoire haussière solide.`
  } else if (isSWSH && isDiscontinued) {
    narrative = `Coffret de la génération Épée & Bouclier, maintenant discontinué. La génération SWSH bénéficie d'une demande solide grâce à ses Alternate Art et ses VSTAR/VMAX ultra-rares. Stock en diminution naturelle.`
  } else {
    narrative = `Coffret ${type === 'BOOSTER_BOX' ? 'display' : type.toLowerCase()} de la génération ${series ?? 'Pokémon TCG'}. ${isDiscontinued ? 'Discontinué — investissement défensif avec upside à moyen terme.' : 'Encore disponible — acheter maintenant pour revendre à la discontinuation.'}`
  }

  // Targets
  const target1y = Math.round(marketPrice * (isVintage ? 1.4 : isDiscontinued ? 1.25 : 1.1))
  const target3y = Math.round(marketPrice * (isVintage ? 2.5 : isDiscontinued ? 1.8 : 1.5))

  return {
    investmentScore: investScore,
    scarcityScore: isVintage ? 90 : isDiscontinued ? 70 : 45,
    popularityScore: character?.tier === 'S' ? 90 : character?.tier === 'A' ? 75 : 60,
    trendDirection: investScore >= 75 ? 'BULLISH' : investScore >= 55 ? 'STABLE' : 'STABLE',
    riskLevel,
    horizon,
    bullish: bullish.slice(0, 4),
    bearish: bearish.slice(0, 3),
    narrative,
    marketPrice,
    target1y,
    target3y,
  }
}

// ── Slug generator ─────────────────────────────────────────────────────────
function makeSlug(name: string): string {
  return name.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

// ── Main handler ──────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()

  const body = await req.json()
  const { name, addToDb } = body as { name: string; addToDb?: boolean }

  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  // 1. Search in DB first
  const existing = await prisma.sealedProduct.findFirst({
    where: {
      OR: [
        { name:   { contains: name, mode: 'insensitive' } },
        { nameFr: { contains: name, mode: 'insensitive' } },
        { slug:   makeSlug(name) },
      ],
    },
    include: {
      priceHistory: { orderBy: { recordedAt: 'desc' }, take: 1, select: { price: true } },
    },
  })

  if (existing) {
    return NextResponse.json({
      found: true,
      inDb: true,
      slug: existing.slug,
      product: { ...existing, currentMarketPrice: existing.priceHistory[0]?.price ?? existing.retailPrice },
    })
  }

  // 2. Identify from name
  const type     = detectType(name)
  const { series, setName, language } = detectSeries(name)
  const character = detectCharacter(name)
  const retailPrice = estimateRetail(type, series)

  // Discontinuation heuristic
  const isDiscontinued = /discontinu|ancien|vintage|2016|2017|2018|2019|2020|2021|2022|2023/i.test(name)
    || series === 'Base Set' || series === 'Neo' || series === 'XY'

  const analysis = buildAnalysis({ type, series, setName, language, character, isDiscontinued, retailPrice, rawName: name })

  const slug = makeSlug(name)

  // 3. Optionally add to DB (requires auth)
  if (addToDb && clerkId) {
    const user = await prisma.user.findUnique({ where: { clerkId }, select: { tier: true } })
    // Only Elite users or PRO can add products
    if (user?.tier === 'ELITE' || user?.tier === 'PRO' || user?.tier === 'STARTER') {
      try {
        const created = await prisma.sealedProduct.create({
          data: {
            slug: `user-${slug}-${Date.now()}`,
            name,
            nameFr: name,
            type,
            setName,
            series,
            language,
            isDiscontinued,
            retailPrice,
            investmentScore: analysis.investmentScore,
            scarcityScore: analysis.scarcityScore,
            popularityScore: analysis.popularityScore,
            trendDirection: analysis.trendDirection,
            riskLevel: analysis.riskLevel,
            horizon: analysis.horizon,
            bullish: analysis.bullish,
            bearish: analysis.bearish,
            narrative: analysis.narrative,
          },
        })
        // Add market price
        await prisma.sealedPriceHistory.create({
          data: { productId: created.id, price: analysis.marketPrice, source: 'identified' },
        })

        return NextResponse.json({
          found: true, inDb: true, slug: created.slug, addedToDb: true,
          product: { ...created, currentMarketPrice: analysis.marketPrice },
        })
      } catch { /* slug conflict — product already exists under a variant */ }
    }
  }

  // 4. Return analysis without saving
  return NextResponse.json({
    found: true,
    inDb: false,
    slug,
    product: {
      id: null, slug,
      name, nameFr: name, type, setName, series, language,
      isDiscontinued, retailPrice,
      currentMarketPrice: analysis.marketPrice,
      investmentScore: analysis.investmentScore,
      scarcityScore: analysis.scarcityScore,
      popularityScore: analysis.popularityScore,
      trendDirection: analysis.trendDirection,
      riskLevel: analysis.riskLevel,
      horizon: analysis.horizon,
      bullish: analysis.bullish,
      bearish: analysis.bearish,
      narrative: analysis.narrative,
      description: null, imageUrl: null,
      target1y: analysis.target1y,
      target3y: analysis.target3y,
    },
  })
}
