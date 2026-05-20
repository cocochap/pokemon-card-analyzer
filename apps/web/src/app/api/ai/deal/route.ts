import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserWithTier, getLimits, getScanUsage, incrementScanUsage } from '@/lib/subscription'
import { resolveSetId, normalizeName, numberVariants, numberSetHints, extractTotal } from '@/lib/card-lookup'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

const PROMPT_DEAL = `Analyze this marketplace listing image (Vinted, eBay, LeBonCoin, etc.) and extract information about the Pokémon card being sold.

READ ALL TEXT in the image: listing title, description, price tag, condition notes.

Return ONLY this exact JSON structure, no other text:
{
  "cardName": "<name as shown, e.g. Dracaufeu ex>",
  "englishName": "<English name, e.g. Charizard ex>",
  "cardNumber": "<full number e.g. 006/165 or SV107/SV122>",
  "setName": "<expansion name e.g. 151 or Flammes Obsidiennes>",
  "setId": "<pokemontcg.io ID if certain e.g. sv3pt5, else empty string>",
  "language": "<FR or EN or JP>",
  "condition": "<Neuf or Comme neuf or Bon état or État correct or empty>",
  "listingPrice": <price as number e.g. 25.00>,
  "currency": "EUR",
  "listingTitle": "<full listing title text>"
}

Rules:
- listingPrice must be a NUMBER (not a string)
- If you cannot read a value, use empty string "" or 0 for price
- cardNumber must include both parts: "006/165" not just "006"
- Read the listing TITLE first — most reliable source`

interface DealAiResult {
  cardName: string; englishName: string; cardNumber: string
  setName: string; setId: string; language: string; condition: string
  listingPrice: number; currency: string; listingTitle: string
}

// ── AI calls ──────────────────────────────────────────────────────────────────
async function callGemini(b64: string, mime: string): Promise<string | null> {
  const safeMime = ['image/jpeg','image/png','image/webp','image/gif'].includes(mime) ? mime : 'image/jpeg'
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: safeMime, data: b64 } }, { text: PROMPT_DEAL }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 400 } }),
          signal: AbortSignal.timeout(20000) }
      )
      if (res.status === 429) { continue }
      if (!res.ok) continue
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text) return text
    } catch {}
  }
  return null
}

async function callGroq(b64: string, mime: string): Promise<string | null> {
  if (!process.env.GROQ_API_KEY) return null
  const safeMime = mime.startsWith('image/') ? mime : 'image/jpeg'
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{ role: 'user', content: [
          { type: 'image_url', image_url: { url: `data:${safeMime};base64,${b64}` } },
          { type: 'text', text: PROMPT_DEAL },
        ]}],
        max_tokens: 400, temperature: 0.1,
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const json = await res.json()
    return json?.choices?.[0]?.message?.content ?? null
  } catch { return null }
}

function parsePrice(v: any): number {
  if (typeof v === 'number' && v > 0) return v
  if (!v) return 0
  const s = String(v).replace(/[^\d.,]/g, '').replace(',', '.')
  return parseFloat(s) || 0
}

// Extrait tous les objets JSON valides en parsant les accolades équilibrées
function extractAllJsonObjects(text: string): any[] {
  const results: any[] = []
  let depth = 0, start = -1
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '{') { if (depth === 0) start = i; depth++ }
    else if (text[i] === '}') {
      depth--
      if (depth === 0 && start >= 0) {
        try {
          const p = JSON.parse(text.slice(start, i + 1))
          if (p && typeof p === 'object' && !Array.isArray(p)) results.push(p)
        } catch {}
        start = -1
      }
    }
  }
  // Plus grand en premier
  return results.sort((a, b) => Object.keys(b).length - Object.keys(a).length)
}

