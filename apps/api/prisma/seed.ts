/**
 * Seed script — fetches sets & cards from the Pokémon TCG API
 * and populates the database.
 *
 * Usage: pnpm db:seed
 */
import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()
const TCG_API = 'https://api.pokemontcg.io/v2'
const HEADERS = { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY ?? '' }

interface TcgSet {
  id: string
  name: string
  series: string
  releaseDate: string
  total: number
  printedTotal: number
  images: { symbol: string; logo: string }
  ptcgoCode?: string
}

interface TcgCard {
  id: string
  name: string
  number: string
  supertype: string
  subtypes?: string[]
  types?: string[]
  rarity?: string
  images: { small: string; large: string }
  artist?: string
  flavorText?: string
  hp?: string
  evolvesFrom?: string
  evolvesTo?: string[]
  attacks?: any[]
  abilities?: any[]
  weaknesses?: any[]
  resistances?: any[]
  retreatCost?: string[]
  regulationMark?: string
  nationalPokedexNumbers?: number[]
  tcgplayer?: { productId?: string }
  cardmarket?: { productId?: string }
  set: { id: string }
}

async function fetchAllSets(): Promise<TcgSet[]> {
  const resp = await axios.get(`${TCG_API}/sets?pageSize=250&orderBy=-releaseDate`, { headers: HEADERS })
  return resp.data.data
}

async function fetchCardsForSet(setId: string, page = 1): Promise<TcgCard[]> {
  const resp = await axios.get(`${TCG_API}/cards?q=set.id:${setId}&pageSize=250&page=${page}`, {
    headers: HEADERS,
  })
  return resp.data.data
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

async function seedSets(sets: TcgSet[]) {
  console.log(`Seeding ${sets.length} sets...`)

  for (const s of sets) {
    await prisma.pokemonSet.upsert({
      where: { externalId: s.id },
      create: {
        externalId: s.id,
        name: s.name,
        series: s.series,
        language: 'EN',
        releaseDate: new Date(s.releaseDate),
        totalCards: s.total,
        printedTotal: s.printedTotal,
        symbolUrl: s.images.symbol,
        logoUrl: s.images.logo,
        ptcgoCode: s.ptcgoCode,
      },
      update: {
        name: s.name,
        totalCards: s.total,
        printedTotal: s.printedTotal,
        symbolUrl: s.images.symbol,
        logoUrl: s.images.logo,
      },
    })
  }

  console.log(`✅ ${sets.length} sets seeded`)
}

async function seedCards(sets: TcgSet[]) {
  let total = 0

  for (const s of sets) {
    const setRecord = await prisma.pokemonSet.findUnique({ where: { externalId: s.id } })
    if (!setRecord) continue

    console.log(`  → Fetching cards for ${s.name}...`)
    const cards = await fetchCardsForSet(s.id)

    for (const c of cards) {
      await prisma.card.upsert({
        where: { externalId: c.id },
        create: {
          externalId: c.id,
          setId: setRecord.id,
          name: c.name,
          number: c.number,
          supertype: c.supertype,
          subtypes: c.subtypes ?? [],
          types: c.types ?? [],
          rarity: mapRarity(c.rarity) as any,
          variant: 'NORMAL',
          language: 'EN',
          imageSmUrl: c.images.small,
          imageLgUrl: c.images.large,
          illustrator: c.artist,
          flavorText: c.flavorText,
          hp: c.hp ? parseInt(c.hp) : null,
          evolvesFrom: c.evolvesFrom,
          evolvesTo: c.evolvesTo ?? [],
          attacks: c.attacks ?? [],
          abilities: c.abilities ?? [],
          weaknesses: c.weaknesses ?? [],
          resistances: c.resistances ?? [],
          retreatCost: c.retreatCost ?? [],
          regulationMark: c.regulationMark,
          nationalPokedexNumbers: c.nationalPokedexNumbers ?? [],
          tcgplayerId: c.tcgplayer?.productId ? String(c.tcgplayer.productId) : null,
          cardmarketId: c.cardmarket?.productId ? String(c.cardmarket.productId) : null,
        },
        update: {
          name: c.name,
          imageSmUrl: c.images.small,
          imageLgUrl: c.images.large,
          tcgplayerId: c.tcgplayer?.productId ? String(c.tcgplayer.productId) : null,
          cardmarketId: c.cardmarket?.productId ? String(c.cardmarket.productId) : null,
        },
      })
      total++
    }

    console.log(`    ✅ ${cards.length} cards from ${s.name}`)

    // Rate limit: 1 request / second on free tier
    await new Promise((r) => setTimeout(r, 1100))
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
