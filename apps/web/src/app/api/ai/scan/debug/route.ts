/**
 * POST /api/ai/scan/debug — envoie une image, retourne ce que l'AI extrait + résultats DB
 * GET /api/ai/scan/debug?name=...&number=...&setId=... — test DB lookup seul
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'
export const maxDuration = 30

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

const PROMPTS: Record<string, string> = {
  number: `Look at this Pokémon card. Find the collector number at the bottom.
Return ONLY: {"num":"006","total":"165"}`,

  name: `Look at this Pokémon card. Find the Pokémon name.
Return ONLY: {"frName":"Dracaufeu ex","enName":"Charizard ex","lang":"FR"}`,

  full: `Look at this Pokémon card. Extract collector number and name.
Return ONLY: {"num":"006","total":"165","frName":"Dracaufeu ex","enName":"Charizard ex","lang":"FR","setName":"151"}`,
}

async function callModel(model: string, b64: string, mime: string, prompt: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: mime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0, maxOutputTokens: 150 } }),
        signal: AbortSignal.timeout(12000),
      }
    )
    if (!res.ok) return `HTTP ${res.status}`
    const j = await res.json()
    return j?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'empty'
  } catch (e: any) { return `error: ${e.message}` }
}

export async function POST(req: NextRequest) {
  const form = await req.formData()
  const file = form.get('image') as File | null
  if (!file) return NextResponse.json({ error: 'No image' }, { status: 400 })
  const b64  = Buffer.from(await file.arrayBuffer()).toString('base64')
  const mime = file.type.startsWith('image/') ? file.type : 'image/jpeg'

  // Test tous les modèles et tous les prompts en parallèle
  const results: any = {}
  await Promise.all(
    GEMINI_MODELS.flatMap(model =>
      Object.entries(PROMPTS).map(async ([name, prompt]) => {
        const key = `${model}__${name}`
        results[key] = await callModel(model, b64, mime, prompt)
      })
    )
  )

  // Extraire le meilleur résultat "full" pour tester la DB
  let bestParsed: any = null
  for (const model of GEMINI_MODELS) {
    const raw = results[`${model}__full`]
    try {
      const m = (raw ?? '').match(/\{[^{}]+\}/)
      if (m) { bestParsed = JSON.parse(m[0]); break }
    } catch {}
  }

  let dbResults: any = null
  if (bestParsed?.num) {
    const num   = bestParsed.num.trim()
    const total = parseInt(bestParsed.total ?? '', 10) || null
    const variants = [num, num.replace(/^0+(?=[0-9])/, ''), num.replace(/^0+(?=[0-9])/, '').padStart(3,'0')]
    dbResults = {
      numTotal: total ? await prisma.card.findMany({
        where: { number: { in: variants }, set: { OR: [{ printedTotal: total },{ totalCards: total }] } },
        select: { name: true, number: true, externalId: true, set: { select: { name: true, printedTotal: true } } },
        orderBy: { set: { releaseDate: 'desc' } } as any, take: 5
      }) : [],
      numOnly: await prisma.card.findMany({
        where: { number: { in: variants } },
        select: { name: true, number: true, externalId: true, set: { select: { name: true } } },
        orderBy: { set: { releaseDate: 'desc' } } as any, take: 5
      }),
    }
  }

  return NextResponse.json({ modelResponses: results, bestParsed, dbResults })
}

export async function GET(req: NextRequest) {
  const name   = req.nextUrl.searchParams.get('name') ?? ''
  const number = req.nextUrl.searchParams.get('number') ?? ''
  const setId  = req.nextUrl.searchParams.get('setId') ?? ''

  const numFull  = number.split('/')[0].trim().toUpperCase()
  const numClean = numFull.replace(/^0+(?=[0-9])/, '')

  const results: Record<string, any> = {}

  // Test 1: exact externalId
  for (const extId of [`${setId}-${numFull}`, `${setId}-${numClean}`, `${setId}-${number}`]) {
    if (!setId) break
    const r = await prisma.card.findUnique({ where: { externalId: extId }, select: { id: true, name: true, number: true } })
    if (r) { results.exactId = { extId, card: r }; break }
  }

  // Test 2: name + set
  results.nameAndSet = await prisma.card.count({
    where: { name: { contains: name, mode: 'insensitive' }, set: { externalId: setId } },
  })

  // Test 3: number alone across all sets
  const byNumber = await prisma.card.findMany({
    where: { number: numFull },
    select: { id: true, name: true, number: true, set: { select: { externalId: true, name: true } } },
    take: 10,
  })
  results.byNumberAlone = { count: byNumber.length, cards: byNumber }

  // Test 4: number without prefix across all sets
  if (numFull !== numClean) {
    const byClean = await prisma.card.findMany({
      where: { number: numClean },
      select: { id: true, name: true, number: true, set: { select: { externalId: true } } },
      take: 5,
    })
    results.byNumberClean = byClean
  }

  // Test 5: name + number (no set restriction)
  const byNameNum = await prisma.card.findMany({
    where: {
      name: { contains: name, mode: 'insensitive' },
      OR: [{ number: numFull }, { number: numClean }],
    },
    select: { id: true, name: true, number: true, set: { select: { externalId: true, name: true } } },
    take: 10,
  })
  results.byNameAndNumber = { count: byNameNum.length, cards: byNameNum }

  // Test 6: SV prefix sets
  const svSets = ['swsh45sv', 'swsh4sv', 'swsh35sv', 'pgo']
  const bySetHints: any[] = []
  for (const s of svSets) {
    const r = await prisma.card.findUnique({
      where: { externalId: `${s}-${numFull}` },
      select: { id: true, name: true, number: true, set: { select: { externalId: true } } },
    })
    if (r) bySetHints.push({ tried: `${s}-${numFull}`, card: r })
  }
  results.bySetHints = bySetHints

  return NextResponse.json({ name, number, numFull, numClean, setId, results })
}
