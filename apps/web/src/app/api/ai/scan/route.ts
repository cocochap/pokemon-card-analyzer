import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserWithTier, getLimits, getScanUsage, incrementScanUsage } from '@/lib/subscription'
import { PostHog } from 'posthog-node'
import { charTier, RARITY_W, scarcityScore, detectEra, buildTargets } from '@/lib/investment/helpers'
import { redis } from '@/lib/db/redis'

const ph = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY!, { host: 'https://eu.i.posthog.com', flushAt: 1, flushInterval: 0 })

export const runtime = 'nodejs'
export const maxDuration = 60

// ── Prompts ───────────────────────────────────────────────────────────────────

// Prompt unique — extrait tout ce dont on a besoin pour identifier la carte
const PROMPT_IDENTIFY = `You are identifying a Pokémon TCG card from this image.

Step 1 — look at the BOTTOM of the card for the collector number:
- Regular card: "006/165" or "025/078" → number/total format
- Promo with space: "SVP 173" or "SWSH 098" → set prefix + space + digits
- Promo no space: "SVP173" or "SWSH098" → prefix merged with digits
- Special: "SV107/SV122" or "TG01/TG30" → prefixed number/total
- Secret rare: "166/165" → number higher than total, still write both

Step 2 — look at the TOP for the Pokémon name in both languages if visible.

Return ONLY valid JSON, no markdown, no explanation:
{
  "collector": "006/165",
  "setCode": "SVP",
  "frName": "Dracaufeu ex",
  "enName": "Charizard ex"
}

Field rules:
- collector: copy the EXACT text at the bottom ("SVP 173", "006/165", "TG01/TG30") — never invent or truncate
- setCode: the 2-6 letter set code near the number if it appears SEPARATELY from the collector ("SVP", "SWSH", "SMP", "XYP", "BW", "XY") — use "" if already part of collector or not visible
- frName: name as printed on card (use French if the card is French)
- enName: English Pokémon name (Charizard, Pikachu, Eevee, Charizard ex, Pikachu VMAX)
- Use "" for any field you cannot read clearly`

