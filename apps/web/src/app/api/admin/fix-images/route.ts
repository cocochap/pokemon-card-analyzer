import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

// Sets Pocket TCG — images sur assets.tcgdex.net/fr/tcgp/{set}/{num}/high.webp
const POCKET_SETS = new Set(['A1','A1a','A2','A2a','A2b','A3','A3a','A3b','A4','A4a','B1','B2','B2a'])

function pocketImageUrl(setId: string, num: string): { lg: string; sm: string } {
  const base = `https://assets.tcgdex.net/fr/tcgp/${setId}/${num}`
  return { lg: `${base}/high.webp`, sm: `${base}/low.webp` }
}

function isOldFormatId(externalId: string): boolean {
  // IDs style pokemontcg.io : base1-4, basep-4, swshp-SWSH001, etc.
  const setId = externalId.split('-')[0]
  return !POCKET_SETS.has(setId) && !setId.startsWith('A') && !setId.startsWith('B') && !setId.startsWith('P')
}

export async function GET(req: NextRequest) {
  const isAdmin = req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '300')
  const mode  = req.nextUrl.searchParams.get('mode') ?? 'all' // 'pocket' | 'ptcgio' | 'all'

  const cards = await prisma.card.findMany({
    where: { imageLgUrl: null },
    select: { id: true, externalId: true, number: true },
    take: limit,
  })

  if (!cards.length) return NextResponse.json({ ok: true, updated: 0, message: 'No cards to fix' })

  const ptcgioHeaders: Record<string, string> = process.env.POKEMON_TCG_API_KEY
    ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY }
    : {}

  let updated = 0, skipped = 0
  const errors: string[] = []

  // ── Pocket TCG : URLs construites directement ────────────────────────────
  const pocketCards = cards.filter(c => {
    const s = c.externalId.split('-')[0]
    return POCKET_SETS.has(s)
  })

  if (pocketCards.length && mode !== 'ptcgio') {
    console.log(`[fix-images] Pocket: ${pocketCards.length} cartes`)
    const updates = pocketCards.map(c => {
      const setId = c.externalId.split('-')[0]
      const { lg, sm } = pocketImageUrl(setId, c.number)
      return prisma.card.update({ where: { id: c.id }, data: { imageLgUrl: lg, imageSmUrl: sm } })
    })
    // Batch par 50
    for (let i = 0; i < updates.length; i += 50) {
      await Promise.all(updates.slice(i, i + 50))
      updated += Math.min(50, updates.length - i)
    }
  }

  // ── pokemontcg.io : fetch par set ────────────────────────────────────────
  const ptcgioCards = cards.filter(c => isOldFormatId(c.externalId))

  if (ptcgioCards.length && mode !== 'pocket') {
    console.log(`[fix-images] ptcgio: ${ptcgioCards.length} cartes`)

    const bySet = new Map<string, typeof ptcgioCards>()
    for (const card of ptcgioCards) {
      const s = card.externalId.split('-')[0]
      if (!bySet.has(s)) bySet.set(s, [])
      bySet.get(s)!.push(card)
    }

    for (const [set, setCards] of bySet) {
      try {
        const ids = setCards.map(c => `"${c.externalId}"`).join(' OR ')
        const url = `https://api.pokemontcg.io/v2/cards?q=id:(${ids})&select=id,images&pageSize=${setCards.length}`
        const res = await fetch(url, { headers: ptcgioHeaders, signal: AbortSignal.timeout(15000) })
        if (!res.ok) { errors.push(`${set}: HTTP ${res.status}`); continue }

        const data: any[] = (await res.json()).data ?? []
        const imgMap = new Map(data.map((c: any) => [c.id, c.images]))

        await Promise.all(setCards.map(async card => {
          const images = imgMap.get(card.externalId)
          if (!images?.large && !images?.small) { skipped++; return }
          await prisma.card.update({
            where: { id: card.id },
            data: { imageLgUrl: images.large ?? null, imageSmUrl: images.small ?? null },
          })
          updated++
        }))

        await new Promise(r => setTimeout(r, 150))
      } catch (e: any) {
        errors.push(`${set}: ${e?.message}`)
      }
    }
  }

  console.log(`[fix-images] done: updated=${updated} skipped=${skipped} errors=${errors.length}`)
  return NextResponse.json({ ok: true, updated, skipped, errors: errors.slice(0, 10) })
}