function buildResult(p: any): DealAiResult | null {
  if (!p || typeof p !== 'object') return null
  const c = (p.card && typeof p.card === 'object') ? p.card : p
  const l = (p.listing && typeof p.listing === 'object') ? p.listing : p

  const cardName    = (c.cardName ?? c.name ?? c.pokemon ?? c.carte ?? '').toString().trim()
  const englishName = (c.englishName ?? c.english ?? c.nom_anglais ?? cardName).toString().trim()
  const cardNumber  = (c.cardNumber ?? c.number ?? c.numero ?? c.numéro ?? c.num ?? '').toString().trim()
  const setName     = (c.setName ?? c.set ?? c.extension ?? c.serie ?? c.série ?? '').toString().trim()
  const setId       = (c.setId ?? c.set_id ?? '').toString().trim()
  const language    = (c.language ?? c.langue ?? 'FR').toString().trim()
  const condition   = (c.condition ?? c.etat ?? c.état ?? c.state ?? '').toString().trim()
  const listingPrice = parsePrice(l.listingPrice ?? l.price ?? l.prix ?? l.listing_price ?? p.listingPrice ?? p.price ?? 0)
  const currency    = (l.currency ?? l.devise ?? 'EUR').toString().trim()
  const listingTitle = (l.listingTitle ?? l.title ?? l.titre ?? l.listing_title ?? '').toString().trim()

  // Accepter dès qu'on a le nom OU le numéro OU le prix
  if (!cardName && !englishName && !cardNumber && listingPrice === 0) return null

  return { cardName, englishName, cardNumber, setName, setId, language, condition, listingPrice, currency, listingTitle }
}

