/**
 * POST /api/ai/scan — Definitive version
 *
 * Tested and confirmed strategies (in order):
 * 1. externalId exact (setId + number variants)
 * 2. English name + number → most reliable (confirmed 1 result for Charizard VMAX SV107)
 * 3. Number alone across all sets
 * 4. English name only, scored by number
 * 5. pokemontcg.io API + auto-import
 */
import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserWithTier, getLimits, getScanUsage, incrementScanUsage } from '@/lib/subscription'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

const PROMPT = `You are an expert Pokémon TCG card reader. Extract ALL of the following from the card image:

1. Card name EXACTLY as printed (keep original language — FR/EN/JP/DE/IT/ES/PT)
2. English equivalent name (translate if needed)
3. Full card number at the bottom (e.g. "001/165", "SV107/SV122", "042/100", "042")
4. Set/expansion name visible on the card (e.g. "Écarlate et Violet - 151", "Sword & Shield")
5. Set ID (pokemontcg.io format if recognizable: sv1, sv3pt5, swsh10, base1, etc. else empty)
6. Language code: FR / EN / JP / DE / ES / IT / PT

CRITICAL RULES:
- Keep suffixes exactly: VMAX, VSTAR, V, ex, GX, EX, Tag Team, BREAK, etc.
- The card number is always at the bottom — read it carefully including leading zeros
- If setId is uncertain, leave it empty rather than guessing wrong

Return ONLY valid JSON (no markdown, no explanation):
{
  "cardName": "Dracaufeu VMAX",
  "englishName": "Charizard VMAX",
  "cardNumber": "SV107/SV122",
  "setName": "Épée et Bouclier - Astres Radieux",
  "setId": "swsh10",
  "language": "FR"
}`

interface AiResult {
  cardName:    string
  englishName: string
  cardNumber:  string
  setName:     string
  setId:       string
  language:    string
}

function extractJson(text: string): AiResult | null {
  const tries = [
    () => { const m = text.match(/\{[\s\S]*\}/g); if (m) return JSON.parse(m[m.length - 1]); throw 0 },
    () => JSON.parse(text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim()),
    () => JSON.parse(text.trim()),
  ]
  for (const fn of tries) {
    try {
      const p = fn()
      if (p?.cardName || p?.englishName || p?.cardNumber) {
        if (!p.cardName && p.englishName) p.cardName = p.englishName
        if (!p.englishName && p.cardName) p.englishName = p.cardName
        if (!p.setName) p.setName = ''
        return p as AiResult
      }
    } catch { /* next */ }
  }
  return null
}

async function runAI(b64: string, mimeType: string): Promise<AiResult | null> {
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [
              { inline_data: { mime_type: mimeType, data: b64 } },
              { text: PROMPT },
            ]}],
            generationConfig: { temperature: 0.0, maxOutputTokens: 200 },
          }),
        },
      )
      const json = await res.json()
      if (!res.ok) continue
      const raw  = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const hint = extractJson(raw)
      if (hint) {
        console.log(`[scan] AI(${model}): "${hint.englishName}" #${hint.cardNumber} set=${hint.setId}`)
        return hint
      }
    } catch (e: any) { console.warn(`[scan] ${model}: ${e?.message}`) }
  }
  return null
}

// ── DB select ──────────────────────────────────────────────────
const SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set:        { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
  prices:     {
    where: { source: 'cardmarket' },  // toujours Cardmarket EUR en priorité
    orderBy: { updatedAt: 'desc' } as any,
    take: 1,
    select: { market: true, low: true, high: true, currency: true, source: true },
  },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}

// Lighter select for candidate list
const CAND_SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true } },
}

// ── Infer possible sets from number format ─────────────────────
function numberSetHints(num: string): string[] {
  const n = num.toUpperCase()
  if (n.match(/^SV\d/))   return ['swsh45sv', 'swsh4sv', 'swsh35sv', 'pgo', 'swsh1']
  if (n.match(/^TG\d/))   return ['swsh9', 'swsh10', 'swsh11', 'swsh12', 'swsh12pt5']
  if (n.match(/^GG\d/))   return ['sv1', 'sv2', 'sv3', 'sv3pt5', 'sv4']
  if (n.match(/^SWSH\d/)) return ['swshp']
  if (n.match(/^SM\d/))   return ['smp']
  if (n.match(/^XY\d/))   return ['xyp']
  return []
}