// ── Utils ─────────────────────────────────────────────────────────────────────
function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[''`\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function numberVariants(raw: string): string[] {
  const base = raw.split('/')[0].trim()
  if (!base) return []
  const vs = new Set<string>([base])
  const noZeros = base.replace(/^0+(?=[0-9])/, '')
  vs.add(noZeros)
  if (/^\d+$/.test(noZeros)) {
    vs.add(noZeros.padStart(2, '0'))
    vs.add(noZeros.padStart(3, '0'))
  }
  const alpha = base.match(/^([A-Z]+)(\d+)$/i)
  if (alpha) {
    const [, pfx, dig] = alpha
    const clean = dig.replace(/^0+(?=[0-9])/, '')
    vs.add(`${pfx.toUpperCase()}${dig}`)
    vs.add(`${pfx.toUpperCase()}${clean}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(2, '0')}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(3, '0')}`)
    vs.add(clean); vs.add(clean.padStart(3, '0'))
  }
  return [...vs].filter(Boolean)
}

function parseTotal(raw: string): number | null {
  const s = (raw ?? '').split('/')[1]?.trim() ?? raw?.trim()
  if (!s || /[A-Za-z]/.test(s)) return null
  const n = parseInt(s, 10)
  return n > 0 && n <= 700 ? n : null
}

function ptcgioToDbId(id: string): string {
  const m1 = id.match(/^sv(\d+)pt(\d+)$/i)
  if (m1) return `sv${m1[1].padStart(2, '0')}.${m1[2]}`
  const m2 = id.match(/^sv(\d+)$/i)
  if (m2) return `sv${m2[1].padStart(2, '0')}`
  return id
}

// Normalise le set code extrait par l'AI ("SVP" → "svp", "SWSH" → "swshp", etc.)
function normalizeSetCode(code: string): string {
  const c = code.toLowerCase().trim()
  if (c === 'svp' || c === 'sv-p') return 'svp'
  if (c === 'swsh' || c === 'swshp') return 'swshp'
  if (c === 'smp' || c === 'sm-p') return 'smp'
  if (c === 'xyp' || c === 'xy-p') return 'xyp'
  if (c === 'bwp' || c === 'bw-p') return 'bwp'
  return c
}

// Parse le champ "collector" retourné par l'AI
// "006/165"  → { num: "006",     total: 165, setCode: null }
// "SVP 173"  → { num: "SVP173",  total: null, setCode: "svp" }   ← préfixe conservé (pokemontcg.io: "SVP173")
// "SV107/SV122" → { num: "SV107", total: null, setCode: null }
// "SWSH001"  → { num: "SWSH001", total: null, setCode: "swshp" }
function parseCollector(collector: string, setCodeHint: string): { num: string; total: number | null; setCode: string | null } {
  const c = (collector ?? '').trim()
  if (!c) return { num: '', total: null, setCode: null }

  // Format "XXX/YYY" — carte normale
  if (c.includes('/')) {
    const [left, right] = c.split('/')
    const num   = left.trim()
    const total = parseTotal(right.trim())
    return { num, total, setCode: null }
  }

  // Format "SET 173" — promo avec espace (ex: "SVP 173")
  // Pokemontcg.io stocke le numéro sous forme "SVP173" (préfixe+chiffres), pas "173"
  const spaceMatch = c.match(/^([A-Z]{2,6})\s+(\d{1,4})$/i)
  if (spaceMatch) {
    const prefix = spaceMatch[1].toUpperCase()
    const digits = spaceMatch[2].padStart(3, '0')
    return { num: `${prefix}${digits}`, total: null, setCode: normalizeSetCode(spaceMatch[1]) }
  }

  // Format "SWSH001" — promo sans espace (lettres + chiffres)
  const promoMatch = c.match(/^([A-Z]{2,5})(\d{2,4})$/i)
  if (promoMatch) {
    const digits = promoMatch[2]
    return { num: `${promoMatch[1].toUpperCase()}${digits}`, total: null, setCode: normalizeSetCode(promoMatch[1]) }
  }

  // Nombre seul
  const setCode = setCodeHint ? normalizeSetCode(setCodeHint) : null
  return { num: c, total: null, setCode }
}

// ── DB selects ────────────────────────────────────────────────────────────────
const SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true, releaseDate: true, logoUrl: true, printedTotal: true, totalCards: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true, source: true } },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}
const CAND_SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { updatedAt: 'desc' } as any, take: 1, select: { market: true } },
}

// ── Score ─────────────────────────────────────────────────────────────────────
function matchScore(card: any, num: string, enName: string, frName: string, total: number | null): number {
  let s = 0
  const nums     = numberVariants(num)
  const cn       = (card.number ?? '').split('/')[0].trim()
  const enNorm   = normalizeName(enName)
  const frNorm   = normalizeName(frName)
  const cardNorm = normalizeName(card.name ?? '')

  if (num && nums.includes(cn))                                           s += 50
  else if (num && cn.replace(/^[A-Z]+/i, '') === num.replace(/^[A-Z]+/i, '')) s += 20

  if (total && (card.set?.printedTotal === total || card.set?.totalCards === total)) s += 35

  if (enNorm && cardNorm === enNorm)                                      s += 40
  else if (frNorm && cardNorm === frNorm)                                 s += 40
  else if (frNorm && frNorm.length >= 3 && cardNorm.includes(frNorm.split(' ')[0])) s += 15
  else if (enNorm && enNorm.length >= 3 && cardNorm.includes(enNorm.split(' ')[0])) s += 10

  if (card.imageLgUrl || card.imageSmUrl)                                 s += 5

  return s
}

// ── Lookup DB ─────────────────────────────────────────────────────────────────
async function findCard(
  num: string, total: number | null, setCode: string | null,
  enName: string, frName: string,
): Promise<any | null> {
  if (!num && !enName && !frName) return null
  const nums = num ? numberVariants(num) : []

  // S0 : externalId direct (promo = setCode + num)  ← NOUVEAU
  if (num && setCode) {
    const extIds = [
      `${setCode}-${num}`,
      `${setCode}-${num.replace(/^0+(?=[0-9])/, '')}`,
      `${setCode}-${num.replace(/^0+(?=[0-9])/, '').padStart(3, '0')}`,
    ]
    const found = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: SEL })
    if (found) { console.log(`[scan] ✅ S0 externalId direct "${found.name}"`); return found }
  }

  // S1 : numéro + total (carte standard — quasi-unique)
  if (num && total) {
    const rows = await prisma.card.findMany({
      where: { number: { in: nums }, set: { OR: [{ printedTotal: total }, { totalCards: total }] } },
      select: SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 10,
    })
    if (rows.length === 1) { console.log(`[scan] ✅ S1 unique "${rows[0].name}"`); return rows[0] }
    if (rows.length > 1) {
      const scored = rows.map(c => ({ c, s: matchScore(c, num, enName, frName, total) })).sort((a, b) => b.s - a.s)
      console.log(`[scan] S1 ${rows.length} résultats, best="${scored[0].c.name}" score=${scored[0].s}`)
      // Exiger un score minimum pour éviter de retourner une mauvaise carte
      if (scored[0].s >= 35 || rows.length === 1) return scored[0].c
      // Si score trop bas mais nom connu, continuer vers S3
      if (!enName && !frName) return scored[0].c
    }
  }

  // S2 : numéro + setCode (même logique mais via set.externalId)
  if (num && setCode) {
    const row = await prisma.card.findFirst({
      where: { number: { in: nums }, set: { externalId: setCode } },
      select: SEL,
    })
    if (row) { console.log(`[scan] ✅ S2 num+setCode "${row.name}"`); return row }
  }

  // S3 : numéro + nom (premier mot)
  if (num && (enName || frName)) {
    const firstWords = [frName, enName].filter(Boolean).map(n => n.split(' ')[0]).filter((v, i, a) => v.length >= 3 && a.indexOf(v) === i)
    for (const word of firstWords) {
      const rows = await prisma.card.findMany({
        where: { name: { contains: word, mode: 'insensitive' }, number: { in: nums } },
        select: SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 10,
      })
      if (rows.length > 0) {
        const scored = rows.map(c => ({ c, s: matchScore(c, num, enName, frName, total) })).sort((a, b) => b.s - a.s)
        console.log(`[scan] ✅ S3 "${scored[0].c.name}" score=${scored[0].s}`)
        return scored[0].c
      }
    }
  }

  // S3b : nom seul → filtrer les résultats dont les chiffres du numéro correspondent
  // Couvre le cas où l'AI retourne "173" au lieu de "SVP173"
  if (num && (enName || frName)) {
    const digits = num.replace(/^[A-Za-z]+/, '').replace(/^0+(?=\d)/, '') // "SVP173"→"173", "006"→"6"
    if (digits.length >= 1) {
      const firstWords = [frName, enName]
        .filter(Boolean).map(n => n.split(' ')[0])
        .filter((v, i, a) => v.length >= 3 && a.indexOf(v) === i)
      for (const word of firstWords) {
        const byName = await prisma.card.findMany({
          where: { name: { contains: word, mode: 'insensitive' } },
          select: SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 40,
        })
        const matching = byName.filter(c => {
          const cn = (c.number ?? '').replace(/^[A-Za-z]+/, '').replace(/^0+(?=\d)/, '')
          return cn === digits
        })
        if (matching.length > 0) {
          const scored = matching.map(c => ({ c, s: matchScore(c, num, enName, frName, total) })).sort((a, b) => b.s - a.s)
          console.log(`[scan] ✅ S3b "${scored[0].c.name}" (nom+chiffres)`)
          return scored[0].c
        }
      }
    }
  }

  // S4 : numéro seul — scorer par nom + date
  if (num) {
    const byNum = await prisma.card.findMany({
      where: { number: { in: nums } },
      select: SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 20,
    })
    if (byNum.length === 1) { console.log(`[scan] ✅ S4 unique "${byNum[0].name}"`); return byNum[0] }
    if (byNum.length > 1) {
      const scored = byNum.map(c => ({ c, s: matchScore(c, num, enName, frName, total) })).sort((a, b) => b.s - a.s)
      if (scored[0].s >= 20) { console.log(`[scan] ✅ S4 "${scored[0].c.name}" score=${scored[0].s}`); return scored[0].c }
      // Sans nom ET score faible : ne pas retourner n'importe quoi, laisser ptcgio tenter
      console.log(`[scan] S4 score trop bas (${scored[0].s}), laisse ptcgio tenter`)
      return null
    }
  }

  // S5 : nom seul (sans numéro)
  if (!num && (enName || frName)) {
    const firstWord = (frName || enName).split(' ')[0]
    if (firstWord.length >= 3) {
      const rows = await prisma.card.findMany({
        where: { name: { contains: firstWord, mode: 'insensitive' } },
        select: SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 10,
      })
      if (rows.length > 0) {
        const scored = rows.map(c => ({ c, s: matchScore(c, '', enName, frName, null) })).sort((a, b) => b.s - a.s)
        console.log(`[scan] ✅ S5 nom seul "${scored[0].c.name}"`)
        return scored[0].c
      }
    }
  }

  return null
}

// ── pokemontcg.io fallback ────────────────────────────────────────────────────
async function searchPtcgio(num: string, total: number | null, enName: string, frName: string): Promise<any | null> {
  try {
    const headers: Record<string, string> = process.env.POKEMON_TCG_API_KEY ? { 'X-Api-Key': process.env.POKEMON_TCG_API_KEY } : {}
    const n = num.replace(/^0+(?=[0-9])/, '')
    const name = enName || frName

    const queries: string[] = []
    if (n && total) queries.push(`number:"${n}" set.printedTotal:"${total}"`)
    if (n && name)  queries.push(`name:"${name}" number:"${n}"`)
    if (n)          queries.push(`number:"${n}"`)

    for (const q of queries.slice(0, 3)) {
      const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=5`, { headers, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const cards: any[] = (await res.json()).data ?? []
      if (!cards.length) continue
      const match = cards.find(c => c.number === num || c.number === n) ?? cards[0]

      // Chercher en DB avec les deux formats d'ID
      const dbId = ptcgioToDbId(match.set?.id ?? '') + '-' + match.number
      const db = await prisma.card.findFirst({
        where: { OR: [{ externalId: match.id }, { externalId: dbId }] },
        select: SEL,
      })
      if (db) { console.log(`[scan] ✅ ptcgio DB "${db.name}"`); return db }

      // Importer si absent
      try {
        const s = match.set
        const set = await prisma.pokemonSet.upsert({
          where: { externalId: s.id },
          create: { externalId: s.id, name: s.name, series: s.series ?? 'Unknown', totalCards: s.total ?? 0, printedTotal: s.printedTotal ?? s.total ?? 0, releaseDate: s.releaseDate ? new Date(s.releaseDate) : null, logoUrl: s.images?.logo ?? null, symbolUrl: s.images?.symbol ?? null },
          update: { logoUrl: s.images?.logo ?? null },
          select: { id: true },
        })
        await prisma.card.upsert({
          where: { externalId: match.id },
          create: { externalId: match.id, name: match.name, number: match.number, supertype: match.supertype ?? 'Pokémon', subtypes: match.subtypes ?? [], rarity: match.rarity ?? null, imageSmUrl: match.images?.small ?? null, imageLgUrl: match.images?.large ?? null, set: { connect: { id: set.id } } },
          update: { imageLgUrl: match.images?.large ?? null },
        })
        const imported = await prisma.card.findUnique({ where: { externalId: match.id }, select: SEL })
        if (imported) { console.log(`[scan] ✅ ptcgio importé "${imported.name}"`); return imported }
      } catch { /* import non critique */ }
    }
  } catch (e: any) { console.warn('[scan] ptcgio:', e?.message) }
  return null
}