function extractJson(text: string): DealAiResult | null {
  if (!text) return null

  // Variantes de nettoyage à essayer
  const variants = [
    text,
    text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim(),
    (() => { const m = text.match(/```(?:json)?\s*([\s\S]*?)```/i); return m ? m[1] : text })(),
  ]

  for (const cleaned of variants) {
    // 1. Parse direct
    try { const r = buildResult(JSON.parse(cleaned)); if (r) return r } catch {}

    // 2. Tous les JSON valides par parsing de braces équilibrées
    for (const obj of extractAllJsonObjects(cleaned)) {
      const r = buildResult(obj); if (r) return r
    }
  }

  // 3. Extraction regex champ par champ (dernier recours)
  const num   = text.match(/(?:cardNumber|number|numéro|numero)["\s:]+([A-Z0-9]{1,5}\/\d{2,3})/i)
  const name  = text.match(/(?:cardName|englishName|name|carte)["\s:]+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s]+(?:ex|EX|GX|VMAX|VSTAR|V)?)/i)
  const price = text.match(/(?:listingPrice|price|prix)["\s:]+(\d+(?:[.,]\d{1,2})?)/i)
  const set   = text.match(/(?:setName|extension|série|serie)["\s:]+([^"\n,}{]+)/i)

  if (name || num) {
    console.warn('[deal] using regex fallback extraction')
    return {
      cardName: name?.[1]?.trim() ?? '',
      englishName: name?.[1]?.trim() ?? '',
      cardNumber: num?.[1]?.trim() ?? '',
      setName: set?.[1]?.trim() ?? '',
      setId: '', language: 'FR', condition: '',
      listingPrice: price ? parseFloat(price[1].replace(',', '.')) : 0,
      currency: 'EUR', listingTitle: '',
    }
  }

  return null
}

// Parse le slug d'une URL Vinted pour extraire des infos de secours
function parseVintedSlug(url: string): Partial<DealAiResult> | null {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    if (!u.hostname.includes('vinted.')) return null
    const m = u.pathname.match(/\/items\/\d+-(.+)$/)
    if (!m) return null
    const slug = m[1].replace(/-+/g, ' ').trim() // "mew-205-serie-151-fr" → "mew 205 serie 151 fr"
    const numM = slug.match(/\b(\d{2,3})\b/)
    const setM = slug.match(/\b(1[0-9]{2}|[1-9]\d{2})\b.*\b(1[0-9]{2}|[1-9]\d{2})\b/) ?? slug.match(/serie[s]?\s+(\d{3})/i)
    return {
      listingTitle: slug,
      cardNumber: numM ? numM[1] : '',
      setName: setM ? setM[1] : '',
    }
  } catch { return null }
}

// Select minimal pour le deal — pas d'aiAnalysis pour éviter les erreurs Prisma
const DEAL_SEL = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true, logoUrl: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true } },
  marketData: { select: { priceChange7d: true, priceChange30d: true, allTimeHigh: true, investmentScore: true, trendDirection: true } },
}

async function findCard(ai: DealAiResult): Promise<any | null> {
  const numRaw  = (ai.cardNumber ?? '').split('/')[0].trim()
  const nums    = numberVariants(numRaw)
  const setHint = { cardName: ai.cardName, englishName: ai.englishName, cardNumber: ai.cardNumber, setName: ai.setName, setId: ai.setId }
  const setId   = await resolveSetId(setHint)

  console.warn(`[deal] findCard: name="${ai.cardName}" num="${numRaw}" setId="${setId}" setName="${ai.setName}"`)

  // S1 : externalId exact
  const setIds = new Set<string>([...[setId, ai.setId].filter(Boolean), ...numberSetHints(numRaw)])
  const extIds = [...setIds].flatMap(sid => nums.map(n => `${sid}-${n}`))
  if (extIds.length) {
    const c = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: DEAL_SEL })
    if (c) { console.warn(`[deal] ✅ S1 ${c.name} (${c.set.externalId})`); return c }
  }

  // S2 : nom + numéro
  const names = [ai.englishName, ai.cardName].filter((v, i, a) => v && a.indexOf(v) === i)
  if (numRaw && names.length) {
    const rows = (await Promise.all(names.map(n =>
      prisma.card.findMany({ where: { name: { contains: n, mode: 'insensitive' }, number: { in: nums } }, select: DEAL_SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 8 })
    ))).flat()
    if (rows.length) {
      const best = setId ? (rows.find(c => c.set.externalId === setId) ?? rows[0]) : rows[0]
      console.warn(`[deal] ✅ S2 ${best.name} (${best.set.externalId})`); return best
    }
  }

  // S3 : numéro + setId
  if (numRaw && setId) {
    const c = await prisma.card.findFirst({ where: { number: { in: nums }, set: { externalId: setId } }, select: DEAL_SEL })
    if (c) { console.warn(`[deal] ✅ S3 ${c.name}`); return c }
  }

  // S4 : numéro seul (si unique ou match par nom)
  if (numRaw) {
    const rows = await prisma.card.findMany({ where: { number: { in: nums } }, select: DEAL_SEL, take: 30 })
    if (rows.length === 1) return rows[0]
    for (const norm of [normalizeName(ai.englishName), normalizeName(ai.cardName)].filter(Boolean)) {
      const exact = rows.find(c => normalizeName(c.name) === norm)
      if (exact) { console.warn(`[deal] ✅ S4 ${exact.name}`); return exact }
      const prefix = rows.filter(c => normalizeName(c.name).startsWith(norm.split(' ')[0]))
      if (prefix.length === 1) return prefix[0]
      if (prefix.length > 1 && setId) { const hit = prefix.find(c => c.set.externalId === setId); if (hit) return hit }
    }
  }

  // S5 : nom + setId
  if (setId && (ai.englishName || ai.cardName)) {
    const c = await prisma.card.findFirst({ where: { name: { contains: ai.englishName || ai.cardName, mode: 'insensitive' }, set: { externalId: setId } }, select: DEAL_SEL })
    if (c) { console.warn(`[deal] ✅ S5 ${c.name}`); return c }
  }

  // S6 : nom seul (dernier recours)
  const name = ai.englishName || ai.cardName
  if (name) {
    const rows = await prisma.card.findMany({ where: { name: { contains: name, mode: 'insensitive' } }, select: DEAL_SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 10 })
    const norm = normalizeName(name)
    const exact = rows.find(c => normalizeName(c.name) === norm)
    if (exact) { console.warn(`[deal] ✅ S6 exact ${exact.name}`); return exact }
    if (rows.length === 1) { console.warn(`[deal] ✅ S6 only ${rows[0].name}`); return rows[0] }
  }

  console.warn('[deal] ❌ card not found')
  return null
}

// ── Listing URL helpers ───────────────────────────────────────────────────────

function detectPlatform(url: string): string {
  if (url.includes('vinted.')) return 'Vinted'
  if (url.includes('ebay.')) return 'eBay'
  if (url.includes('leboncoin.')) return 'LeBonCoin'
  if (url.includes('facebook.')) return 'Facebook'
  if (url.includes('instagram.')) return 'Instagram'
  return 'Marketplace'
}

