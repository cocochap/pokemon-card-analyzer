import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 300

// Récupère les images manquantes depuis pokemontcg.io pour les cartes dont l'externalId
// correspond au format ptcgio standard (ex: basep-4, swshp-SWSH001, etc.)
export async function GET(req: NextRequest) {
  const isAdmin = req.headers.get('x-admin-key') === process.env.ADMIN_SECRET
  if (!isAdmin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit  = parseInt(req.nextUrl.searchParams.get('limit') ?? '200')
  const setId  = req.nextUrl.searchParams.get('set') ?? undefined

  const where: any = { imageLgUrl: null }
  if (setId) where.set = { externalId: setId }

  // Cartes sans image dont l'externalId ressemble à un ID pokemontcg.io (pas Pocket)
  const cards = await prisma.card.findMany({
    where: {
      ...where,
      // Pocket TCG (A1, A2, B2a...) n'est pas sur ptcgio — on skip
      NOT: { externalId: { startsWith: 'A' } },
      AND: [
        { NOT: { externalId: { startsWith: 'B' } } },
        { NOT: { externalId: { startsWith: 'P-' } } },
        { NOT: { externalId: { contains: 'sv-fr' } } },
        { NOT: { externalId: { contains: 'sm-fr' } } },
        { NOT: { externalId: { contains: 'swsh-fr' } } },
      ],
    },
    select: { id: true, externalId: true, name: true },
    take: limit,
  })

  if (!cards.length) return NextResponse.json({ ok: true, updated: 0, message: 'No cards to fix' })

  const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY
    ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY }
    : {}

  let updated = 0
  let notFound = 0
  const errors: string[] = []

  // Grouper par set pour réduire les appels API
  const bySet = new Map<string, typeof cards>()
  for (const card of cards) {
    const setId = card.externalId.split('-')[0]
    if (!bySet.has(setId)) bySet.set(setId, [])
    bySet.get(setId)!.push(card)
  }

  for (const [set, setCards] of bySet) {
    try {
      // Fetch toutes les cartes du set d'un coup
      const ids = setCards.map(c => c.externalId).join(' OR ')
      const url = `https://api.pokemontcg.io/v2/cards?q=id:(${setCards.map(c => `"${c.externalId}"`).join(' OR ')})&select=id,images&pageSize=${setCards.length}`
      const res = await fetch(url, { headers, signal: AbortSignal.timeout(15000) })
      if (!res.ok) { errors.push(`set ${set}: ${res.status}`); continue }

      const data: any[] = (await res.json()).data ?? []
      const imgMap = new Map(data.map((c: any) => [c.id, c.images]))

      for (const card of setCards) {
        const images = imgMap.get(card.externalId)
        if (!images) { notFound++; continue }
        const lgUrl = images.large ?? null
        const smUrl = images.small ?? null
        if (!lgUrl && !smUrl) { notFound++; continue }

        await prisma.card.update({
          where: { id: card.id },
          data: { imageLgUrl: lgUrl, imageSmUrl: smUrl },
        })
        updated++
      }

      await new Promise(r => setTimeout(r, 200)) // rate limiting
    } catch (e: any) {
      errors.push(`set ${set}: ${e?.message}`)
    }
  }

  console.log(`[fix-images] updated=${updated} notFound=${notFound} errors=${errors.length}`)
  return NextResponse.json({ ok: true, updated, notFound, errors: errors.slice(0, 10) })
}