// ── Appel AI ──────────────────────────────────────────────────────────────────
async function callGeminiModel(model: string, b64: string, mime: string, prompt: string, maxTokens: number): Promise<string | null> {
  const safeMime = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'].includes(mime) ? mime : 'image/jpeg'
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: safeMime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: maxTokens } }),
        signal: AbortSignal.timeout(8000),
      }
    )
    if (res.status === 429 || !res.ok) return null
    const json = await res.json()
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    return text || null
  } catch { return null }
}

async function callGroq(b64: string, mime: string, prompt: string, maxTokens = 150): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null
  const safeMime = mime.startsWith('image/') ? mime : 'image/jpeg'
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [{ type: 'image_url', image_url: { url: `data:${safeMime};base64,${b64}` } }, { type: 'text', text: prompt }] }],
        max_tokens: maxTokens, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    return (await res.json())?.choices?.[0]?.message?.content ?? null
  } catch { return null }
}

// Race : tous les modèles en même temps — accepte la première réponse avec du contenu utile
async function raceAI(b64: string, mime: string, prompt: string, maxTokens = 150): Promise<string | null> {
  const calls = [
    callGeminiModel('gemini-2.5-flash', b64, mime, prompt, maxTokens),
    callGeminiModel('gemini-flash-latest', b64, mime, prompt, maxTokens),
    callGroq(b64, mime, prompt, maxTokens),
  ]
  try {
    return await Promise.any(calls.map(p => p.then(t => {
      if (!t) throw 0
      // Rejeter les réponses sans données utiles (JSON vide, champs tous vides)
      const parsed = parseJson(t)
      if (!parsed) throw 0
      if (!parsed.collector && !parsed.enName && !parsed.frName) throw 0
      return t
    })))
  } catch {
    // Dernier recours : n'importe quelle réponse non-nulle
    const settled = await Promise.allSettled(calls)
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value) return r.value
    }
    return null
  }
}