async function fetchListingMeta(url: string): Promise<{ title: string; price: number; platform: string } | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // Extract og:title
    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i)
      ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const title = titleMatch?.[1]?.trim() ?? ''

    // Extract price — look for common patterns
    const pricePatterns = [
      /["']price["']\s*:\s*["']?([\d.,]+)/i,
      /"price_amount"\s*:\s*"([\d.]+)"/i,
      /content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i,
      /<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([\d.,]+)/i,
      /class=["'][^"']*price[^"']*["'][^>]*>([\d.,\s]+)(?:\s*€)/i,
    ]
    let price = 0
    for (const pat of pricePatterns) {
      const m = html.match(pat)
      if (m) { price = parseFloat(m[1].replace(',', '.')); break }
    }

    return { title, price, platform: detectPlatform(url) }
  } catch {
    return null
  }
}

// ── Deal scoring ──────────────────────────────────────────────────────────────
function conditionMultiplier(condition: string): number {
  const c = condition.toLowerCase()
  if (c.includes('neuf') && !c.includes('comme')) return 1.05
  if (c.includes('comme neuf') || c.includes('mint') || c.includes('nm')) return 1.00
  if (c.includes('bon') || c.includes('good') || c.includes('ex')) return 0.85
  if (c.includes('correct') || c.includes('played')) return 0.70
  if (c.includes('mauvais') || c.includes('poor') || c.includes('damaged')) return 0.50
  return 0.95 // unknown → légèrement sous NM
}

