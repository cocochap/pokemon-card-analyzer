/**
 * Script local — sync prix Cardmarket FR depuis pokecardex.com
 * Lance depuis ta machine : node scripts/sync-pokecardex-prices.mjs
 *
 * Requiert : DATABASE_URL dans .env (ou variable d'env)
 * Usage :
 *   node scripts/sync-pokecardex-prices.mjs              → tous les sets
 *   node scripts/sync-pokecardex-prices.mjs SVI PAL OBF  → sets spécifiques
 */

import { createDecipheriv } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: './apps/web/.env' })
config({ path: './apps/web/.env.local' })

const prisma = new PrismaClient()
const KEY = Buffer.from('oe61R0RgVTJm9omokoKuRem2N2GUbUZ8', 'utf8')
const BASE = 'https://www.pokecardex.com'
const DELAY_MS = 600  // Entre chaque carte (respecter le serveur)

// ── Déchiffrement ────────────────────────────────────────────────
function decrypt(payload) {
  const iv  = Buffer.from(payload.iv,   'base64')
  const enc = Buffer.from(payload.data, 'base64')
  const dec = createDecipheriv('aes-256-cbc', KEY, iv)
  return JSON.parse(Buffer.concat([dec.update(enc), dec.final()]).toString('utf8'))
}

function extractPayload(html) {
  // Chercher le payload chiffré — peut contenir des \/ échappés
  const m = html.match(/INITIAL_DATA_ENCRYPTED__\s*=\s*(\{"iv":"[^"]+","data":"[^"]+"\})/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

async function fetchAndDecrypt(path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
      },
    })
    if (!res.ok) { console.warn(`  HTTP ${res.status} for ${path}`); return null }
    const html = await res.text()
    const payload = extractPayload(html)
    if (!payload) { console.warn(`  Pas de payload sur ${path}`); return null }
    return decrypt(payload)
  } catch(e) {
    console.warn(`  Erreur fetch ${path}: ${e.message}`)
    return null
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Sync un set complet ──────────────────────────────────────────
// Matching par nom français (pokecardex → TCGdex) — pas d'ID hardcodé
async function syncSet(code) {

  // Fetch pokecardex série
  process.stdout.write(`  Fetch pokecardex /series/${code}... `)
  const data = await fetchAndDecrypt(`/series/${code}`)
  if (!data) { console.log('ÉCHEC'); return }

  const cards = data.cartes ?? []
  const frName = data.currentSeries?.fullName ?? ''
  const nomCourt = cards[0]?.nom_court ?? code
  console.log(`${cards.length} cartes — "${frName}"`)

  // 1. Exact externalId match (pokecardex code lowercase = tcgdex id)
  let dbSet = await prisma.pokemonSet.findFirst({
    where: { externalId: { equals: nomCourt.toLowerCase() } }
  })
  // 2. Exact full French name match
  if (!dbSet && frName) {
    dbSet = await prisma.pokemonSet.findFirst({
      where: { name: { equals: frName, mode: 'insensitive' } }
    })
  }
  // 3. Begins-with match (robust against minor name differences)
  if (!dbSet && frName) {
    dbSet = await prisma.pokemonSet.findFirst({
      where: { name: { startsWith: frName.slice(0, 10), mode: 'insensitive' } }
    })
  }
  if (!dbSet) { console.log(`  ⚠️  Set introuvable en DB pour "${frName}" (${nomCourt})`); return }
  console.log(`  → Matched: ${dbSet.externalId} (${dbSet.name})`)

  let priced = 0, notFound = 0, errors = 0

  for (let i = 0; i < cards.length; i++) {
    const pc = cards[i]
    const num = String(pc.num_card ?? '').trim()
    const idCard = pc.id_card
    const name = pc.name_card_fr ?? pc.name_card_en ?? ''

    if (!num || !idCard) continue

    // Chercher dans notre DB
    const numClean = num.replace(/^0+(?=[0-9])/, '')
    const dbCard = await prisma.card.findFirst({
      where: {
        setId: dbSet.id,
        OR: [
          { number: num },
          { number: numClean },
          { number: num.padStart(3, '0') },
        ],
      },
      select: { id: true, rarity: true, name: true },
    })

    if (!dbCard) { notFound++; continue }

    // Fetch prix
    const priceData = await fetchAndDecrypt(`/carte/${idCard}`)
    await sleep(DELAY_MS)

    // Les prix sont dans data.carte.cardmarketPrices (structure réelle pokecardex)
    const prices = priceData?.carte?.cardmarketPrices ?? priceData?.cardmarketPrices ?? []
    const main = prices.find(p => !p.isAlt) ?? prices[0]

    if (!main || !main.trendPrice) { errors++; continue }

    const market = main.trendPrice || main.averageSellPrice || 0
    const low    = main.lowPrice || market * 0.7
    const avg7   = main.avg7 || market
    const avg30  = main.avg30 || market
    const mid    = main.averageSellPrice || market
    const high   = market * 1.35

    if (market <= 0) { errors++; continue }

    // Upsert prix en DB
    try {
      await prisma.cardPrice.upsert({
        where: { cardId_source_variant: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL' } },
        create: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', market, mid, low, high },
        update: { market, mid, low, high, fetchedAt: new Date() },
      })

      // Historique
      const today = new Date(); today.setHours(0,0,0,0)
      const existing = await prisma.priceHistory.findFirst({ where: { cardId: dbCard.id, source: 'cardmarket', recordedAt: { gte: today } } })
      if (!existing) await prisma.priceHistory.create({ data: { cardId: dbCard.id, source: 'cardmarket', variant: 'NORMAL', currency: 'EUR', price: market, recordedAt: today } })

      priced++
      if ((i + 1) % 10 === 0) process.stdout.write(`    ${i+1}/${cards.length} (${priced} pricées)...\r`)
    } catch (e) { errors++ }
  }

  console.log(`  ✅ ${code}: ${priced}/${cards.length} pricées | non trouvées: ${notFound} | erreurs: ${errors}`)
}

// ── Récupère tous les codes de séries FR depuis pokecardex ───────
async function getAllSeriesCodes() {
  // On fetch n'importe quel set pour avoir le menu complet
  const data = await fetchAndDecrypt('/series/SVI')
  if (!data) return []
  const blocks = data.seriesMenu?.blocksByRegion?.FR ?? []
  const codes = []
  for (const block of blocks) {
    for (const serie of block.series ?? []) {
      if (serie.nom_court) codes.push(serie.nom_court)
    }
  }
  return codes
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  let codes = process.argv.slice(2).map(a => a.toUpperCase())

  if (codes.length === 0) {
    process.stdout.write('🔍 Récupération des codes séries depuis pokecardex... ')
    codes = await getAllSeriesCodes()
    console.log(`${codes.length} sets trouvés`)
    if (codes.length === 0) {
      // Fallback sur les sets SV + SWSH prioritaires
      codes = ['SVI','PAL','OBF','MEW','PAR','PAF','TEF','TWM','SFA','SCR','SSP','PRE',
               'SWSHb','CRE','EVS','FST','BRS','ASR','LOR','SIT','CRZ','CEL','PGO']
    }
  }

  console.log(`🚀 Sync prix pokecardex FR — ${codes.length} sets\n`)

  for (const code of codes) {
    console.log(`\n📦 ${code}`)
    await syncSet(code)
  }

  const [total, priced] = await Promise.all([
    prisma.card.count(),
    prisma.cardPrice.count({ where: { source: 'cardmarket' } }),
  ])
  console.log(`\n✨ Terminé ! ${priced}/${total} cartes avec prix Cardmarket FR`)
  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
