// Seed script — coffrets scellés Pokémon TCG (marché français)
// Run: node scripts/seed-sealed-products.mjs
// Prix marché = données Cardmarket / Vinted / eBay FR (2025)

import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// ── Helpers ──────────────────────────────────────────────────────────────────
const now = new Date()
const d = (y, m, day) => new Date(y, m - 1, day)

// tirage estimé (exemplaires FR) par type de produit
function tirage(type, series, discontinued) {
  if (type === 'BOOSTER_BOX') {
    if (series === 'Écarlate & Violet') return '~250 000–400 000 displays imprimés en FR'
    if (series === 'Épée & Bouclier') return '~180 000–280 000 displays imprimés en FR'
    if (series === 'XY') return '~80 000–150 000 displays imprimés en FR'
    if (series === 'Base Set' || series === 'Neo') return '~5 000–20 000 displays estimés encore scellés en FR'
    return '~100 000–200 000 displays imprimés en FR'
  }
  if (type === 'ETB') return '~80 000–150 000 ETB imprimés en FR'
  if (type === 'COFFRET') return '~30 000–80 000 coffrets imprimés en FR'
  if (type === 'TIN') return '~50 000–120 000 tins imprimés en FR'
  if (type === 'BUNDLE') return '~20 000–50 000 bundles imprimés'
  return '~50 000–100 000 unités imprimées en FR'
}