function computeDeal(listingPrice: number, marketPrice: number, condition: string) {
  if (!marketPrice || marketPrice <= 0) return null

  // Ajuster le prix marché selon l'état
  const condMult = conditionMultiplier(condition)
  const adjustedMarket = marketPrice * condMult

  const savingsEur = adjustedMarket - listingPrice
  const savingsPct = (savingsEur / adjustedMarket) * 100

  // Score : 50 = prix du marché, +2.5 pts par % d'économie
  const score = Math.max(0, Math.min(100, Math.round(50 + savingsPct * 2.5)))

  const label =
    score >= 82 ? 'Excellente affaire' :
    score >= 66 ? 'Bonne affaire' :
    score >= 48 ? 'Prix du marché' :
    score >= 30 ? 'Un peu cher' :
    'Trop cher'

  const emoji =
    score >= 82 ? '🔥' :
    score >= 66 ? '✅' :
    score >= 48 ? '➡️' :
    score >= 30 ? '⚠️' : '❌'

  // Prix de négociation suggéré
  const suggestedPrice = score < 66
    ? +(adjustedMarket * (score < 30 ? 0.88 : 0.93)).toFixed(2)
    : null

  return {
    score, label, emoji,
    savingsEur: +savingsEur.toFixed(2),
    savingsPct: +savingsPct.toFixed(1),
    adjustedMarket: +adjustedMarket.toFixed(2),
    suggestedPrice,
    conditionMultiplier: condMult,
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })

  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ ok: false, error: 'Connexion requise', requiresAuth: true }, { status: 401 })

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress
  const user = await getUserWithTier(clerkId, email ?? undefined)

  const limits = getLimits(user.tier as any)
  if (limits.scansPerMonth !== Infinity) {
    const used = await getScanUsage(user.id)
    if (used >= limits.scansPerMonth) {
      return NextResponse.json({ ok: false, error: `Limite de ${limits.scansPerMonth} scans/mois atteinte.`, limitReached: true, upgradeUrl: '/pricing' }, { status: 429 })
    }
  }

  try {
    const form = await req.formData()
    const file = form.get('image') as File | null
    const listingUrl = (form.get('url') as string | null)?.trim() || null

    if (!file || file.size === 0) return NextResponse.json({ ok: false, error: 'Aucune image fournie' }, { status: 400 })
    if (file.size > 10 * 1024 * 1024) return NextResponse.json({ ok: false, error: 'Image trop grande (max 10MB)' }, { status: 400 })

    const mime = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) ? file.type : 'image/jpeg'
    const b64 = Buffer.from(await file.arrayBuffer()).toString('base64')

    // ── Fetch listing meta depuis l'URL si fournie ────────────────
    let urlMeta: { title: string; price: number; platform: string } | null = null
    if (listingUrl) {
      urlMeta = await fetchListingMeta(listingUrl)
    }

    // ── Extraction IA ─────────────────────────────────────────────
    const rawText = await callGemini(b64, mime) ?? await callGroq(b64, mime)
    if (!rawText) return NextResponse.json({ ok: false, error: 'Impossible d\'analyser l\'image. Réessaie avec une meilleure photo.' }, { status: 422 })

    const ai = extractJson(rawText)
    if (!ai) {
      console.warn('[deal] extractJson failed. Raw:', rawText.substring(0, 300))
      return NextResponse.json({ ok: false, error: 'Impossible d\'extraire les informations de l\'annonce. Assure-toi que l\'image montre bien la carte et le prix.' }, { status: 422 })
    }

    // Enrichir avec les données de l'URL si dispo
    if (urlMeta) {
      if (!ai.listingPrice && urlMeta.price) ai.listingPrice = urlMeta.price
      if (!ai.listingTitle && urlMeta.title) ai.listingTitle = urlMeta.title
    }
    // Enrichir avec le slug Vinted si champs manquants
    if (listingUrl) {
      const slug = parseVintedSlug(listingUrl)
      if (slug) {
        if (!ai.cardNumber && slug.cardNumber) ai.cardNumber = slug.cardNumber
        if (!ai.setName   && slug.setName)    ai.setName    = slug.setName
        if (!ai.listingTitle && slug.listingTitle) ai.listingTitle = slug.listingTitle
      }
    }

    // ── Recherche en base ─────────────────────────────────────────
    const card = await findCard(ai)

    // ── Prix marché : CardPrice → priceHistory → marketData ───────
    let marketPrice = card ? Number(card.prices?.[0]?.market ?? 0) : 0

    if (!marketPrice && card) {
      // Fallback 1 : dernière entrée priceHistory
      const lastPH = await prisma.priceHistory.findFirst({
        where: { cardId: card.id, source: 'cardmarket' },
        orderBy: { recordedAt: 'desc' },
        select: { price: true },
      })
      if (lastPH) marketPrice = Number(lastPH.price)
    }

    if (!marketPrice && card) {
      // Fallback 2 : toutes sources CardPrice
      const anyPrice = await prisma.cardPrice.findFirst({
        where: { cardId: card.id },
        orderBy: { fetchedAt: 'desc' },
        select: { market: true, mid: true },
      })
      if (anyPrice) marketPrice = Number(anyPrice.market ?? anyPrice.mid ?? 0)
    }

    console.warn(`[deal] listingPrice=${ai.listingPrice} marketPrice=${marketPrice} card=${card?.name ?? 'null'}`)

    // ── Calcul du deal ────────────────────────────────────────────
    const deal = ai.listingPrice > 0 && marketPrice > 0
      ? computeDeal(ai.listingPrice, marketPrice, ai.condition)
      : null

    await incrementScanUsage(user.id)

    return NextResponse.json({
      ok: true,
      ai: {
        cardName: ai.cardName,
        englishName: ai.englishName,
        cardNumber: ai.cardNumber,
        setName: ai.setName,
        condition: ai.condition,
        listingPrice: ai.listingPrice,
        currency: ai.currency,
        listingTitle: ai.listingTitle,
      },
      card: card ? {
        id:    card.id,
        name:  card.name,
        number: card.number,
        rarity: card.rarity,
        imageUrl: card.imageLgUrl ?? card.imageSmUrl ?? null,
        set:   { name: card.set?.name, externalId: card.set?.externalId, logoUrl: card.set?.logoUrl ?? null },
        marketPrice,
        marketLow:  Number(card.prices?.[0]?.low  ?? 0),
        marketHigh: Number(card.prices?.[0]?.high ?? 0),
        change7d:   Number(card.marketData?.priceChange7d  ?? 0),
        change30d:  Number(card.marketData?.priceChange30d ?? 0),
        trendDirection: card.marketData?.trendDirection ?? 'STABLE',
        investmentScore: card.marketData?.investmentScore ?? 0,
        allTimeHigh: Number(card.marketData?.allTimeHigh ?? 0),
      } : null,
      deal,
      noMarketPrice: marketPrice === 0,
      listingUrl,
      listingPlatform: listingUrl ? detectPlatform(listingUrl) : null,
    })
  } catch (err: any) {
    console.error('[deal] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Erreur interne' }, { status: 500 })
  }
}