// ── Main DB lookup ─────────────────────────────────────────────
// La DB est maintenant en français (noms FR en `name`).
// Priorité : externalId → nom FR + numéro → nom EN + numéro → numéro seul → nom seul
async function findCard(hint: AiResult): Promise<any | null> {
  const frName   = (hint.cardName    ?? '').trim()   // nom tel qu'imprimé (FR si carte FR)
  const enName   = (hint.englishName ?? '').trim()   // équivalent EN (fallback)
  const numFull  = (hint.cardNumber  ?? '').split('/')[0].trim()
  const numClean = numFull.replace(/^0+(?=[0-9])/, '')

  if (!frName && !enName && !numFull) return null

  // ── Strategy 1: externalId exact ─────────────────────────────
  const candidateIds = new Set<string>()
  if (hint.setId) {
    candidateIds.add(`${hint.setId}-${numFull}`)
    candidateIds.add(`${hint.setId}-${numClean}`)
    // TCGdex: parfois le numéro est zéro-padded (001 au lieu de 1)
    if (numClean && numClean !== numFull) {
      candidateIds.add(`${hint.setId}-${numClean.padStart(3, '0')}`)
    }
  }
  for (const s of numberSetHints(numFull)) {
    candidateIds.add(`${s}-${numFull}`)
    candidateIds.add(`${s}-${numClean}`)
  }
  for (const extId of candidateIds) {
    const r = await prisma.card.findUnique({ where: { externalId: extId }, select: SEL })
    if (r) { console.log(`[scan] ✅ externalId=${extId}`); return r }
  }

  // ── Strategy 2: nom FR + numéro (nom tel qu'imprimé) ─────────
  for (const name of [frName, enName].filter(Boolean)) {
    if (!name || !numFull) continue
    const candidates = await prisma.card.findMany({
      where: {
        name: { contains: name, mode: 'insensitive' },
        OR: [{ number: numFull }, { number: numClean }],
      },
      select: SEL,
      orderBy: { set: { releaseDate: 'desc' } } as any,
      take: 5,
    })
    if (candidates.length === 1) { console.log(`[scan] ✅ name(${name})+number`); return candidates[0] }
    if (candidates.length > 1) {
      const bySet = hint.setId ? candidates.find(c => c.set.externalId === hint.setId) : null
      const best = bySet ?? candidates[0]
      console.log(`[scan] ✅ name+number (${candidates.length} → ${best.set.externalId})`)
      return best
    }
  }

  // ── Strategy 3: numéro seul ───────────────────────────────────
  if (numFull) {
    const byNum = await prisma.card.findMany({
      where: { OR: [{ number: numFull }, { number: numClean }] },
      select: SEL, take: 20,
    })
    if (byNum.length === 1) { console.log(`[scan] ✅ number alone (unique)`); return byNum[0] }
    if (byNum.length > 1) {
      // Filtrer par nom (FR puis EN)
      for (const name of [frName, enName].filter(Boolean)) {
        const first = name.split(' ')[0].toLowerCase()
        const filtered = byNum.filter(c => c.name.toLowerCase().startsWith(first))
        if (filtered.length >= 1) {
          const exact = filtered.find(c => c.name.toLowerCase() === name.toLowerCase())
          const best = exact ?? filtered[0]
          console.log(`[scan] ✅ number+name prefix`)
          return best
        }
      }
    }
  }

  // ── Strategy 4: nom seul, scoré ──────────────────────────────
  const searchName = frName || enName
  if (searchName) {
    const byName = await prisma.card.findMany({
      where: { name: { contains: searchName, mode: 'insensitive' } },
      select: SEL, take: 30,
    })
    if (!byName.length) return null

    const scored = byName.map(c => {
      let s = 0
      const cn = c.number.split('/')[0].trim()
      if (cn === numFull || cn === numClean) s += 30
      else if (cn.replace(/^[A-Z]+/, '') === numFull.replace(/^[A-Z]+/, '')) s += 10
      if (hint.setId && c.set.externalId === hint.setId) s += 15
      if (c.name.toLowerCase() === searchName.toLowerCase()) s += 5
      if (Number(c.prices?.[0]?.market ?? 0) > 0) s += 1
      return { c, s }
    })
    scored.sort((a, b) => b.s - a.s)
    const best = scored[0]
    if (best.s >= 5) { console.log(`[scan] ✅ name scored (score=${best.s})`); return best.c }
  }

  return null
}