// ── Catalogue complet ─────────────────────────────────────────────────────────
const PRODUCTS = [

  // ══════════════════════════════════════════════════════════════════════
  // ÉCARLATE & VIOLET — SV (2023–2025)
  // ══════════════════════════════════════════════════════════════════════

  // SV8.5 — Évolutions Prismatiques (Prismatic Evolutions) — ★ LE PLUS CHAUD
  {
    slug: 'display-evolutions-prismatiques-sv8a',
    name: 'Booster Box Évolutions Prismatiques', nameFr: 'Display Évolutions Prismatiques SV8.5',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Évolutions Prismatiques', language: 'FR',
    releaseDate: d(2025, 1, 17), isDiscontinued: false, retailPrice: 140, marketPrice: 320,
    investmentScore: 96, scarcityScore: 85, popularityScore: 100,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-3 ans',
    bullish: ['Rupture de stock mondiale dès le lancement', 'Évolutions Évoli — toutes les 8 évolutions en SIR', 'Set le plus demandé de l\'histoire de SV', 'Prix marché 2.3x le retail dès J+7'],
    bearish: ['Encore imprimé — nouvelles vagues possibles', 'Prix très élevé à l\'entrée'],
    narrative: 'Évolutions Prismatiques est le phénomène de 2025. Le set dédie des SIR à toutes les évolutions d\'Évoli, ce qui en fait l\'objet de désir absolu pour une génération entière de collectionneurs. Le display est introuvable au retail et se revend déjà 2.3x son prix conseillé. Les analystes comparent ce lancement à celui d\'Évolutions XY en 2016 — un set qui s\'échange aujourd\'hui 4x son retail. Horizon 3 ans : ×4 minimum sur le prix actuel si le set est discontinué.',
    imageUrl: null,
  },
  {
    slug: 'etb-evolutions-prismatiques-sv8a',
    name: 'Elite Trainer Box Évolutions Prismatiques', nameFr: 'ETB Évolutions Prismatiques',
    type: 'ETB', series: 'Écarlate & Violet', setName: 'Évolutions Prismatiques', language: 'FR',
    releaseDate: d(2025, 1, 17), isDiscontinued: false, retailPrice: 55, marketPrice: 175,
    investmentScore: 94, scarcityScore: 85, popularityScore: 100,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-3 ans',
    bullish: ['Impossible à trouver au retail', 'Marché secondaire : 3.2x le retail', 'Toutes les évolutions Évoli en SIR', 'ETB le plus demandé de la décennie'],
    bearish: ['Réimpressions potentielles si demande maintenue'],
    narrative: 'L\'ETB Évolutions Prismatiques se revend déjà €175 pour un retail à €55. Les ETB de sets à forte demande tendent à multiplier leur valeur par 3-5x à la discontinuation. Comparable : ETB Couronne Zénith (retail €55 → marché €110 après discontinuation).',
    imageUrl: null,
  },

  // SV7.5 — Étincelles Déferlantes (Surging Sparks)
  {
    slug: 'display-etincelles-deferlantes-sv75',
    name: 'Booster Box Étincelles Déferlantes', nameFr: 'Display Étincelles Déferlantes SV7.5',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Étincelles Déferlantes', language: 'FR',
    releaseDate: d(2024, 11, 8), isDiscontinued: false, retailPrice: 140, marketPrice: 155,
    investmentScore: 75, scarcityScore: 50, popularityScore: 82,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '2-4 ans',
    bullish: ['Pikachu ex SIR très populaire', 'Rayquaza, Raichu Alt Art', 'Set récent à fort potentiel futur'],
    bearish: ['Encore disponible en retail', 'Premium marché faible pour l\'instant'],
    narrative: 'Étincelles Déferlantes est un set solide centré sur Pikachu et les Pokémon électriques. Pas encore de premium significatif, mais la présence d\'une SIR Pikachu garantit une demande durable. À accumuler progressivement au retail.',
    imageUrl: null,
  },
  {
    slug: 'etb-etincelles-deferlantes-sv75',
    name: 'Elite Trainer Box Étincelles Déferlantes', nameFr: 'ETB Étincelles Déferlantes',
    type: 'ETB', series: 'Écarlate & Violet', setName: 'Étincelles Déferlantes', language: 'FR',
    releaseDate: d(2024, 11, 8), isDiscontinued: false, retailPrice: 55, marketPrice: 58,
    investmentScore: 68, scarcityScore: 45, popularityScore: 80,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '2-4 ans',
    bullish: ['Pikachu SIR dans le set', 'ETB à accumuler avant discontinuation'],
    bearish: ['Pas de premium actuellement', 'Encore très disponible'],
    narrative: 'ETB à acheter maintenant au retail. La valeur décollera à la discontinuation, notamment grâce à la présence de Pikachu ex SIR dans le set.',
    imageUrl: null,
  },

  // SV7 — Couronne Stellaire
  {
    slug: 'display-couronne-stellaire-sv7',
    name: 'Booster Box Couronne Stellaire', nameFr: 'Display Couronne Stellaire SV7',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Couronne Stellaire', language: 'FR',
    releaseDate: d(2024, 9, 6), isDiscontinued: false, retailPrice: 140, marketPrice: 148,
    investmentScore: 70, scarcityScore: 48, popularityScore: 76,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '2-4 ans',
    bullish: ['Type Stellaire inédit', 'Terapagos stellaire iconic', 'Set de fin de cycle SV — potentiel futur'],
    bearish: ['Peu de premium actuellement', 'Encore disponible'],
    narrative: 'Set qui introduit le type Stellaire. La rareté Crown Rare (équivalent Hyper Rare) est très demandée. À accumuler au retail pour une revente dans 2-3 ans.',
    imageUrl: null,
  },

  // SV6.5 — Destins de Paldéa (Paldean Fates)
  {
    slug: 'display-destins-paldea-sv65',
    name: 'Booster Box Destins de Paldéa', nameFr: 'Display Destins de Paldéa SV6.5',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Destins de Paldéa', language: 'FR',
    releaseDate: d(2024, 1, 26), isDiscontinued: true, retailPrice: 140, marketPrice: 175,
    investmentScore: 78, scarcityScore: 68, popularityScore: 80,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Shiny set — Pokémon brillants très recherchés', 'Discontinué, stock retail épuisé', 'Arcanin ex shiny, Lucario ex shiny'],
    bearish: ['Shiny set plus accessoire que main set'],
    narrative: 'Destins de Paldéa est le shiny set de la génération SV. Les Pokémon en versions brillantes attirent une clientèle spécifique. Discontinué, le display se revend déjà +25% du retail. Horizon 2 ans : ×2.2 probable.',
    imageUrl: null,
  },

  // SV6 — Mascarade Crépusculaire
  {
    slug: 'display-mascarade-crepusculaire-sv6',
    name: 'Booster Box Mascarade Crépusculaire', nameFr: 'Display Mascarade Crépusculaire SV6',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Mascarade Crépusculaire', language: 'FR',
    releaseDate: d(2024, 6, 7), isDiscontinued: false, retailPrice: 140, marketPrice: 150,
    investmentScore: 75, scarcityScore: 52, popularityScore: 82,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '2-3 ans',
    bullish: ['Pecharunt & Okidogi SIR très recherchés', 'SIR de qualité artistique exceptionnelle', 'Premier set à introduire les Pokémon 0 de Paldéa'],
    bearish: ['Encore disponible en retail'],
    narrative: 'Mascarade Crépusculaire se distingue par la qualité de ses SIR. Le set attire une base de fans fidèle. A discontinuation, le display devrait atteindre €190-220.',
    imageUrl: null,
  },
  {
    slug: 'etb-mascarade-crepusculaire-sv6',
    name: 'Elite Trainer Box Mascarade Crépusculaire', nameFr: 'ETB Mascarade Crépusculaire',
    type: 'ETB', series: 'Écarlate & Violet', setName: 'Mascarade Crépusculaire', language: 'FR',
    releaseDate: d(2024, 6, 7), isDiscontinued: false, retailPrice: 55, marketPrice: 58,
    investmentScore: 68, scarcityScore: 48, popularityScore: 78,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '2-3 ans',
    bullish: ['Set à fort potentiel', 'Entrée retail recommandée maintenant'],
    bearish: ['Pas encore de premium'],
    narrative: 'ETB à accumuler au retail. Discontinuation attendue dans 6-12 mois.',
    imageUrl: null,
  },

  // SV5 — Forces Temporelles
  {
    slug: 'display-forces-temporelles-sv5',
    name: 'Booster Box Forces Temporelles', nameFr: 'Display Forces Temporelles SV5',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Forces Temporelles', language: 'FR',
    releaseDate: d(2024, 3, 22), isDiscontinued: false, retailPrice: 140, marketPrice: 148,
    investmentScore: 70, scarcityScore: 50, popularityScore: 76,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '2-4 ans',
    bullish: ['Iron Leaves, Walking Wake demandés', 'Terapagos Chromatique'],
    bearish: ['Encore disponible', 'Moins iconique que 151'],
    narrative: 'Forces Temporelles propose des paradoxes anciens/futurs avec de belles SIR. Premium faible actuellement, mais à accumuler avant discontinuation.',
    imageUrl: null,
  },

  // SV4.5 — Destinées de Paldéa
  {
    slug: 'display-destinees-paldea-sv45',
    name: 'Booster Box Destinées de Paldéa', nameFr: 'Display Destinées de Paldéa SV4.5',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Destinées de Paldéa', language: 'FR',
    releaseDate: d(2023, 11, 3), isDiscontinued: true, retailPrice: 140, marketPrice: 162,
    investmentScore: 72, scarcityScore: 60, popularityScore: 78,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Discontinué', 'Roue du Destin SIR', 'Fer Valiant SIR', 'Stock retail épuisé'],
    bearish: ['Set moins connu du grand public'],
    narrative: 'Destinées de Paldéa est discontinué avec des SIR de qualité. Le display prend progressivement de la valeur.',
    imageUrl: null,
  },

  // SV4 — Paradoxe Temporel
  {
    slug: 'display-paradoxe-temporel-sv4',
    name: 'Booster Box Paradoxe Temporel', nameFr: 'Display Paradoxe Temporel SV4',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Paradoxe Temporel', language: 'FR',
    releaseDate: d(2023, 11, 3), isDiscontinued: false, retailPrice: 140, marketPrice: 150,
    investmentScore: 72, scarcityScore: 52, popularityScore: 80,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '2-3 ans',
    bullish: ['Roue du Destin, Fer Valiant SIR ultra-rares', 'Premier set à introduire les paradoxes'],
    bearish: ['Encore disponible'],
    narrative: 'Paradoxe Temporel avec ses formes anciennes/futuristes. À accumuler avant discontinuation.',
    imageUrl: null,
  },

  // SV3.5 — 151 ★★★ ICONIQUE
  {
    slug: 'display-151-sv35',
    name: 'Booster Box 151', nameFr: 'Display 151 SV3.5',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: '151', language: 'FR',
    releaseDate: d(2023, 9, 22), isDiscontinued: false, retailPrice: 140, marketPrice: 185,
    investmentScore: 88, scarcityScore: 68, popularityScore: 99,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '2-4 ans',
    bullish: ['Set nostalgie Kanto — 151 Pokémon de base revisités', 'Dracaufeu ex, Mewtwo ex, Mew ex ultra-demandés', 'Le set le plus populaire de toute la génération SV', 'Demande mondiale constante et croissante'],
    bearish: ['Encore imprimé — attendre la discontinuation pour le pic'],
    narrative: 'Le set 151 est le phénomène générationnel de Pokémon TCG SV. En revisitant les 151 Pokémon originaux avec une qualité d\'illustration inédite, il touche simultanément les enfants des années 90 (qui ont maintenant 25-40 ans et du pouvoir d\'achat) et les nouveaux fans. Comparable direct : Évolutions XY (2016) qui revisitait aussi Kanto — le display vaut aujourd\'hui €450 vs €100 retail. Le 151 est mieux imprimé mais la demande est 3-4x supérieure. Cible 3 ans : €280-350.',
    imageUrl: null,
  },
  {
    slug: 'etb-151-sv35',
    name: 'Elite Trainer Box 151', nameFr: 'ETB 151 SV3.5',
    type: 'ETB', series: 'Écarlate & Violet', setName: '151', language: 'FR',
    releaseDate: d(2023, 9, 22), isDiscontinued: false, retailPrice: 55, marketPrice: 78,
    investmentScore: 86, scarcityScore: 66, popularityScore: 99,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '2-4 ans',
    bullish: ['Set nostalgie kanto ultra-populaire', 'Promo Mew exclusive ETB', 'Premium marché : +42% vs retail'],
    bearish: ['Encore disponible en retail'],
    narrative: 'L\'ETB 151 est la référence investissement du moment sur les ETB. Au retail à €55, il se revend déjà €78. À discontinuation, cible €120-150.',
    imageUrl: null,
  },

  // SV3 — Flammes Obsidiennes ★★
  {
    slug: 'display-flammes-obsidiennes-sv3',
    name: 'Booster Box Flammes Obsidiennes', nameFr: 'Display Flammes Obsidiennes SV3',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Flammes Obsidiennes', language: 'FR',
    releaseDate: d(2023, 8, 11), isDiscontinued: true, retailPrice: 140, marketPrice: 192,
    investmentScore: 85, scarcityScore: 78, popularityScore: 92,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Discontinué — stock retail épuisé', 'Dracaufeu ex doré (seule carte dorée du set)', 'Le Dracaufeu ex SIR le plus demandé du moment', 'Premium marché : +37% vs retail'],
    bearish: [],
    narrative: 'Flammes Obsidiennes = le set Dracaufeu de la génération SV. La carte dorée Dracaufeu ex est l\'une des plus recherchées du format. Discontinué, le display monte régulièrement. Cible 2 ans : €240-280.',
    imageUrl: null,
  },
  {
    slug: 'etb-flammes-obsidiennes-sv3',
    name: 'Elite Trainer Box Flammes Obsidiennes', nameFr: 'ETB Flammes Obsidiennes',
    type: 'ETB', series: 'Écarlate & Violet', setName: 'Flammes Obsidiennes', language: 'FR',
    releaseDate: d(2023, 8, 11), isDiscontinued: true, retailPrice: 55, marketPrice: 85,
    investmentScore: 82, scarcityScore: 75, popularityScore: 90,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Discontinued', 'Set Dracaufeu — demande pérenne', 'Premium +55% vs retail'],
    bearish: [],
    narrative: 'ETB Flammes Obsidiennes : discontinued avec fort premium. Cible 12 mois : €110-130.',
    imageUrl: null,
  },

  // SV2 — Évolutions à Paldéa
  {
    slug: 'display-evolutions-paldea-sv2',
    name: 'Booster Box Évolutions à Paldéa', nameFr: 'Display Évolutions à Paldéa SV2',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Évolutions à Paldéa', language: 'FR',
    releaseDate: d(2023, 6, 9), isDiscontinued: true, retailPrice: 140, marketPrice: 158,
    investmentScore: 70, scarcityScore: 60, popularityScore: 72,
    trendDirection: 'STABLE', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Discontinué', 'Arcanin ex SIR', 'Prix en progression lente'],
    bearish: ['Set moins populaire que Flammes Obsidiennes ou 151'],
    narrative: 'Évolutions à Paldéa a été éclipsé par Flammes Obsidiennes. Quelques SIR intéressantes mais demande modérée.',
    imageUrl: null,
  },

  // SV1 — Écarlate & Violet Base
  {
    slug: 'display-ecarlate-violet-sv1',
    name: 'Booster Box Écarlate & Violet Base', nameFr: 'Display Écarlate & Violet SV1',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Écarlate & Violet Base', language: 'FR',
    releaseDate: d(2023, 3, 31), isDiscontinued: true, retailPrice: 140, marketPrice: 165,
    investmentScore: 72, scarcityScore: 62, popularityScore: 75,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Set de lancement SV — valeur historique assurée', 'Discontinué', 'Miraidon, Koraidon ex SIR'],
    bearish: ['Pokémons de lancement moins iconiques que Kanto'],
    narrative: 'Set de lancement de la 9ème génération. Les displays de lancement de génération ont systématiquement une valeur croissante. Cible 3 ans : €220-260.',
    imageUrl: null,
  },

  // Coffrets SV — Produits spéciaux
  {
    slug: 'coffret-dracaufeu-ex-doré-sv3',
    name: 'Coffret Collection Dracaufeu ex Doré', nameFr: 'Coffret Dracaufeu ex Golden',
    type: 'COFFRET', series: 'Écarlate & Violet', setName: 'Flammes Obsidiennes', language: 'FR',
    releaseDate: d(2023, 8, 11), isDiscontinued: true, retailPrice: 35, marketPrice: 75,
    investmentScore: 88, scarcityScore: 85, popularityScore: 97,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Dracaufeu ex doré promo exclusive', 'Discontinued + rupture totale retail', '+114% vs retail', 'Pokémon le plus collecté = valeur garantie'],
    bearish: [],
    narrative: 'Le coffret Dracaufeu ex doré est l\'objet collector numéro 1 de SV. La promo exclusive est introuvable ailleurs. Stock épuisé, prix en hausse constante. Cible 18 mois : €110-130.',
    imageUrl: null,
  },
  {
    slug: 'coffret-mewtwo-ex-151',
    name: 'Coffret Collection Mewtwo ex 151', nameFr: 'Coffret Mewtwo ex 151',
    type: 'COFFRET', series: 'Écarlate & Violet', setName: '151', language: 'FR',
    releaseDate: d(2023, 9, 22), isDiscontinued: true, retailPrice: 35, marketPrice: 65,
    investmentScore: 84, scarcityScore: 80, popularityScore: 94,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Mewtwo — personnage Tier S', 'Promo exclusive 151', 'Discontinued et introuvable au retail'],
    bearish: [],
    narrative: 'Mewtwo ex avec promo exclusive 151. Discontinued et en hausse constante.',
    imageUrl: null,
  },
  {
    slug: 'coffret-pikachu-ex-151',
    name: 'Coffret Collection Pikachu ex 151', nameFr: 'Coffret Pikachu ex 151',
    type: 'COFFRET', series: 'Écarlate & Violet', setName: '151', language: 'FR',
    releaseDate: d(2023, 9, 22), isDiscontinued: true, retailPrice: 30, marketPrice: 58,
    investmentScore: 85, scarcityScore: 80, popularityScore: 98,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Pikachu — Tier S, mascotte universelle', 'Promo exclusive 151', '+93% vs retail'],
    bearish: [],
    narrative: 'Coffret Pikachu ex 151. La mascotte des Pokémon en promo exclusive — demande universelle garantie.',
    imageUrl: null,
  },
  {
    slug: 'coffret-lucario-ex-sv',
    name: 'Coffret Collection Lucario ex SV', nameFr: 'Coffret Lucario ex SV',
    type: 'COFFRET', series: 'Écarlate & Violet', setName: 'Évolutions à Paldéa', language: 'FR',
    releaseDate: d(2023, 6, 9), isDiscontinued: true, retailPrice: 30, marketPrice: 48,
    investmentScore: 76, scarcityScore: 72, popularityScore: 85,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Lucario — Tier A très populaire', 'Discontinued', '+60% vs retail'],
    bearish: [],
    narrative: 'Lucario est un personnage A-tier avec une fanbase fidèle. Le coffret prend de la valeur régulièrement.',
    imageUrl: null,
  },

  // ══════════════════════════════════════════════════════════════════════
  // ÉPÉE & BOUCLIER — SWSH (2020–2023)
  // ══════════════════════════════════════════════════════════════════════

  // SWSH12.5 — Couronne Zénith ★★★ INVESTISSEMENT SOLIDE
  {
    slug: 'display-couronne-zenith-swsh125',
    name: 'Booster Box Couronne Zénith', nameFr: 'Display Couronne Zénith SWSH12.5',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Couronne Zénith', language: 'FR',
    releaseDate: d(2023, 1, 20), isDiscontinued: true, retailPrice: 140, marketPrice: 215,
    investmentScore: 87, scarcityScore: 82, popularityScore: 90,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Dernier set SWSH — valeur de set final de génération', 'Regieleki, Regidrago VSTAR SIR très demandés', 'Trainer Gallery 30 cartes exclusives', 'Discontinué + stock retail épuisé', '+54% vs retail'],
    bearish: [],
    narrative: 'Couronne Zénith est le set final de la génération SWSH. Les sets finaux de génération ont une valeur systématiquement croissante. La Trainer Gallery (30 cartes exclusives) justifie à elle seule une prime permanente. Cible 2 ans : €280-320.',
    imageUrl: null,
  },
  {
    slug: 'etb-couronne-zenith-swsh125',
    name: 'Elite Trainer Box Couronne Zénith', nameFr: 'ETB Couronne Zénith',
    type: 'ETB', series: 'Épée & Bouclier', setName: 'Couronne Zénith', language: 'FR',
    releaseDate: d(2023, 1, 20), isDiscontinued: true, retailPrice: 55, marketPrice: 108,
    investmentScore: 85, scarcityScore: 80, popularityScore: 88,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Set final SWSH', 'Discontinued', '+96% vs retail', 'Trainer Gallery en boosters'],
    bearish: [],
    narrative: 'ETB Couronne Zénith : presque au double du retail. Cible 18 mois : €140-160.',
    imageUrl: null,
  },

  // SWSH10 — Astres Radieux ★★
  {
    slug: 'display-astres-radieux-swsh10',
    name: 'Booster Box Astres Radieux', nameFr: 'Display Astres Radieux SWSH10',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Astres Radieux', language: 'FR',
    releaseDate: d(2022, 2, 25), isDiscontinued: true, retailPrice: 140, marketPrice: 188,
    investmentScore: 83, scarcityScore: 76, popularityScore: 88,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Dracaufeu VSTAR rainbow — carte phare du set', 'Pikachu VSTAR très populaire', 'Discontinued + stock épuisé', '+34% vs retail'],
    bearish: [],
    narrative: 'Astres Radieux est tiré vers le haut par son Dracaufeu VSTAR rainbow, l\'une des cartes les plus ouverte du set. Le display continue de progresser régulièrement. Cible 2 ans : €240-270.',
    imageUrl: null,
  },
  {
    slug: 'etb-astres-radieux-swsh10',
    name: 'Elite Trainer Box Astres Radieux', nameFr: 'ETB Astres Radieux',
    type: 'ETB', series: 'Épée & Bouclier', setName: 'Astres Radieux', language: 'FR',
    releaseDate: d(2022, 2, 25), isDiscontinued: true, retailPrice: 55, marketPrice: 88,
    investmentScore: 80, scarcityScore: 74, popularityScore: 86,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Dracaufeu VSTAR & Pikachu VSTAR', 'Discontinued', '+60% vs retail'],
    bearish: [],
    narrative: 'ETB Astres Radieux : solide investissement discontinued. Cible 18 mois : €115-130.',
    imageUrl: null,
  },

  // SWSH11 — Origine Perdue
  {
    slug: 'display-origine-perdue-swsh11',
    name: 'Booster Box Origine Perdue', nameFr: 'Display Origine Perdue SWSH11',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Origine Perdue', language: 'FR',
    releaseDate: d(2022, 9, 9), isDiscontinued: true, retailPrice: 140, marketPrice: 175,
    investmentScore: 79, scarcityScore: 72, popularityScore: 84,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Lugia V Alt Art ultra-demandé', 'Giratina V Alt Art collector', 'Discontinued', '+25% vs retail'],
    bearish: [],
    narrative: 'Origine Perdue est tiré par le Lugia V et Giratina V en Alternate Art, deux cartes très recherchées. Discontinué, en progression régulière.',
    imageUrl: null,
  },

  // SWSH7 — Évolution Céleste ★★ (Umbreon VMAX Alt Art)
  {
    slug: 'display-evolution-celeste-swsh7',
    name: 'Booster Box Évolution Céleste', nameFr: 'Display Évolution Céleste SWSH7',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Évolution Céleste', language: 'FR',
    releaseDate: d(2021, 8, 27), isDiscontinued: true, retailPrice: 140, marketPrice: 210,
    investmentScore: 82, scarcityScore: 75, popularityScore: 87,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Umbreon VMAX Alternate Art — le plus populaire du set', 'Sylveon VMAX Alt Art', 'Discontinued', '+50% vs retail'],
    bearish: [],
    narrative: 'Évolution Céleste est porté par son Umbreon VMAX Alternate Art, l\'une des cartes Alt Art les plus collectées de SWSH. +50% vs retail, en progression continue.',
    imageUrl: null,
  },
  {
    slug: 'etb-evolution-celeste-swsh7',
    name: 'Elite Trainer Box Évolution Céleste', nameFr: 'ETB Évolution Céleste',
    type: 'ETB', series: 'Épée & Bouclier', setName: 'Évolution Céleste', language: 'FR',
    releaseDate: d(2021, 8, 27), isDiscontinued: true, retailPrice: 55, marketPrice: 98,
    investmentScore: 80, scarcityScore: 73, popularityScore: 85,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Umbreon VMAX Alt Art dans le set', 'Discontinued', '+78% vs retail'],
    bearish: [],
    narrative: 'ETB Évolution Céleste : excellent investissement discontinued sur le thème Noctali.',
    imageUrl: null,
  },

  // SWSH12 — Tempête Argentée
  {
    slug: 'display-tempete-argentee-swsh12',
    name: 'Booster Box Tempête Argentée', nameFr: 'Display Tempête Argentée SWSH12',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Tempête Argentée', language: 'FR',
    releaseDate: d(2022, 11, 11), isDiscontinued: true, retailPrice: 140, marketPrice: 168,
    investmentScore: 74, scarcityScore: 68, popularityScore: 76,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Discontinued', 'Lugia VSTAR — alt art très demandé', '+20% vs retail'],
    bearish: ['Moins iconique que Couronne Zénith'],
    narrative: 'Tempête Argentée précède Couronne Zénith. Son Lugia VSTAR en fait un set solide.',
    imageUrl: null,
  },

  // Célébrations 25 ans ★★★
  {
    slug: 'display-celebrations-25-ans',
    name: 'Booster Box Célébrations 25 ans', nameFr: 'Display Célébrations 25 ans',
    type: 'BOOSTER_BOX', series: 'Célébrations', setName: 'Célébrations', language: 'FR',
    releaseDate: d(2021, 10, 8), isDiscontinued: true, retailPrice: 115, marketPrice: 235,
    investmentScore: 90, scarcityScore: 92, popularityScore: 95,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-3 ans',
    bullish: ['25ème anniversaire — édition absolument unique', 'Mew promo, Pikachu VMAX or, reprints Base Set', 'Discontinué définitivement', '+104% vs retail', 'Set collector par excellence — remis en contexte chaque année'],
    bearish: [],
    narrative: 'Célébrations est le set des 25 ans de Pokémon. Il ne peut physiquement plus être réimprimé (les 25 ans de Pokémon ne reviendront pas). Chaque exemplaire scellé qui disparaît du marché réduit un stock déjà limité. Cible 3 ans : €380-450.',
    imageUrl: 'https://images.pokemontcg.io/cel25/logo.png',
  },
  {
    slug: 'etb-celebrations-25-ans',
    name: 'Elite Trainer Box Célébrations 25 ans', nameFr: 'ETB Célébrations 25 ans',
    type: 'ETB', series: 'Célébrations', setName: 'Célébrations', language: 'FR',
    releaseDate: d(2021, 10, 8), isDiscontinued: true, retailPrice: 55, marketPrice: 130,
    investmentScore: 88, scarcityScore: 90, popularityScore: 93,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-3 ans',
    bullish: ['25ème anniversaire', 'Discontinued définitif', '+136% vs retail'],
    bearish: [],
    narrative: 'ETB 25ème anniversaire : l\'un des meilleurs investissements ETB sur le marché français. Cible 3 ans : €200-250.',
    imageUrl: null,
  },

  // Pokémon GO
  {
    slug: 'display-pokemon-go-swsh',
    name: 'Booster Box Pokémon GO', nameFr: 'Display Pokémon GO',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Pokémon GO', language: 'FR',
    releaseDate: d(2022, 7, 1), isDiscontinued: true, retailPrice: 140, marketPrice: 178,
    investmentScore: 81, scarcityScore: 74, popularityScore: 88,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Collaboration Pokémon GO/TCG — unique en son genre, impossible à rééditer', 'Mélodelfe SIR, Ronflex, Dracaufeu', 'Discontinued', '+27% vs retail'],
    bearish: [],
    narrative: 'La collaboration entre Pokémon GO (l\'app mobile) et le TCG est un événement unique. Ce type de collaboration cross-media ne revient jamais exactement de la même façon. Cible 2 ans : €230-260.',
    imageUrl: null,
  },
  {
    slug: 'etb-pokemon-go-swsh',
    name: 'Elite Trainer Box Pokémon GO', nameFr: 'ETB Pokémon GO',
    type: 'ETB', series: 'Épée & Bouclier', setName: 'Pokémon GO', language: 'FR',
    releaseDate: d(2022, 7, 1), isDiscontinued: true, retailPrice: 55, marketPrice: 92,
    investmentScore: 79, scarcityScore: 72, popularityScore: 86,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Collab GO unique', 'Discontinued', '+67% vs retail'],
    bearish: [],
    narrative: 'ETB Pokémon GO : collaboration unique = valeur collector garantie.',
    imageUrl: null,
  },

  // SWSH4 — Voltage Éclatant
  {
    slug: 'display-voltage-eclatant-swsh4',
    name: 'Booster Box Voltage Éclatant', nameFr: 'Display Voltage Éclatant SWSH4',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Voltage Éclatant', language: 'FR',
    releaseDate: d(2020, 11, 13), isDiscontinued: true, retailPrice: 140, marketPrice: 195,
    investmentScore: 80, scarcityScore: 74, popularityScore: 82,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Pikachu VMAX arc-en-ciel', 'Dracaufeu VMAX arc-en-ciel', 'Discontinué + 3 ans', '+39% vs retail'],
    bearish: [],
    narrative: 'Voltage Éclatant a le Pikachu VMAX et le Dracaufeu VMAX rainbow, deux cartes emblématiques de SWSH. Discontinued depuis 3 ans, en progression continue.',
    imageUrl: null,
  },

  // SWSH1 — Épée & Bouclier Base
  {
    slug: 'display-epee-bouclier-swsh1',
    name: 'Booster Box Épée & Bouclier Base', nameFr: 'Display Épée & Bouclier SWSH1',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Épée & Bouclier Base', language: 'FR',
    releaseDate: d(2020, 2, 7), isDiscontinued: true, retailPrice: 140, marketPrice: 198,
    investmentScore: 81, scarcityScore: 75, popularityScore: 80,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '2-4 ans',
    bullish: ['Set de lancement SWSH', 'Zacian V & Zamazenta V iconiques', 'Discontinued + 4 ans'],
    bearish: [],
    narrative: 'Display de lancement de la génération SWSH. Discontinued depuis 4 ans, valeur en progression régulière.',
    imageUrl: null,
  },

  // ══════════════════════════════════════════════════════════════════════
  // XY
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'display-evolutions-xy12',
    name: 'Booster Box Évolutions XY', nameFr: 'Display Évolutions XY',
    type: 'BOOSTER_BOX', series: 'XY', setName: 'Évolutions XY', language: 'FR',
    releaseDate: d(2016, 11, 2), isDiscontinued: true, retailPrice: 100, marketPrice: 450,
    investmentScore: 95, scarcityScore: 93, popularityScore: 96,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '2-5 ans',
    bullish: ['Reprints esthétique Base Set 1999 — nostalgie maximale', 'Dracaufeu holo (reproduction Base Set)', 'Discontinued depuis 2017 — 8 ans de marché secondaire', '+350% vs retail', 'Demande mondiale permanente'],
    bearish: ['Prix d\'entrée élevé (€450)'],
    narrative: 'Évolutions XY est le set qui recrée l\'esthétique de Base Set. Ce concept, combiné à 8 ans de discontinuation, a fait grimper le display de €100 retail à €450 aujourd\'hui. Une progression régulière qui ne montre aucun signe de ralentissement. Le Dracaufeu holo en reproduction fidèle reste l\'une des cartes les plus demandées du set. Cible 5 ans : €700-900.',
    imageUrl: 'https://images.pokemontcg.io/xy12/logo.png',
  },

  // ══════════════════════════════════════════════════════════════════════
  // VINTAGE (Base Set, Neo, etc.)
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'display-base-set-fr-vintage',
    name: 'Booster Box Base Set (FR)', nameFr: 'Display Base Set Français 1ère Éd.',
    type: 'BOOSTER_BOX', series: 'Base Set', setName: 'Base Set', language: 'FR',
    releaseDate: d(1999, 11, 1), isDiscontinued: true, retailPrice: 90, marketPrice: 22000,
    investmentScore: 100, scarcityScore: 100, popularityScore: 100,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '5-10 ans',
    bullish: ['Le Graal des coffrets TCG Pokémon', 'Dracaufeu, Mewtwo, Pikachu inside', 'Stock mondial <200 exemplaires scellés estimés', '+24 344% vs retail', 'Actif de collection de classe mondiale'],
    bearish: ['Prix d\'entrée hors de portée pour la plupart'],
    narrative: 'Le Base Set français scellé est l\'équivalent Pokémon d\'un Picasso. Moins de 200 exemplaires scellés estimés dans le monde entier. À chaque vente aux enchères, le record est battu. En 1999, ce display se vendait €90. Aujourd\'hui, les rares exemplaires atteignent €15 000–25 000. Ce n\'est plus un produit TCG — c\'est un actif de collection de classe mondiale au même titre qu\'une montre de luxe ou une voiture de collection.',
    imageUrl: 'https://images.pokemontcg.io/base1/logo.png',
  },
  {
    slug: 'display-jungle-fr-vintage',
    name: 'Booster Box Jungle (FR)', nameFr: 'Display Jungle Français',
    type: 'BOOSTER_BOX', series: 'Base Set', setName: 'Jungle', language: 'FR',
    releaseDate: d(1999, 11, 1), isDiscontinued: true, retailPrice: 90, marketPrice: 6500,
    investmentScore: 94, scarcityScore: 96, popularityScore: 87,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '5-10 ans',
    bullish: ['Vintage Gen 1 — Évoli et évolutions', 'Stock mondial estimé <500 scellés', '+7 122% vs retail'],
    bearish: ['Moins iconique que Base Set'],
    narrative: 'Le deuxième set Pokémon en vintage scellé. Évoli (Eevee) est l\'un des Pokémon les plus populaires — sa présence tire ce set vers le haut.',
    imageUrl: 'https://images.pokemontcg.io/base2/logo.png',
  },
  {
    slug: 'display-fossile-fr-vintage',
    name: 'Booster Box Fossile (FR)', nameFr: 'Display Fossile Français',
    type: 'BOOSTER_BOX', series: 'Base Set', setName: 'Fossile', language: 'FR',
    releaseDate: d(1999, 11, 1), isDiscontinued: true, retailPrice: 90, marketPrice: 4800,
    investmentScore: 91, scarcityScore: 94, popularityScore: 83,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '5-10 ans',
    bullish: ['Ectoplasma, Hypnomade, Artikodin holo', 'Vintage scellé extrêmement rare', '+5 233% vs retail'],
    bearish: [],
    narrative: 'Troisième set de la Gen 1. Ectoplasma (Gengar) est un personnage Tier S très demandé. Vintage scellé en forte progression.',
    imageUrl: 'https://images.pokemontcg.io/base3/logo.png',
  },
  {
    slug: 'display-neo-genesis-fr',
    name: 'Booster Box Néo Genesis (FR)', nameFr: 'Display Néo Genesis Français',
    type: 'BOOSTER_BOX', series: 'Neo', setName: 'Néo Genesis', language: 'FR',
    releaseDate: d(2000, 12, 16), isDiscontinued: true, retailPrice: 90, marketPrice: 3800,
    investmentScore: 90, scarcityScore: 93, popularityScore: 85,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '3-7 ans',
    bullish: ['Lugia et Ho-Oh dans le set', '2ème génération la plus nostalgique', 'Scellé vintage rarissime', '+4 122% vs retail'],
    bearish: [],
    narrative: 'La génération Johto en scellé vintage. Lugia est un Pokémon Tier S avec une demande mondiale permanente. Le display Neo Genesis est une pièce de collection majeure.',
    imageUrl: 'https://images.pokemontcg.io/neo1/logo.png',
  },

  // ══════════════════════════════════════════════════════════════════════
  // COFFRETS SPÉCIAUX & TINS
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'coffret-mep-mega-evolution-promo',
    name: 'Coffret Méga-Évolution Promo', nameFr: 'Coffret MEP Méga-Dracaufeu',
    type: 'COFFRET', series: 'XY', setName: 'Méga-Évolution Promo', language: 'FR',
    releaseDate: d(2016, 1, 1), isDiscontinued: true, retailPrice: 30, marketPrice: 280,
    investmentScore: 94, scarcityScore: 100, popularityScore: 92,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Promos Méga-Dracaufeu X & Y exclusives et introuvables ailleurs', 'Discontinué définitivement', '+833% vs retail', 'Supply figé depuis 9 ans'],
    bearish: [],
    narrative: 'Le coffret MEP est le graal des coffrets XY. Les cartes promos Méga-Dracaufeu X et Y qu\'il contient sont exclusives à ce coffret — impossibles à obtenir autrement. Avec 9 ans de discontinuation, les exemplaires scellés s\'épuisent. Cible 2 ans : €400-500.',
    imageUrl: null,
  },
  {
    slug: 'coffret-celebrations-pikachu-vmax-gold',
    name: 'Coffret Célébrations Pikachu VMAX Doré', nameFr: 'Coffret Premium Pikachu VMAX Or 25 ans',
    type: 'COFFRET', series: 'Célébrations', setName: 'Célébrations', language: 'FR',
    releaseDate: d(2021, 10, 8), isDiscontinued: true, retailPrice: 45, marketPrice: 135,
    investmentScore: 89, scarcityScore: 88, popularityScore: 95,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Pikachu VMAX doré promo exclusive 25 ans', 'Discontinued définitif — 25 ans ne revient jamais', '+200% vs retail'],
    bearish: [],
    narrative: 'Le coffret avec le Pikachu VMAX doré en promo 25 ans. Cette carte ne peut physiquement pas être réimprimée (les 25 ans sont passés). Premium en hausse constante.',
    imageUrl: null,
  },
  {
    slug: 'tin-dracaufeu-vmax-astres',
    name: 'Tin Dracaufeu VMAX Astres Radieux', nameFr: 'Boîte à dés Dracaufeu VMAX Astres',
    type: 'TIN', series: 'Épée & Bouclier', setName: 'Astres Radieux', language: 'FR',
    releaseDate: d(2022, 3, 1), isDiscontinued: true, retailPrice: 22, marketPrice: 55,
    investmentScore: 78, scarcityScore: 74, popularityScore: 88,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Dracaufeu VMAX promo exclusive', 'Discontinued', '+150% vs retail'],
    bearish: ['Petite boîte — volume de boosters limité'],
    narrative: 'Tin Dracaufeu VMAX avec promo exclusive. Les tins Dracaufeu discontinued doublent systématiquement leur valeur.',
    imageUrl: null,
  },
  {
    slug: 'tin-pikachu-vmax-voltage',
    name: 'Tin Pikachu VMAX Voltage Éclatant', nameFr: 'Boîte à dés Pikachu VMAX',
    type: 'TIN', series: 'Épée & Bouclier', setName: 'Voltage Éclatant', language: 'FR',
    releaseDate: d(2020, 11, 1), isDiscontinued: true, retailPrice: 22, marketPrice: 68,
    investmentScore: 80, scarcityScore: 76, popularityScore: 90,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Pikachu VMAX promo exclusive', 'Discontinued + 4 ans', '+209% vs retail'],
    bearish: [],
    narrative: 'Tin Pikachu VMAX : la mascotte en version oversize. Discontinued depuis 4 ans, valeur en progression continue.',
    imageUrl: null,
  },

  // ══════════════════════════════════════════════════════════════════════
  // JAPONAIS (JP) — MARCHÉ DE NICHE MAIS FORTE VALEUR
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'display-vmax-climax-jp',
    name: 'Booster Box VMAX Climax (JP)', nameFr: 'Display VMAX Climax Japonais',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'VMAX Climax', language: 'JP',
    releaseDate: d(2021, 12, 3), isDiscontinued: true, retailPrice: 90, marketPrice: 280,
    investmentScore: 92, scarcityScore: 90, popularityScore: 93,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Équivalent japonais de Couronne Zénith', 'CHR (Character Rare) ultra-demandées', 'Set japonais uniquement — pas de version FR', 'Discontinued + supply très limité en Europe', '+211% vs retail'],
    bearish: ['Marché JP demande expertise spécifique'],
    narrative: 'VMAX Climax est le set japonais le plus collectionné de la génération SWSH. Les CHR (Character Rare) — personnages en full-art illustré — ont établi le standard de qualité artistique que SIR/SV a ensuite adopté. Stock européen extrêmement limité. Cible 2 ans : €380-450.',
    imageUrl: null,
  },
  {
    slug: 'display-shiny-treasure-sv-jp',
    name: 'Booster Box Shiny Treasure ex (JP)', nameFr: 'Display Shiny Treasure ex Japonais',
    type: 'BOOSTER_BOX', series: 'Écarlate & Violet', setName: 'Shiny Treasure ex', language: 'JP',
    releaseDate: d(2023, 12, 1), isDiscontinued: true, retailPrice: 100, marketPrice: 230,
    investmentScore: 88, scarcityScore: 84, popularityScore: 89,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Shiny annuel JP — toujours en forte demande', 'SAR (Shiny Art Rare) ultra-qualité', 'Discontinued JP + supply FR très limité', '+130% vs retail'],
    bearish: ['Marché JP spécialisé'],
    narrative: 'Shiny Treasure ex est le shiny set annuel de SV version japonaise. Ces sets sont systématiquement discontinued rapidement et très recherchés. Les SAR (Special Art Rare brillants) établissent le standard de qualité. Cible 2 ans : €300-360.',
    imageUrl: null,
  },
  {
    slug: 'display-paldean-fates-jp',
    name: 'Booster Box Shining Fates JP', nameFr: 'Display Shining Fates Japonais',
    type: 'BOOSTER_BOX', series: 'Épée & Bouclier', setName: 'Shining Fates', language: 'JP',
    releaseDate: d(2021, 2, 5), isDiscontinued: true, retailPrice: 85, marketPrice: 195,
    investmentScore: 84, scarcityScore: 82, popularityScore: 85,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Shiny set SWSH version JP', 'Shiny Dracaufeu VMAX ultra-demandé', 'Discontinued + 4 ans', '+129% vs retail'],
    bearish: [],
    narrative: 'Shining Fates JP contient le Shiny Dracaufeu VMAX, l\'une des cartes shiny les plus demandées de SWSH.',
    imageUrl: null,
  },

  // ══════════════════════════════════════════════════════════════════════
  // BUNDLES & BUILD AND BATTLE
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'bundle-build-battle-couronne-zenith',
    name: 'Build & Battle Box Couronne Zénith', nameFr: 'Boîte Build & Battle Couronne Zénith',
    type: 'BUNDLE', series: 'Épée & Bouclier', setName: 'Couronne Zénith', language: 'FR',
    releaseDate: d(2023, 1, 20), isDiscontinued: true, retailPrice: 25, marketPrice: 75,
    investmentScore: 80, scarcityScore: 82, popularityScore: 80,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Produit event exclusif — tirage limité', 'Promos Couronne Zénith exclusives', 'Discontinued', '+200% vs retail'],
    bearish: ['Marché de niche'],
    narrative: 'Les Build & Battle Box sont produites en quantité très limitée pour les tournois. Peu présentes sur le marché secondaire, leur rareté naturelle est un atout.',
    imageUrl: null,
  },
  {
    slug: 'bundle-build-battle-151',
    name: 'Build & Battle Box 151', nameFr: 'Boîte Build & Battle 151',
    type: 'BUNDLE', series: 'Écarlate & Violet', setName: '151', language: 'FR',
    releaseDate: d(2023, 9, 22), isDiscontinued: true, retailPrice: 25, marketPrice: 68,
    investmentScore: 79, scarcityScore: 78, popularityScore: 85,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['Event exclusif 151', 'Promos Kanto uniques', 'Discontinued'],
    bearish: [],
    narrative: 'B&B 151 : produit event sur le set le plus populaire de SV. Très peu présent sur le marché secondaire.',
    imageUrl: null,
  },

  // ══════════════════════════════════════════════════════════════════════
  // COFFRETS PREMIUM & COLLECTIONS SPÉCIALES
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'premium-collection-dracaufeu-vstar-151',
    name: 'Collection Premium Dracaufeu ex 151', nameFr: 'Collection Premium Dracaufeu ex 151',
    type: 'COLLECTION', series: 'Écarlate & Violet', setName: '151', language: 'FR',
    releaseDate: d(2023, 9, 22), isDiscontinued: true, retailPrice: 45, marketPrice: 98,
    investmentScore: 86, scarcityScore: 82, popularityScore: 97,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Dracaufeu ex promo jumbo exclusive', 'Discontinued + stock retail épuisé', '+118% vs retail'],
    bearish: [],
    narrative: 'Collection Premium avec une grande carte promo Dracaufeu ex. Dracaufeu + 151 = combinaison imbattable pour la valeur.',
    imageUrl: null,
  },
  {
    slug: 'premium-collection-evoli-ev-promo',
    name: 'Collection Premium Évoli Évolutions Prismatiques', nameFr: 'Collection Premium Évoli SV8.5',
    type: 'COLLECTION', series: 'Écarlate & Violet', setName: 'Évolutions Prismatiques', language: 'FR',
    releaseDate: d(2025, 1, 17), isDiscontinued: false, retailPrice: 45, marketPrice: 115,
    investmentScore: 92, scarcityScore: 80, popularityScore: 98,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-3 ans',
    bullish: ['Évoli — Tier S, le plus collecté des Pokémon', 'Promo exclusive en vente nulle part ailleurs', '+156% vs retail dès le lancement'],
    bearish: ['Encore imprimé potentiellement'],
    narrative: 'Collection Premium Évoli sur le set des Évolutions Prismatiques. Évoli est le Pokémon le plus collecté au monde — cette collection est en rupture dès le jour de lancement.',
    imageUrl: null,
  },
  {
    slug: 'coffret-dracaufeu-vmax-celebrations',
    name: 'Coffret Dracaufeu VMAX Célébrations', nameFr: 'Coffret Dracaufeu VMAX 25 ans',
    type: 'COFFRET', series: 'Célébrations', setName: 'Célébrations', language: 'FR',
    releaseDate: d(2021, 10, 8), isDiscontinued: true, retailPrice: 40, marketPrice: 115,
    investmentScore: 87, scarcityScore: 86, popularityScore: 94,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-2 ans',
    bullish: ['Dracaufeu VMAX promo exclusive 25 ans', 'Discontinued définitif', '+188% vs retail'],
    bearish: [],
    narrative: 'Le coffret Dracaufeu de la collection 25 ans. Dracaufeu + anniversaire = valeur de collection maximale.',
    imageUrl: null,
  },

  // ══════════════════════════════════════════════════════════════════════
  // TINS COLLECTION
  // ══════════════════════════════════════════════════════════════════════

  {
    slug: 'tin-celebrations-25-ans',
    name: 'Tin Célébrations 25 ans', nameFr: 'Boîte Tin Célébrations 25 ans',
    type: 'TIN', series: 'Célébrations', setName: 'Célébrations', language: 'FR',
    releaseDate: d(2021, 10, 8), isDiscontinued: true, retailPrice: 20, marketPrice: 55,
    investmentScore: 77, scarcityScore: 76, popularityScore: 88,
    trendDirection: 'BULLISH', riskLevel: 'Modéré', horizon: '1-2 ans',
    bullish: ['25ème anniversaire — édition unique', 'Pikachu promo doré', 'Discontinued', '+175% vs retail'],
    bearish: ['Petit format — valeur plafonnée'],
    narrative: 'Tin anniversaire 25 ans. Le Pikachu promo doré est un collector incontournable.',
    imageUrl: null,
  },
  {
    slug: 'tin-mewtwo-anniversary-origines',
    name: 'Tin Mewtwo Origines Cosmiques', nameFr: 'Tin Mewtwo Origines Cosmiques',
    type: 'TIN', series: 'XY', setName: 'Origines Cosmiques', language: 'FR',
    releaseDate: d(2015, 11, 1), isDiscontinued: true, retailPrice: 18, marketPrice: 85,
    investmentScore: 82, scarcityScore: 80, popularityScore: 92,
    trendDirection: 'BULLISH', riskLevel: 'Faible', horizon: '1-3 ans',
    bullish: ['Mewtwo Tier S', 'Tin XY vintage discontinued depuis 10 ans', '+372% vs retail'],
    bearish: [],
    narrative: 'Tin Mewtwo en version XY vintage. Discontinued depuis 2015 et en hausse constante. Mewtwo = demande permanente.',
    imageUrl: null,
  },
]

