/**
 * Sync card images from pokecardex CDN for sets that lack FR images
 * CDN URL: https://pokecardex-scans.b-cdn.net/sets/{NOM_COURT}/FR/{number}.jpg
 * Number is stripped of leading zeros: "001" → "1"
 *
 * Usage: node scripts/sync-pokecardex-images.mjs [POKECARDEX_CODES...]
 * Example: node scripts/sync-pokecardex-images.mjs MEP MEG MEE
 * No args: processes all known pokecardex FR sets
 */

import { createDecipheriv } from 'crypto'
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: './apps/web/.env' })
config({ path: './apps/web/.env.local' })

const prisma = new PrismaClient()
const KEY = Buffer.from('oe61R0RgVTJm9omokoKuRem2N2GUbUZ8', 'utf8')
const BASE = 'https://www.pokecardex.com'
const CDN  = 'https://pokecardex-scans.b-cdn.net'
const DELAY_MS = 200

function decrypt(payload) {
  const iv  = Buffer.from(payload.iv,   'base64')
  const enc = Buffer.from(payload.data, 'base64')
  const dec = createDecipheriv('aes-256-cbc', KEY, iv)
  return JSON.parse(Buffer.concat([dec.update(enc), dec.final()]).toString('utf8'))
}

function extractPayload(html) {
  const m = html.match(/INITIAL_DATA_ENCRYPTED__\s*=\s*(\{"iv":"[^"]+","data":"[^"]+"\})/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

async function fetchAndDecrypt(path) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
    })
    if (!res.ok) return null
    const html = await res.text()
    const payload = extractPayload(html)
    if (!payload) return null
    return decrypt(payload)
  } catch { return null }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// Strip leading zeros: "001" → "1", "010" → "10", "001a" → "1a"
function stripZeros(numCard) {
  const s = String(numCard ?? '').trim()
  const parsed = parseInt(s, 10)
  if (isNaN(parsed)) return s
  const suffix = s.replace(/^\d+/, '')
  return String(parsed) + suffix
}

function cdnUrl(nomCourt, numCard) {
  return `${CDN}/sets/${nomCourt}/FR/${stripZeros(numCard)}.jpg`
}

async function headOk(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'Referer': 'https://www.pokecardex.com/' } })
    return res.status === 200
  } catch { return false }
}

// Match pokecardex set to our DB set — strict matching to avoid wrong sets
async function findDbSet(nomCourt, frName) {
  // 1. Exact externalId match (pokecardex code lowercased = tcgdex id)
  const byId = await prisma.pokemonSet.findFirst({
    where: { externalId: { equals: nomCourt.toLowerCase() } }
  })
  if (byId) return byId

  // 2. Exact full French name match
  if (frName) {
    const byExact = await prisma.pokemonSet.findFirst({
      where: { name: { equals: frName, mode: 'insensitive' } }
    })
    if (byExact) return byExact
  }

  return null
}

async function syncSetImages(code) {
  console.log(`\n📦 ${code}`)

  process.stdout.write(`  Fetch /series/${code}... `)
  const data = await fetchAndDecrypt(`/series/${code}`)
  if (!data) { console.log('ÉCHEC'); return }

  const cards    = data.cartes ?? []
  const frName   = data.currentSeries?.fullName ?? ''
  const nomCourt = cards[0]?.nom_court ?? code
  console.log(`${cards.length} cartes — "${frName}" (${nomCourt})`)

  if (cards.length === 0) return

  // Test if FR images exist on CDN
  const testCard = cards[0]
  const testUrl  = cdnUrl(nomCourt, testCard.num_card)
  const hasFr    = await headOk(testUrl)
  if (!hasFr) {
    console.log(`  ⚠️  Pas d'images FR sur CDN`)
    return
  }
  console.log(`  ✅ Images FR disponibles`)

  // Find matching DB set
  const dbSet = await findDbSet(nomCourt, frName)
  if (!dbSet) {
    console.log(`  ⚠️  Set introuvable en DB: "${frName}" (${nomCourt})`)
    return
  }
  console.log(`  → DB: ${dbSet.externalId} (${dbSet.name})`)

  // Cards without images in this set
  const nullImgCards = await prisma.card.findMany({
    where: { setId: dbSet.id, imageSmUrl: null },
    select: { id: true, number: true, name: true },
  })

  if (nullImgCards.length === 0) {
    console.log(`  ✓ Toutes les cartes ont déjà une image`)
    return
  }
  console.log(`  → ${nullImgCards.length} cartes sans image`)

  let updated = 0, skipped = 0
  for (const dbCard of nullImgCards) {
    const imgUrl = cdnUrl(nomCourt, dbCard.number)
    try {
      await prisma.card.update({
        where: { id: dbCard.id },
        data: { imageSmUrl: imgUrl, imageLgUrl: imgUrl },
      })
      updated++
    } catch { skipped++ }

    if (updated % 20 === 0 && updated > 0) {
      process.stdout.write(`    ${updated}/${nullImgCards.length}...\r`)
    }
  }

  console.log(`  ✅ ${code}: ${updated} images mises à jour | ${skipped} erreurs`)
}

async function getAllCodes() {
  const data = await fetchAndDecrypt('/series/SVI')
  if (!data) return []
  const blocks = data.seriesMenu?.blocksByRegion?.FR ?? []
  return blocks.flatMap(b => (b.series ?? []).map(s => s.shortName).filter(Boolean))
}

async function main() {
  let codes = process.argv.slice(2).map(a => a.toUpperCase())

  if (codes.length === 0) {
    process.stdout.write('🔍 Récupération de tous les codes pokecardex... ')
    codes = await getAllCodes()
    console.log(`${codes.length} sets`)
  }

  console.log(`🚀 Sync images pokecardex CDN — ${codes.length} sets\n`)

  for (const code of codes) {
    await syncSetImages(code)
    await sleep(DELAY_MS)
  }

  const [total, withImg] = await Promise.all([
    prisma.card.count(),
    prisma.card.count({ where: { imageSmUrl: { not: null } } }),
  ])
  console.log(`\n✨ Terminé ! ${withImg}/${total} cartes avec image`)
  await prisma.$disconnect()
}

main().catch(async e => { console.error(e); await prisma.$disconnect(); process.exit(1) })