// ── Candidate finder: returns up to 5 ranked candidates ───────
async function findCandidates(hint: AiResult): Promise<any[]> {
  const frName   = (hint.cardName    ?? '').trim()
  const enName   = (hint.englishName ?? '').trim()
  const numFull  = (hint.cardNumber  ?? '').split('/')[0].trim()
  const numClean = numFull.replace(/^0+(?=[0-9])/, '')

  const seen = new Map<string, any>() // id → card

  const add = (cards: any[]) => {
    for (const c of cards) if (!seen.has(c.id)) seen.set(c.id, c)
  }

  // Strategy 1: externalId exact matches
  const candidateIds = new Set<string>()
  if (hint.setId) {
    candidateIds.add(`${hint.setId}-${numFull}`)
    candidateIds.add(`${hint.setId}-${numClean}`)
    if (numClean && numClean !== numFull) candidateIds.add(`${hint.setId}-${numClean.padStart(3, '0')}`)
  }
  for (const s of numberSetHints(numFull)) {
    candidateIds.add(`${s}-${numFull}`)
    candidateIds.add(`${s}-${numClean}`)
  }
  for (const extId of candidateIds) {
    const r = await prisma.card.findUnique({ where: { externalId: extId }, select: CAND_SEL })
    if (r) add([r])
  }

  // Strategy 2: name + number
  for (const name of [frName, enName].filter(Boolean)) {
    if (!name || !numFull) continue
    const rows = await prisma.card.findMany({
      where: { name: { contains: name, mode: 'insensitive' }, OR: [{ number: numFull }, { number: numClean }] },
      select: CAND_SEL, take: 10,
    })
    add(rows)
  }

  // Strategy 3: number alone — return all (up to 10), score by name match
  if (numFull) {
    const byNum = await prisma.card.findMany({
      where: { OR: [{ number: numFull }, { number: numClean }] },
      select: CAND_SEL, take: 10,
    })
    add(byNum)
  }

  // Strategy 4: name alone — top 10, scored by number match
  const searchName = frName || enName
  if (searchName) {
    const byName = await prisma.card.findMany({
      where: { name: { contains: searchName, mode: 'insensitive' } },
      select: CAND_SEL, take: 10,
    })
    add(byName)
  }

  // Score & rank all collected candidates
  const allCandidates = Array.from(seen.values())
  const scored = allCandidates.map(c => {
    let s = 0
    const cn = c.number.split('/')[0].trim()
    if (cn === numFull || cn === numClean) s += 30
    else if (numFull && cn.replace(/^[A-Z]+/, '') === numFull.replace(/^[A-Z]+/, '')) s += 10
    if (hint.setId && c.set.externalId === hint.setId) s += 15
    const cNameLower = c.name.toLowerCase()
    if (frName && cNameLower === frName.toLowerCase()) s += 10
    else if (enName && cNameLower === enName.toLowerCase()) s += 10
    else if (frName && cNameLower.startsWith(frName.split(' ')[0].toLowerCase())) s += 3
    else if (enName && cNameLower.startsWith(enName.split(' ')[0].toLowerCase())) s += 3
    if (Number(c.prices?.[0]?.market ?? 0) > 0) s += 1
    return { c, s }
  })
  scored.sort((a, b) => b.s - a.s)
  return scored.slice(0, 5).map(({ c }) => c)
}