async function main() {
  console.log(`\n🎴 Seeding ${PRODUCTS.length} coffrets scellés...\n`)

  let created = 0, updated = 0

  for (const p of PRODUCTS) {
    const data = {
      name: p.name,
      nameFr: p.nameFr ?? null,
      type: p.type,
      setName: p.setName ?? null,
      series: p.series ?? null,
      language: p.language,
      releaseDate: p.releaseDate ?? null,
      isDiscontinued: p.isDiscontinued,
      retailPrice: p.retailPrice ?? null,
      imageUrl: p.imageUrl ?? null,
      cardmarketUrl: null,
      description: tirage(p.type, p.series, p.isDiscontinued),
      investmentScore: p.investmentScore ?? null,
      scarcityScore: p.scarcityScore ?? null,
      popularityScore: p.popularityScore ?? null,
      trendDirection: p.trendDirection ?? null,
      bullish: p.bullish ?? [],
      bearish: p.bearish ?? [],
      horizon: p.horizon ?? null,
      riskLevel: p.riskLevel ?? null,
      narrative: p.narrative ?? null,
    }

    const existing = await prisma.sealedProduct.findUnique({ where: { slug: p.slug } })
    let product
    if (existing) {
      product = await prisma.sealedProduct.update({ where: { slug: p.slug }, data })
      updated++
    } else {
      product = await prisma.sealedProduct.create({ data: { slug: p.slug, ...data } })
      created++
    }

    // Seed market price into price history
    if (p.marketPrice) {
      // Check if we already have a recent price
      const recent = await prisma.sealedPriceHistory.findFirst({
        where: { productId: product.id },
        orderBy: { recordedAt: 'desc' },
      })
      const priceChanged = !recent || Math.abs(recent.price - p.marketPrice) / p.marketPrice > 0.02

      if (priceChanged) {
        await prisma.sealedPriceHistory.create({
          data: { productId: product.id, price: p.marketPrice, source: 'seed_market' },
        })
      }
    }
  }

  console.log(`✅ ${created} créés, ${updated} mis à jour`)
  console.log(`\nTop 5 par score d'investissement:`)
  const top = await prisma.sealedProduct.findMany({ orderBy: { investmentScore: 'desc' }, take: 5, select: { nameFr: true, investmentScore: true, retailPrice: true } })
  top.forEach(p => console.log(`  ${p.nameFr} — score ${p.investmentScore} — retail €${p.retailPrice}`))

  await prisma.$disconnect()
}

main().catch(e => { console.error(e); process.exit(1) })