function parseJson(text: string | null): Record<string, string> | null {
  if (!text) return null
  const tries = [
    () => { const m = text.match(/\{[^{}]+\}/g); if (m) for (const s of m.reverse()) { try { return JSON.parse(s) } catch {} } throw 0 },
    () => JSON.parse(text.replace(/```[a-z]*/gi, '').replace(/```/g, '').trim()),
  ]
  for (const fn of tries) {
    try { const p = fn(); if (p && typeof p === 'object') return p } catch {}
  }
  return null
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  const [{ userId: clerkId }, form] = await Promise.all([auth(), req.formData()])

  // ── Scan anonyme : 1 essai gratuit par IP ────────────────────────────────
  const isAnonymous = !clerkId
  if (isAnonymous) {
    const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
      || req.headers.get('x-real-ip') || 'unknown'
    const anonKey = `anon_scan:${ip}`
    try {
      const used = redis ? await redis.get(anonKey) : null
      if (used) {
        return NextResponse.json({
          ok: false, requiresAuth: true, anonLimitReached: true,
          error: 'Créez un compte gratuit pour continuer à scanner vos cartes.',
        }, { status: 401 })
      }
    } catch { /* Redis indispo — on laisse passer */ }
  }

  const imageFiles: File[] = []
  for (const key of ['image', 'image2', 'image3']) {
    const f = form.get(key) as File | null
    if (f && f.size > 0) {
      if (f.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image trop grande (max 10MB)' }, { status: 400 })
      imageFiles.push(f)
    }
  }
  if (!imageFiles.length) return NextResponse.json({ ok: false, error: 'No image provided' }, { status: 400 })

  try {
    let user: any = null
    if (!isAnonymous) {
      const clerkUser = await currentUser()
      const email = clerkUser?.emailAddresses[0]?.emailAddress
      user = await getUserWithTier(clerkId!, email ?? undefined)

      const limits = getLimits(user.tier as any)
      if (limits.scansPerMonth !== Infinity) {
        const used = await getScanUsage(user.id)
        if (used >= limits.scansPerMonth) {
          return NextResponse.json({ ok: false, error: `Limite de ${limits.scansPerMonth} scans/mois atteinte.`, limitReached: true, used, limit: limits.scansPerMonth, upgradeUrl: '/pricing' }, { status: 429 })
        }
      }
    }

    const buffers = await Promise.all(imageFiles.map(async f => ({
      b64:  Buffer.from(await f.arrayBuffer()).toString('base64'),
      mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(f.type) ? f.type : 'image/jpeg',
    })))
    const { b64, mime } = buffers[0]

    // ── Étape 1 : identifier la carte (un seul appel AI) ─────────
    const t0 = Date.now()
    const aiText  = await raceAI(b64, mime, PROMPT_IDENTIFY, 150)
    const parsed  = parseJson(aiText)
    const { num, total, setCode } = parseCollector(parsed?.collector ?? '', parsed?.setCode ?? '')
    const enName  = (parsed?.enName ?? '').trim()
    const frName  = (parsed?.frName ?? '').trim()
    console.log(`[scan] AI ${Date.now() - t0}ms collector="${parsed?.collector}" num="${num}" total=${total} setCode="${setCode}" en="${enName}" fr="${frName}"`)

    // ── Étape 2 : chercher en DB ──────────────────────────────────
    let card = await findCard(num, total, setCode, enName, frName)

    // ── Étape 3 : fallback pokemontcg.io si toujours rien ────────
    if (!card && num) {
      const dbScore = card ? matchScore(card, num, enName, frName, total) : 0
      if (dbScore < 30) {
        console.log('[scan] fallback ptcgio')
        card = await searchPtcgio(num, total, enName, frName)
      }
    }

    // ── Étape 4 : construire la réponse ──────────────────────────
    const cardNumber = num && total !== null ? `${num}/${total}` : num

    // Candidats pour la sélection manuelle
    const candidates: any[] = []
    if (card) {
      candidates.push({
        id: card.id, name: card.name, number: card.number, rarity: card.rarity ?? '',
        imageUrl: card.imageLgUrl ?? card.imageSmUrl ?? null,
        setName: card.set?.name ?? '', setId: card.set?.externalId ?? '',
        price: Number(card.prices?.[0]?.market ?? 0) || null,
      })
    }

    // Ajouter d'autres résultats possibles si num+total ambigus
    if (num) {
      const nums = numberVariants(num)
      const others = await prisma.card.findMany({
        where: {
          number: { in: nums },
          ...(total ? { set: { OR: [{ printedTotal: total }, { totalCards: total }] } } : {}),
          ...(card ? { id: { not: card.id } } : {}),
        },
        select: CAND_SEL,
        orderBy: { set: { releaseDate: 'desc' } } as any,
        take: 4,
      })
      for (const c of others) {
        candidates.push({
          id: c.id, name: c.name, number: c.number, rarity: c.rarity ?? '',
          imageUrl: c.imageLgUrl ?? c.imageSmUrl ?? null,
          setName: c.set?.name ?? '', setId: c.set?.externalId ?? '',
          price: Number(c.prices?.[0]?.market ?? 0) || null,
        })
      }
    }

    if (!candidates.length && (enName || frName)) {
      candidates.push({ id: `ai:${num || 'unknown'}`, name: enName || frName, number: cardNumber || '?', rarity: '', imageUrl: null, setName: '', setId: '', price: null })
    }

    // Confiance
    const finalScore = card ? matchScore(card, num, enName, frName, total) : 0
    const confidence = card ? Math.min(98, Math.round(40 + finalScore * 0.55)) : 0
    const autoSelect = confidence >= 67 && !!card

    // Projections
    const price   = Number(card?.prices?.[0]?.market ?? 0)
    const md      = card?.marketData ?? null
    const ai      = card?.aiAnalysis ?? null
    const pred365 = ai?.predictions?.find((p: any) => p.horizonDays === 365)
    let proj = null, annualGrowthRate = 0
    if (price > 0 && card) {
      const rarityW = RARITY_W[card.rarity ?? ''] ?? 0.05
      const exId    = card.set?.externalId ?? ''
      const era     = detectEra(exId, card.set?.name ?? null)
      const cTier   = charTier(card.name)
      const ath     = md?.allTimeHigh ? Number(md.allTimeHigh) : price
      const athDrop = ath > price ? +(((ath - price) / ath) * 100).toFixed(1) : 0
      const targets = buildTargets(price, ath, cTier, rarityW, scarcityScore(exId, card.rarity ?? ''), era, athDrop)
      proj = { y1: { value: targets.t1y }, y3: { value: targets.t3y }, y5: { value: targets.t5y }, y10: { value: targets.t10y } }
      annualGrowthRate = +(((targets.t1y / price) - 1) * 100).toFixed(1)
    }

    if (!isAnonymous && user) {
      await incrementScanUsage(user.id)
      ph.capture({ distinctId: clerkId!, event: 'card_scanned', properties: { card_name: card?.name ?? enName, card_found: !!card, tier: user.tier } })
    } else {
      // Marquer l'IP comme ayant utilisé son scan gratuit (7 jours)
      const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim()
        || req.headers.get('x-real-ip') || 'unknown'
      try { if (redis) await redis.setex(`anon_scan:${ip}`, 7 * 24 * 3600, '1') } catch {}
    }

    return NextResponse.json({
      ok: true,
      isAnonymous,
      confidence,
      autoSelect,
      identification: {
        cardName:    frName || enName || card?.name || '',
        englishName: enName || frName || card?.name || '',
        cardNumber,
        setName:     card?.set?.name || '',
        setId:       card?.set?.externalId || '',
        language:    'FR',
        confidence,
      },
      candidates,
      dbMatch: card ? {
        id: card.id, name: card.name, number: card.number, rarity: card.rarity,
        imageUrl: card.imageLgUrl ?? card.imageSmUrl,
        set: card.set,
        price: price > 0 ? { market: price, low: Number(card.prices[0].low ?? 0), high: Number(card.prices[0].high ?? 0), currency: card.prices[0].currency } : null,
        market: md ? { investmentScore: md.investmentScore ?? 0, rarityScore: md.rarityScore ?? 0, liquidityScore: md.liquidityScore ?? 0, trendDirection: md.trendDirection, change7d: Number(md.priceChange7d ?? 0), change30d: Number(md.priceChange30d ?? 0), change1y: Number(md.priceChange1y ?? 0), allTimeHigh: Number(md.allTimeHigh ?? 0), volatility: Number(md.volatility30d ?? 0) } : null,
        ai: ai ? { investmentScore: ai.investmentScore, trendDirection: ai.trendDirection, bullishSignals: ai.bullishSignals.slice(0, 3), bearishSignals: ai.bearishSignals.slice(0, 2), keyInsight: ai.keyInsight, pred1y: pred365 ? { value: Number(pred365.predictedPrice), low: Number(pred365.lowerBound), high: Number(pred365.upperBound) } : null } : null,
        projections: proj,
        annualGrowthRate,
      } : null,
    })
  } catch (err: any) {
    console.error('[scan] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Scan failed' }, { status: 500 })
  }
}