// ── pokemontcg.io: search and return raw card + optional DB card ──
async function searchPtcgioRaw(hint: AiResult): Promise<{ ptcgCard: any; dbCard: any | null } | null> {
  try {
    const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY
      ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    const name = (hint.englishName || hint.cardName || '').trim()
    const num  = (hint.cardNumber ?? '').split('/')[0].trim()

    // Build queries from most to least precise
    const queries: string[] = []
    if (hint.setId && num) queries.push(`number:"${num}" set.id:${hint.setId}`)
    if (hint.setId && name) queries.push(`name:"${name}" set.id:${hint.setId}`)
    if (name && num) queries.push(`name:"${name}" number:"${num}"`)
    if (num && num.length >= 2) queries.push(`number:"${num}"`)
    if (name) queries.push(`name:"${name}"`)

    for (const q of queries) {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=8`, {
        headers, signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const d = await res.json()
      const cards: any[] = d.data ?? []
      if (!cards.length) continue

      // Pick best match: prefer exact number match
      const numClean = num.replace(/^0+(?=[0-9])/, '')
      const match = cards.find(c => c.number === num || c.number === numClean)
        ?? cards.find(c => c.name.toLowerCase().includes(name.toLowerCase().split(' ')[0]))
        ?? cards[0]

      console.log(`[scan] ptcg.io raw: ${match.id} (${match.name} #${match.number})`)
      const dbCard = await prisma.card.findUnique({ where: { externalId: match.id }, select: SEL })
      return { ptcgCard: match, dbCard }
    }
  } catch (e: any) { console.warn('[scan] ptcg.io search:', e?.message) }
  return null
}

// ── Import a single card from PTCG.io data into our DB ────────
async function importCardFromPtcgio(ptcgCard: any): Promise<any | null> {
  try {
    const s = ptcgCard.set
    // Upsert set
    const set = await prisma.pokemonSet.upsert({
      where: { externalId: s.id },
      create: {
        externalId: s.id,
        name: s.name,
        series: s.series ?? 'Unknown',
        totalCards: s.total ?? 0,
        printedTotal: s.printedTotal ?? s.total ?? 0,
        releaseDate: s.releaseDate ? new Date(s.releaseDate) : null,
        logoUrl: s.images?.logo ?? null,
        symbolUrl: s.images?.symbol ?? null,
      },
      update: { logoUrl: s.images?.logo ?? null },
      select: { id: true },
    })

    // Upsert card
    await prisma.card.upsert({
      where: { externalId: ptcgCard.id },
      create: {
        externalId: ptcgCard.id,
        name: ptcgCard.name,
        number: ptcgCard.number,
        supertype: ptcgCard.supertype ?? 'Pokémon',
        subtypes: ptcgCard.subtypes ?? [],
        rarity: ptcgCard.rarity ?? null,
        imageSmUrl: ptcgCard.images?.small ?? null,
        imageLgUrl: ptcgCard.images?.large ?? null,
        set: { connect: { id: set.id } },
      },
      update: {
        imageLgUrl: ptcgCard.images?.large ?? null,
        imageSmUrl: ptcgCard.images?.small ?? null,
      },
    })

    const card = await prisma.card.findUnique({ where: { externalId: ptcgCard.id }, select: SEL })
    if (card) console.log(`[scan] ✅ imported ${ptcgCard.id} into DB`)
    return card
  } catch (e: any) {
    console.error('[scan] import error:', e?.message)
    return null
  }
}

function project(p: number, r: number, y: number) {
  return Math.round(p * Math.pow(1 + r / 100, y) * 100) / 100
}

// Derive a meaningful annual growth rate from investment score when no price history exists
function rateFromScore(investmentScore: number, rarityScore: number): number {
  const score = investmentScore || 50
  if (score >= 90) return 40
  if (score >= 80) return 28
  if (score >= 70) return 18
  if (score >= 60) return 12
  if (score >= 50) return 7
  if (score >= 40) return 3
  return 1
}

// ── Handler ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  // Auth + scan limit check
  const { userId: clerkId } = await auth()
  if (!clerkId) {
    return NextResponse.json({ ok: false, error: 'Connexion requise pour scanner', requiresAuth: true }, { status: 401 })
  }
  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress
  const user = await getUserWithTier(clerkId, email ?? undefined)

  const limits = getLimits(user.tier as any)
  if (limits.scansPerMonth !== Infinity) {
    const used = await getScanUsage(user.id)
    if (used >= limits.scansPerMonth) {
      return NextResponse.json({
        ok: false,
        error: `Limite de ${limits.scansPerMonth} scans/mois atteinte.`,
        limitReached: true,
        used,
        limit: limits.scansPerMonth,
        upgradeUrl: '/pricing',
      }, { status: 429 })
    }
  }

  try {
    const form = await req.formData()

    // Collect all uploaded images (up to 3)
    const imageFiles: File[] = []
    for (const key of ['image', 'image2', 'image3']) {
      const f = form.get(key) as File | null
      if (f && f.size > 0) {
        if (f.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image trop grande (max 10MB)' }, { status: 400 })
        imageFiles.push(f)
      }
    }
    if (!imageFiles.length) return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 })

    // 1. AI — run all images in parallel, pick best result
    const aiResults = await Promise.all(
      imageFiles.map(async (f) => {
        const b64  = Buffer.from(await f.arrayBuffer()).toString('base64')
        const mime = f.type || 'image/jpeg'
        return runAI(b64, mime)
      })
    )

    // Score completeness: setId=3pts, cardNumber=2pts, cardName=1pt
    function scoreResult(r: AiResult | null): number {
      if (!r) return 0
      return (r.setId ? 3 : 0) + (r.cardNumber ? 2 : 0) + (r.cardName || r.englishName ? 1 : 0)
    }

    // Merge: pick best hint, supplement missing fields from other results
    const sorted = [...aiResults].sort((a, b) => scoreResult(b) - scoreResult(a))
    const primary = sorted[0]

    if (!primary?.cardName && !primary?.englishName && !primary?.cardNumber) {
      const count = imageFiles.length
      const advice = count < 2
        ? 'Essaie avec 2-3 photos : recto bien éclairé, numéro visible en bas, carte à plat'
        : 'Vérifiez que le numéro en bas est visible et que la carte est bien éclairée sans reflet'
      return NextResponse.json({ ok: false, error: `Carte non reconnue. ${advice}` }, { status: 422 })
    }

    // Merge missing fields from other results
    const hint: AiResult = { ...primary! }
    for (const r of sorted.slice(1)) {
      if (!hint.setId && r?.setId) hint.setId = r.setId
      if (!hint.cardNumber && r?.cardNumber) hint.cardNumber = r.cardNumber
      if (!hint.cardName && r?.cardName) hint.cardName = r.cardName
      if (!hint.englishName && r?.englishName) hint.englishName = r.englishName
    }
    console.log(`[scan] merged from ${imageFiles.length} images: "${hint.englishName}" #${hint.cardNumber} set=${hint.setId}`)

    // 2. DB search + PTCG.io in parallel for speed
    const [card0, rawCandidates, ptcgResult] = await Promise.all([
      findCard(hint!),
      findCandidates(hint!),
      // Only hit PTCG.io if we have enough info to get a useful result
      (hint.englishName || hint.cardName || hint.cardNumber)
        ? searchPtcgioRaw(hint!)
        : Promise.resolve(null),
    ])

    let card = card0

    // 3. If DB missed, check PTCG.io result
    if (!card) {
      if (ptcgResult?.dbCard) {
        // Card exists in DB under a different search path
        card = ptcgResult.dbCard
        console.log(`[scan] ✅ ptcg.io found existing DB card`)
      } else if (ptcgResult?.ptcgCard) {
        // Card on PTCG.io but not in DB → auto-import it now
        console.log(`[scan] importing ${ptcgResult.ptcgCard.id}...`)
        card = await importCardFromPtcgio(ptcgResult.ptcgCard)
      }
    }

    // Build candidates list: best match first, then DB candidates, then PTCG.io, then AI-only
    const candidateIds = new Set<string>()
    const candidateList: Array<{
      id: string; name: string; number: string; rarity: string
      imageUrl: string | null; setName: string; setId: string
      price: number | null; source?: string
    }> = []

    const buildCandidate = (c: any, source?: string) => ({
      id: c.id,
      name: c.name,
      number: c.number,
      rarity: c.rarity ?? '',
      imageUrl: c.imageLgUrl ?? c.imageSmUrl ?? null,
      setName: c.set?.name ?? '',
      setId: c.set?.externalId ?? '',
      price: Number(c.prices?.[0]?.market ?? 0) || null,
      ...(source ? { source } : {}),
    })

    if (card && !candidateIds.has(card.id)) {
      candidateIds.add(card.id)
      candidateList.push(buildCandidate(card))
    }
    for (const c of rawCandidates) {
      if (!candidateIds.has(c.id)) {
        candidateIds.add(c.id)
        candidateList.push(buildCandidate(c))
        if (candidateList.length >= 5) break
      }
    }

    // If still no candidates but PTCG.io found something (import failed), add as external candidate
    if (candidateList.length === 0 && ptcgResult?.ptcgCard) {
      const p = ptcgResult.ptcgCard
      candidateList.push({
        id: `ptcgio:${p.id}`,
        name: p.name,
        number: p.number,
        rarity: p.rarity ?? '',
        imageUrl: p.images?.large ?? p.images?.small ?? null,
        setName: p.set?.name ?? '',
        setId: p.set?.id ?? '',
        price: p.cardmarket?.prices?.averageSellPrice ?? null,
        source: 'ptcgio',
      })
    }

    // Last resort: AI-only candidate so user always sees something
    if (candidateList.length === 0 && (hint.cardName || hint.englishName)) {
      candidateList.push({
        id: `ai:${hint.cardNumber || 'unknown'}`,
        name: hint.cardName || hint.englishName,
        number: hint.cardNumber || '?',
        rarity: '',
        imageUrl: null,
        setName: hint.setName || hint.setId || 'Extension inconnue',
        setId: hint.setId || '',
        price: null,
        source: 'ai',
      })
    }

    // 5. Build response
    const price      = Number(card?.prices?.[0]?.market ?? 0)
    const md         = card?.marketData ?? null
    const ai         = card?.aiAnalysis ?? null
    const roi1y      = Number(md?.priceChange1y ?? 0)
    const roi90d     = Number(ai?.predictedRoi90d ?? 0) * 4
    const scoreRate  = rateFromScore(md?.investmentScore ?? ai?.investmentScore ?? 0, md?.rarityScore ?? 0)
    const rate       = roi1y !== 0 ? roi1y : roi90d !== 0 ? roi90d : scoreRate
    const proj = price > 0 ? {
      y1: { value: project(price, rate, 1) }, y3: { value: project(price, rate, 3) },
      y5: { value: project(price, rate, 5) }, y10: { value: project(price, rate, 10) },
    } : null
    const pred365 = ai?.predictions?.find((p: any) => p.horizonDays === 365)

    // Count the scan
    await incrementScanUsage(user.id)

    return NextResponse.json({
      ok: true,
      identification: hint,
      candidates: candidateList,
      dbMatch: card ? {
        id: card.id, name: card.name, number: card.number, rarity: card.rarity,
        imageUrl: card.imageLgUrl ?? card.imageSmUrl,
        set: card.set,
        price:  price > 0 ? { market: price, low: Number(card.prices[0].low ?? 0), high: Number(card.prices[0].high ?? 0), currency: card.prices[0].currency } : null,
        market: md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, liquidityScore: md.liquidityScore ?? 0, trendDirection: md.trendDirection, change7d: Number(md.priceChange7d ?? 0), change30d: Number(md.priceChange30d ?? 0), change1y: Number(md.priceChange1y ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0), volatility: Number(md.volatility30d ?? 0) } : null,
        ai:     ai ? { investmentScore: ai.investmentScore, trendDirection: ai.trendDirection, bullishSignals: ai.bullishSignals.slice(0, 3), bearishSignals: ai.bearishSignals.slice(0, 2), keyInsight: ai.keyInsight, pred1y: pred365 ? { value: Number(pred365.predictedPrice), low: Number(pred365.lowerBound), high: Number(pred365.upperBound) } : null } : null,
        projections: proj,
        annualGrowthRate: rate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
