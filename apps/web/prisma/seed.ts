import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()
const TCG_API = 'https://api.tcgdex.net/v2/en'

interface TcgdexSetBrief {
  id: string
  name: string
  serie: { id: string; name: string }
  releaseDate?: string
  cardCount: { total: number; official: number }
  logo?: string
  symbol?: string
}

interface TcgdexCardBrief {
  id: string
  localId: string
  name: string
  image?: string
}

interface TcgdexSetDetail extends TcgdexSetBrief {
  cards: TcgdexCardBrief[]
}

interface TcgdexCardFull {
  id: string
  localId: string
  name: string
  image?: string
  illustrator?: string
  rarity?: string
  category: string
  dexIDs?: number[]
  hp?: number
  types?: string[]
  evolveFrom?: string
  stage?: string
  description?: string
  attacks?: any[]
  abilities?: any[]
  weaknesses?: { type: string; value: string }[]
  resistances?: { type: string; value: string }[]
  retreat?: number
  regulationMark?: string
}

async function fetchAllSets(): Promise<TcgdexSetBrief[]> {
  const resp = await axios.get(`${TCG_API}/sets`)
  return resp.data
}

async function fetchSetDetail(setId: string): Promise<TcgdexSetDetail> {
  const resp = await axios.get(`${TCG_API}/sets/${setId}`)
  return resp.data
}

async function fetchCardFull(cardId: string): Promise<TcgdexCardFull> {
  const resp = await axios.get(`${TCG_API}/cards/${cardId}`)
  return resp.data
}

function mapRarity(rarity?: string): string {
  if (!rarity) return 'UNKNOWN'
  const map: Record<string, string> = {
    'Common': 'COMMON',
    'Uncommon': 'UNCOMMON',
    'Rare': 'RARE',
    'Rare Holo': 'RARE_HOLO',
    'Rare Holo EX': 'RARE_HOLO_EX',
    'Rare Holo GX': 'RARE_HOLO_GX',
    'Rare Holo V': 'RARE_HOLO_V',
    'Rare Holo VMAX': 'RARE_HOLO_VMAX',
    'Rare Holo VSTAR': 'RARE_HOLO_VSTAR',
    'Rare Ultra': 'RARE_ULTRA',
    'Rare Rainbow': 'RARE_RAINBOW',
    'Rare Secret': 'RARE_SECRET',
    'Rare Shiny': 'RARE_SHINY',
    'Rare Shiny GX': 'RARE_SHINY_GX',
    'Rare Prism Star': 'RARE_PRISM',
    'Amazing Rare': 'AMAZING_RARE',
    'LEGEND': 'LEGEND',
    'Promo': 'PROMO',
    'Illustration Rare': 'ILLUSTRATION_RARE',
    'Special Illustration Rare': 'SPECIAL_ILLUSTRATION_RARE',
    'Hyper Rare': 'HYPER_RARE',
    'Trainer Gallery Holo Rare': 'TRAINER_GALLERY_HOLO',
    'Crown Rare': 'CROWN_RARE',
  }
  return map[rarity] ?? 'UNKNOWN'
}

function imageUrl(base?: string, quality: 'low' | 'high' = 'high'): string {
  if (!base) return ''
  return `${base}/${quality}.webp`
}

async function seedSets(sets: TcgdexSetBrief[]) {
  console.log(`Seeding ${sets.length} sets...`)

  for (const s of sets) {
    await prisma.pokemonSet.upsert({
      where: { externalId: s.id },
      create: {
        externalId: s.id,
        name: s.name,
        series: s.serie?.name ?? '',
        language: 'EN',
        releaseDate: s.releaseDate ? new Date(s.releaseDate) : new Date('2000-01-01'),
        totalCards: s.cardCount?.total ?? 0,
        printedTotal: s.cardCount?.official ?? 0,
        symbolUrl: s.symbol ?? '',
        logoUrl: s.logo ?? '',
        ptcgoCode: null,
      },
      update: {
        name: s.name,
        totalCards: s.cardCount?.total ?? 0,
        printedTotal: s.cardCount?.official ?? 0,
        symbolUrl: s.symbol ?? '',
        logoUrl: s.logo ?? '',
      },
    })
  }

  console.log(`✅ ${sets.length} sets seeded`)
}

async function seedCards(sets: TcgdexSetBrief[]) {
  let total = 0

  for (const s of sets) {
    const setRecord = await prisma.pokemonSet.findUnique({ where: { externalId: s.id } })
    if (!setRecord) continue

    console.log(`  → Fetching cards for ${s.name}...`)

    let detail: TcgdexSetDetail
    try {
      detail = await fetchSetDetail(s.id)
    } catch {
      console.log(`    ⚠ Skipping ${s.name} (fetch failed)`)
      continue
    }

    const cards = detail.cards ?? []

    for (const brief of cards) {
      let c: TcgdexCardFull
      try {
        c = await fetchCardFull(brief.id)
      } catch {
        continue
      }

      const imgBase = c.image ?? brief.image
      await prisma.card.upsert({
        where: { externalId: c.id },
        create: {
          externalId: c.id,
          setId: setRecord.id,
          name: c.name,
          number: c.localId,
          supertype: c.category ?? 'Pokémon',
          subtypes: c.stage ? [c.stage] : [],
          types: c.types ?? [],
          rarity: mapRarity(c.rarity) as any,
          variant: 'NORMAL',
          language: 'EN',
          imageSmUrl: imageUrl(imgBase, 'low'),
          imageLgUrl: imageUrl(imgBase, 'high'),
          illustrator: c.illustrator ?? null,
          flavorText: c.description ?? null,
          hp: c.hp ?? null,
          evolvesFrom: c.evolveFrom ?? null,
          evolvesTo: [],
          attacks: c.attacks ?? [],
          abilities: c.abilities ?? [],
          weaknesses: c.weaknesses ?? [],
          resistances: c.resistances ?? [],
          retreatCost: c.retreat ? Array(c.retreat).fill('Colorless') : [],
          regulationMark: c.regulationMark ?? null,
          nationalPokedexNumbers: c.dexIDs ?? [],
          tcgplayerId: null,
          cardmarketId: null,
        },
        update: {
          name: c.name,
          imageSmUrl: imageUrl(imgBase, 'low'),
          imageLgUrl: imageUrl(imgBase, 'high'),
        },
      })
      total++

      await new Promise((r) => setTimeout(r, 100))
    }

    console.log(`    ✅ ${cards.length} cards from ${s.name}`)
    await new Promise((r) => setTimeout(r, 500))
  }

  console.log(`\n✅ Total: ${total} cards seeded`)
}

async function seedMarketData() {
  console.log('Seeding initial market index...')

  await prisma.marketIndex.createMany({
    data: [
      { indexType: 'GLOBAL', value: 1000, recordedAt: new Date() },
      { indexType: 'VINTAGE', value: 2500, recordedAt: new Date() },
      { indexType: 'MODERN', value: 750, recordedAt: new Date() },
      { indexType: 'SEALED', value: 1200, recordedAt: new Date() },
    ],
    skipDuplicates: true,
  })

  console.log('✅ Market index seeded')
}

async function main() {
  console.log('🚀 Starting database seed...\n')

  try {
    const sets = await fetchAllSets()
    await seedSets(sets)
    await seedCards(sets)
    await seedMarketData()

    console.log('\n🎉 Database seeding complete!')
  } catch (error) {
    console.error('Seed failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
