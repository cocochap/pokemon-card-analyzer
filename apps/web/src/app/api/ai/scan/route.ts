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

// La DB contient maintenant les noms FRANÇAIS en priorité (via TCGdex FR).
// Le prompt demande le nom tel qu'il est imprimé sur la carte + son équivalent anglais.
const PROMPT = `You are reading a Pokémon TCG card. Return three things:

1. The card name EXACTLY AS PRINTED on the card (keep the original language — French, English, Japanese, etc.)
2. The English equivalent of that name (for reference)
3. The card NUMBER as printed at the bottom (e.g. "001/165", "SV107/SV122", "042")

SUFFIX RULES: Keep suffixes as-is in any language — VMAX, VSTAR, V, ex, GX, EX, Tag Team, etc.

Return ONLY this JSON (no markdown, no explanation):
{
  "cardName": "Dracaufeu VMAX",
  "englishName": "Charizard VMAX",
  "cardNumber": "SV107/SV122",
  "setId": "TCGdex/pokemontcg.io set ID if visible (e.g. sv1, swsh45sv, base1, A1), else empty string",
  "language": "FR"
}`

interface AiResult {
  cardName:    string   // nom tel qu'imprimé sur la carte (FR si carte FR)
  englishName: string   // équivalent anglais (pour fallback)
  cardNumber:  string
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
        // Normalise : si cardName absent, utilise englishName
        if (!p.cardName && p.englishName) p.cardName = p.englishName
        if (!p.englishName && p.cardName) p.englishName = p.cardName
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

// ── pokemontcg.io API fallback ────────────────────────────────
async function ptcgFallback(hint: AiResult): Promise<any | null> {
  try {
    const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY
      ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    const name = hint.englishName
    const num  = (hint.cardNumber ?? '').split('/')[0].trim()

    const queries = [
      hint.setId ? `name:"${name}" number:"${num}" set.id:${hint.setId}` : null,
      `name:"${name}" number:"${num}"`,
      `name:"${name}"`,
    ].filter(Boolean) as string[]

    for (const q of queries) {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`, {
        headers, signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue
      const d = await res.json()
      const cards = d.data ?? []
      if (!cards.length) continue
      const match = cards.find((c: any) => c.number === num || c.number === num.replace(/^0+/, '')) ?? cards[0]
      console.log(`[scan] ptcg.io: ${match.id}`)
      const db = await prisma.card.findUnique({ where: { externalId: match.id }, select: SEL })
      if (db) return db
    }
  } catch (e: any) { console.warn('[scan] ptcg.io:', e?.message) }
  return null
}

function project(p: number, r: number, y: number) {
  return Math.round(p * Math.pow(1 + r / 100, y) * 100) / 100
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

    // 2. DB search (best match + candidates in parallel)
    let card = await findCard(hint!)

    // 3. pokemontcg.io fallback
    if (!card) {
      console.log('[scan] trying pokemontcg.io...')
      card = await ptcgFallback(hint!)
    }

    // 4. Auto-import set + retry
    if (!card && hint?.setId) {
      try {
        const origin = new URL(req.url).origin
        await fetch(`${origin}/api/admin/sync-sets?setId=${hint.setId}&limit=1`, {
          method: 'POST', signal: AbortSignal.timeout(40000),
        })
        card = await findCard(hint!)
      } catch { /* ignore */ }
    }

    // 4b. Find candidates for confirmation step
    const rawCandidates = await findCandidates(hint!)

    // Build candidates list: ensure best match appears first, dedup by id
    const candidateIds = new Set<string>()
    const candidateList: Array<{
      id: string; name: string; number: string; rarity: string
      imageUrl: string | null; setName: string; setId: string
      price: number | null
    }> = []

    const buildCandidate = (c: any) => ({
      id: c.id,
      name: c.name,
      number: c.number,
      rarity: c.rarity ?? '',
      imageUrl: c.imageLgUrl ?? c.imageSmUrl ?? null,
      setName: c.set?.name ?? '',
      setId: c.set?.externalId ?? '',
      price: Number(c.prices?.[0]?.market ?? 0) || null,
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

    // 5. Build response
    const price      = Number(card?.prices?.[0]?.market ?? 0)
    const md         = card?.marketData ?? null
    const ai         = card?.aiAnalysis ?? null
    const roi1y      = Number(md?.priceChange1y ?? 0)
    const roi90d     = Number(ai?.predictedRoi90d ?? 0) * 4
    const rate       = roi1y !== 0 ? roi1y : roi90d !== 0 ? roi90d : 8
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
