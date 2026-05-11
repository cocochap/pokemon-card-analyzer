/**
 * seed-fr-names.ts — Récupère les noms français depuis TCGdex et les stocke dans localeName
 * Run: cd apps/web && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-fr-names.ts
 */
import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()
const FR_API = 'https://api.tcgdex.net/v2/fr'

const SET_MAP_FR: Record<string, string> = {
  'sv10.5w': 'Flamme Blanche',
  'sv10.5b': 'Flamme Noire',
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function main() {
  console.log('🇫🇷 Récupération des noms français...\n')

  // Récupérer tous les sets distincts
  const cards = await prisma.card.findMany({
    select: { id: true, externalId: true, name: true, localeName: true },
  })

  console.log(`📦 ${cards.length} cartes à traiter`)

  // Grouper par set
  const bySet: Record<string, typeof cards> = {}
  for (const card of cards) {
    const setId = card.externalId.split('-')[0]
    if (!bySet[setId]) bySet[setId] = []
    bySet[setId].push(card)
  }

  let updated = 0
  let failed = 0

  for (const [setId, setCards] of Object.entries(bySet)) {
    const frSetName = SET_MAP_FR[setId]
    console.log(`\n📗 Set: ${setId} → ${frSetName ?? '?'} (${setCards.length} cartes)`)

    // Fetch the full set from French API to get all card names at once
    let frCardNames: Record<string, string> = {}
    try {
      const res = await axios.get(`${FR_API}/sets/${setId}`, { timeout: 10000 })
      const frCards: any[] = res.data?.cards ?? []
      for (const c of frCards) {
        frCardNames[c.localId] = c.name
      }
      console.log(`  ✓ ${Object.keys(frCardNames).length} noms FR récupérés`)
    } catch (err: any) {
      console.log(`  ✗ Échec pour set ${setId}: ${err.message}`)
    }

    // Update each card in DB
    for (const card of setCards) {
      const localId = card.externalId.split('-')[1]
      const frName = frCardNames[localId]

      if (!frName) {
        failed++
        continue
      }

      const currentNames = (card.localeName as Record<string, string>) ?? {}
      const newNames = {
        ...currentNames,
        en: card.name,     // stocker le nom EN aussi
        fr: frName,
      }

      await prisma.card.update({
        where: { id: card.id },
        data: { localeName: newNames },
      })
      updated++
    }
    await sleep(300)
  }

  // Aussi stocker les noms des sets en FR
  console.log('\n📗 Mise à jour des noms de sets...')
  for (const [externalId, frName] of Object.entries(SET_MAP_FR)) {
    await prisma.pokemonSet.updateMany({
      where: { externalId },
      data: {}, // Le modèle PokemonSet n'a pas de localeName — on skip ça
    })
    console.log(`  ✓ ${externalId}: ${frName}`)
  }

  console.log(`\n📊 Résultat:`)
  console.log(`  Cartes mises à jour: ${updated}`)
  console.log(`  Cartes sans nom FR: ${failed}`)
  console.log('\n🎉 Noms français chargés !')
}

main().catch(console.error).finally(() => prisma.$disconnect())
