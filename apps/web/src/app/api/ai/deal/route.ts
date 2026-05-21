import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { prisma } from '@/lib/db/prisma'
import { getUserWithTier, getLimits, getScanUsage, incrementScanUsage } from '@/lib/subscription'
import { resolveSetId, normalizeName, numberVariants, numberSetHints, extractTotal } from '@/lib/card-lookup'

export const runtime = 'nodejs'
export const maxDuration = 60

const GEMINI_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']

// Prompt pour screenshot d'annonce (PROMPT_DEAL — lit tout le texte visible)
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

// Prompt pour photo de carte (même que le scan — identifie via le numéro en bas)
const PROMPT_IDENTIFY = `You are identifying a Pokémon TCG card from this image.

Look at the BOTTOM of the card. You will see either:
- A regular card: "006/165" (number/total)
- A promo card: "SVP 173" or "SWSH001" (set code + number, no slash)
- A special card: "SV107/SV122" (prefixed number/total)

Also look at the TOP for the Pokémon name.

Return ONLY this JSON:
{
  "collector": "006/165",
  "setCode": "",
  "frName": "Dracaufeu ex",
  "enName": "Charizard ex"
}

Rules:
- collector: the FULL text at the bottom exactly as shown ("006/165", "SVP 173", "SV107/SV122", "SWSH001")
- setCode: the set abbreviation if visible near the number ("SVP", "SWSH", "SMP", "XYP", etc.) — leave "" if not visible separately
- frName: Pokémon name as printed on card (French if FR card)
- enName: English name always (Eevee, Charizard ex, Pikachu VMAX...)
- Use "" for any field not found`

// Normalise le set code ("SVP" → "svp", "SWSH" → "swshp")
function normalizeSetCode(code: string): string {
  const c = code.toLowerCase().trim()
  if (c === 'svp' || c === 'sv-p') return 'svp'
  if (c === 'swsh' || c === 'swshp') return 'swshp'
  if (c === 'smp' || c === 'sm-p') return 'smp'
  if (c === 'xyp' || c === 'xy-p') return 'xyp'
  if (c === 'bwp' || c === 'bw-p') return 'bwp'
  return c
}

// Parse le champ "collector" retourné par PROMPT_IDENTIFY
function parseCollector(collector: string, setCodeHint: string): { num: string; total: number | null; setCode: string | null } {
  const c = (collector ?? '').trim()
  if (!c) return { num: '', total: null, setCode: null }
  if (c.includes('/')) {
    const [left, right] = c.split('/')
    const num = left.trim()
    const t = parseInt(right?.trim() ?? '', 10)
    const total = t > 0 && t <= 500 ? t : null
    return { num, total, setCode: null }
  }
  const spaceMatch = c.match(/^([A-Z]{2,6})\s+(\d{1,4})$/i)
  if (spaceMatch) {
    const prefix = spaceMatch[1].toUpperCase()
    const digits = spaceMatch[2].padStart(3, '0')
    return { num: `${prefix}${digits}`, total: null, setCode: normalizeSetCode(spaceMatch[1]) }
  }
  const promoMatch = c.match(/^([A-Z]{2,5})(\d{2,4})$/i)
  if (promoMatch) {
    return { num: `${promoMatch[1].toUpperCase()}${promoMatch[2]}`, total: null, setCode: normalizeSetCode(promoMatch[1]) }
  }
  return { num: c, total: null, setCode: setCodeHint ? normalizeSetCode(setCodeHint) : null }
}

interface DealAiResult {
  cardName: string; englishName: string; cardNumber: string
  setName: string; setId: string; language: string; condition: string
  listingPrice: number; currency: string; listingTitle: string
}

// ── AI calls ──────────────────────────────────────────────────────────────────
async function callGemini(b64: string, mime: string, prompt = PROMPT_DEAL): Promise<string | null> {
  const safeMime = ['image/jpeg','image/png','image/webp','image/gif'].includes(mime) ? mime : 'image/jpeg'
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ inline_data: { mime_type: safeMime, data: b64 } }, { text: prompt }] }], generationConfig: { temperature: 0.1, maxOutputTokens: 400 } }),
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

async function callGroq(b64: string, mime: string, prompt = PROMPT_DEAL): Promise<string | null> {
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
          { type: 'text', text: prompt },
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

// ── Scraping annonce depuis URL ───────────────────────────────────────────────

interface ListingMeta {
  imageUrls: string[]   // photos de la carte dans l'annonce
  price: number
  shipping: number
  title: string
  condition: string
  platform: string
}

function normalizeCondition(raw: string): string {
  const s = raw.toLowerCase()
  if (s.includes('neuf avec') || s.includes('new with')) return 'Neuf'
  if (s.includes('neuf sans') || s.includes('new without')) return 'Neuf'
  if (s.includes('comme neuf') || s.includes('très bon') || s.includes('mint') || s.includes('nm') || s.includes('near mint')) return 'Comme neuf'
  if (s.includes('bon') || s.includes('good') || s.includes('excellent')) return 'Bon état'
  if (s.includes('satisfaisant') || s.includes('correct') || s.includes('played') || s.includes('lp')) return 'État correct'
  return ''
}

async function fetchListingPage(url: string): Promise<ListingMeta | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const platform = detectPlatform(url)

    // ── Images : plusieurs stratégies pour récupérer les photos HD ──
    const imageUrls: string[] = []
    const addImg = (u: string) => { if (u && u.startsWith('http') && !imageUrls.includes(u)) imageUrls.push(u) }

    // 1. JSON Vinted embarqué — photos HD (full_size_url ou url dans tableau "photos")
    const photoJsonMatches = [...html.matchAll(/"full_size_url"\s*:\s*"([^"]+)"/g)]
    for (const m of photoJsonMatches) addImg(m[1].replace(/\\/g, ''))

    const highResMatches = [...html.matchAll(/"url"\s*:\s*"(https:\/\/images\d*\.vinted\.[^"]+)"/g)]
    for (const m of highResMatches) addImg(m[1].replace(/\\/g, ''))

    // 2. og:image (thumbnail — fallback si pas de HD)
    const ogImgMatches = [...html.matchAll(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/gi),
                          ...html.matchAll(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/gi)]
    for (const m of ogImgMatches) addImg(m[1])

    // 3. eBay / LeBonCoin images
    const ebayMatches = [...html.matchAll(/https:\/\/i\.ebayimg\.com\/images\/g\/[^"'\s]+/g)]
    for (const m of ebayMatches) addImg(m[0])
    const lbcMatches = [...html.matchAll(/https:\/\/img\.leboncoin\.fr\/api\/[^"'\s]+/g)]
    for (const m of lbcMatches) addImg(m[0])

    // ── Prix : JSON-LD → patterns embarqués → meta ───────────────
    let price = 0
    const ldScripts = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    for (const s of ldScripts) {
      try {
        const d = JSON.parse(s[1])
        const p = d?.offers?.price ?? d?.offers?.[0]?.price ?? d?.price
        if (p) { price = parseFloat(String(p)); break }
      } catch {}
    }
    if (!price) {
      for (const pat of [
        /"price_amount"\s*:\s*"([\d.]+)"/,
        /"price"\s*:\s*"?([\d.]+)"?(?:\s*,\s*"currency")/,
        /content=["']([\d.,]+)["'][^>]*itemprop=["']price["']/i,
        /<meta[^>]*property=["']product:price:amount["'][^>]*content=["']([\d.,]+)/i,
        /"amount"\s*:\s*"([\d.]+)"/,
        /"prix"\s*:\s*"?([\d.]+)/,
      ]) {
        const pm = html.match(pat)
        if (pm) { price = parseFloat(pm[1].replace(',', '.')); break }
      }
    }

    // ── Frais de port ─────────────────────────────────────────────
    let shipping = 0
    for (const pat of [
      /"service_fee_amount"\s*:\s*"([\d.]+)"/,
      /"buyer_protection_fee"\s*:\s*[\s\S]{0,30}"amount"\s*:\s*"([\d.]+)"/,
      /frais[^<]{0,60}?(\d+[.,]\d{2})\s*€/i,
      /livraison[^<]{0,60}?(\d+[.,]\d{2})\s*€/i,
    ]) {
      const sm = html.match(pat)
      if (sm) { shipping = parseFloat(sm[1].replace(',', '.')); break }
    }

    // ── Titre ─────────────────────────────────────────────────────
    const titleM = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i)
      ?? html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i)
      ?? html.match(/<title[^>]*>([^<]+)<\/title>/i)
    const title = (titleM?.[1] ?? '').replace(/\s*[\|–-]\s*Vinted.*$/i, '').trim()

    // ── Condition ─────────────────────────────────────────────────
    let condition = ''
    for (const pat of [
      /Neuf avec étiquette|Neuf sans étiquette|Très bon état|Bon état|Satisfaisant/i,
      /"status"\s*:\s*["']([^"']+)["']/i,
      /"condition"\s*:\s*["']([^"']+)["']/i,
    ]) {
      const cm = html.match(pat)
      if (cm) { condition = normalizeCondition(cm[0]); break }
    }

    return { imageUrls, price, shipping, title, condition, platform }
  } catch { return null }
}

async function downloadImageAsBase64(url: string): Promise<{ b64: string; mime: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.vinted.fr/' },
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type')?.split(';')[0] ?? 'image/jpeg'
    const safeMime = ['image/jpeg','image/png','image/webp'].includes(mime) ? mime : 'image/jpeg'
    return { b64: Buffer.from(buf).toString('base64'), mime: safeMime }
  } catch { return null }
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

// findCard depuis PROMPT_IDENTIFY (num+total+setCode) — même logique que scan/route.ts
async function findCardFromIdentify(
  num: string, total: number | null, setCode: string | null,
  enName: string, frName: string,
): Promise<any | null> {
  if (!num && !enName && !frName) return null
  const nums = num ? numberVariants(num) : []

  // S0 : externalId direct (promo setCode+num)
  if (num && setCode) {
    const extIds = [...new Set([`${setCode}-${num}`, `${setCode}-${num.replace(/^0+(?=[0-9])/, '')}`, `${setCode}-${num.replace(/^0+(?=[0-9])/, '').padStart(3,'0')}`])]
    const found = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: DEAL_SEL })
    if (found) return found
  }

  // S1 : num + total
  if (num && total) {
    const rows = await prisma.card.findMany({
      where: { number: { in: nums }, set: { OR: [{ printedTotal: total }, { totalCards: total }] } },
      select: DEAL_SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 10,
    })
    if (rows.length === 1) return rows[0]
    if (rows.length > 1) {
      const norm = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['-]/g,' ').trim()
      const enN = norm(enName), frN = norm(frName)
      const scored = rows.map(c => {
        const cn = norm(c.name); let s = 50
        if (enN && cn === enN) s += 40; else if (frN && cn === frN) s += 40
        else if (frN && cn.includes(frN.split(' ')[0])) s += 15
        return { c, s }
      }).sort((a,b) => b.s - a.s)
      return scored[0].c
    }
  }

  // S2 : num + setCode via set.externalId
  if (num && setCode) {
    const row = await prisma.card.findFirst({ where: { number: { in: nums }, set: { externalId: setCode } }, select: DEAL_SEL })
    if (row) return row
  }

  // S3 : num + nom (premier mot)
  if (num && (enName || frName)) {
    const words = [frName, enName].filter(Boolean).map(n => n.split(' ')[0]).filter((v,i,a) => v.length >= 3 && a.indexOf(v) === i)
    for (const word of words) {
      const rows = await prisma.card.findMany({ where: { name: { contains: word, mode: 'insensitive' }, number: { in: nums } }, select: DEAL_SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 10 })
      if (rows.length > 0) return rows[0]
    }
  }

  // S3b : nom → filtrer par chiffres du numéro (SVP173 → "173")
  if (num && (enName || frName)) {
    const digits = num.replace(/^[A-Za-z]+/, '').replace(/^0+(?=\d)/, '')
    if (digits.length >= 1) {
      const words = [frName, enName].filter(Boolean).map(n => n.split(' ')[0]).filter((v,i,a) => v.length >= 3 && a.indexOf(v) === i)
      for (const word of words) {
        const byName = await prisma.card.findMany({ where: { name: { contains: word, mode: 'insensitive' } }, select: DEAL_SEL, orderBy: { set: { releaseDate: 'desc' } } as any, take: 30 })
        const matching = byName.filter(c => (c.number ?? '').replace(/^[A-Za-z]+/, '').replace(/^0+(?=\d)/, '') === digits)
        if (matching.length > 0) return matching[0]
      }
    }
  }

  // S4 : num seul
  if (num) {
    const rows = await prisma.card.findMany({ where: { number: { in: nums } }, select: DEAL_SEL, take: 20 })
    if (rows.length === 1) return rows[0]
    if (rows.length > 1 && (enName || frName)) {
      const norm = (n: string) => n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/['-]/g,' ').trim()
      const enN = norm(enName), frN = norm(frName)
      const exact = rows.find(c => { const cn = norm(c.name); return cn === enN || cn === frN })
      if (exact) return exact
    }
  }

  return null
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

function computeDeal(listingPrice: number, marketPrice: number, condition: string, shipping = 0) {
  if (!marketPrice || marketPrice <= 0) return null

  const condMult = conditionMultiplier(condition)
  const adjustedMarket = marketPrice * condMult
  // Prix total réel payé (carte + port)
  const totalPrice = listingPrice + (shipping ?? 0)

  const savingsEur = adjustedMarket - totalPrice
  const savingsPct = (savingsEur / adjustedMarket) * 100

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
    totalPrice: +totalPrice.toFixed(2),
    shipping: +(shipping ?? 0).toFixed(2),
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

    if (!listingUrl && (!file || file.size === 0))
      return NextResponse.json({ ok: false, error: 'Fournis un lien d\'annonce ou un screenshot.' }, { status: 400 })

    let listingMeta: ListingMeta | null = null
    let fromUrl = false
    let card: any | null = null
    let aiInfo = { cardName: '', englishName: '', cardNumber: '', setName: '', condition: '', listingPrice: 0, currency: 'EUR', listingTitle: '' }

    // ── Mode URL : fetch page + identification depuis les photos ──
    if (listingUrl) {
      listingMeta = await fetchListingPage(listingUrl)
    }

    if (listingUrl && listingMeta) {
      // Télécharger jusqu'à 4 photos en parallèle et tester chacune avec PROMPT_IDENTIFY
      const photos = listingMeta.imageUrls.slice(0, 4)
      if (photos.length > 0) {
        const photoAttempts = await Promise.allSettled(
          photos.map(async (imgUrl) => {
            const dl = await downloadImageAsBase64(imgUrl)
            if (!dl) return null
            // Race Gemini + Groq sur cette photo
            let raw: string | null = null
            try {
              raw = await Promise.any([
                callGemini(dl.b64, dl.mime, PROMPT_IDENTIFY),
                callGroq(dl.b64, dl.mime, PROMPT_IDENTIFY),
              ].map(p => p.then(t => {
                if (!t) throw 0
                const parsed = extractAllJsonObjects(t)[0]
                if (!parsed?.collector && !parsed?.enName && !parsed?.frName) throw 0
                return t
              })))
            } catch { raw = await callGemini(dl.b64, dl.mime, PROMPT_IDENTIFY) }
            if (!raw) return null
            const parsed = extractAllJsonObjects(raw)[0]
            if (!parsed) return null
            const { num, total, setCode } = parseCollector(parsed.collector ?? '', parsed.setCode ?? '')
            const enName = (parsed.enName ?? '').trim()
            const frName = (parsed.frName ?? '').trim()
            if (!num && !enName && !frName) return null
            const found = await findCardFromIdentify(num, total, setCode, enName, frName)
            return { card: found, parsed, num, total, enName, frName }
          })
        )

        // Prendre le premier résultat qui a trouvé une carte
        for (const attempt of photoAttempts) {
          if (attempt.status === 'fulfilled' && attempt.value?.card) {
            const { card: foundCard, parsed, num, total, enName, frName } = attempt.value
            card = foundCard
            aiInfo.cardName     = frName || enName || card?.name || ''
            aiInfo.englishName  = enName || frName || card?.name || ''
            aiInfo.cardNumber   = num && total ? `${num}/${total}` : num
            aiInfo.condition    = listingMeta.condition
            aiInfo.listingPrice = listingMeta.price
            aiInfo.listingTitle = listingMeta.title
            fromUrl = true
            break
          }
        }

        // Fallback : si aucune photo n'a trouvé de carte, tenter avec les noms extraits
        if (!card) {
          for (const attempt of photoAttempts) {
            if (attempt.status === 'fulfilled' && attempt.value) {
              const { num, total, enName, frName } = attempt.value
              if (enName || frName) {
                card = await findCardFromIdentify(num, total, null, enName, frName)
                if (card) {
                  aiInfo.cardName = frName || enName; aiInfo.englishName = enName || frName
                  aiInfo.cardNumber = num && total ? `${num}/${total}` : num
                  aiInfo.condition = listingMeta.condition; aiInfo.listingPrice = listingMeta.price
                  aiInfo.listingTitle = listingMeta.title; fromUrl = true
                  break
                }
              }
            }
          }
        }
      }

      // Fallback titre : extraire infos du titre de l'annonce
      if (!card && listingMeta.title) {
        const title = listingMeta.title
        // Chercher numéro/total dans le titre (ex: "Dracaufeu ex 006/165 151")
        const numM = title.match(/\b(\d{1,3})\/(\d{2,3})\b/)
        const numOnly = title.match(/\b([A-Z]{2,5}\d{2,4})\b/)
        const rawNum = numM ? numM[1] : numOnly ? numOnly[0] : ''
        const rawTotal = numM ? parseInt(numM[2]) : null
        // Extraire le nom (tout avant le numéro ou entre guillemets)
        const nameM = title.match(/^([^\d]+?)(?:\s+\d|\s+SVP|\s+SWSH|$)/i)
        const titleName = (nameM?.[1] ?? '').replace(/[™®]/g,'').trim()
        if (rawNum || titleName) {
          const { num, total, setCode } = parseCollector(numM ? `${rawNum}/${numM[2]}` : rawNum, '')
          card = await findCardFromIdentify(num, rawTotal ?? total, setCode, titleName, titleName)
          if (card) {
            aiInfo.cardName = card.name; aiInfo.englishName = card.name
            aiInfo.cardNumber = rawNum && rawTotal ? `${rawNum}/${rawTotal}` : rawNum
            aiInfo.condition = listingMeta.condition; aiInfo.listingPrice = listingMeta.price
            aiInfo.listingTitle = title; fromUrl = true
          }
        }
      }

      // Remplir les infos meta même si pas de carte
      if (!aiInfo.listingPrice) aiInfo.listingPrice = listingMeta.price
      if (!aiInfo.listingTitle) aiInfo.listingTitle = listingMeta.title
      if (!aiInfo.condition)   aiInfo.condition = listingMeta.condition
    }

    // ── Mode screenshot (si pas encore identifié via URL) ────────
    if (!fromUrl && file && file.size > 0) {
      if (file.size > 10 * 1024 * 1024)
        return NextResponse.json({ ok: false, error: 'Image trop grande (max 10MB)' }, { status: 400 })
      const mime = ['image/jpeg','image/png','image/webp','image/gif'].includes(file.type) ? file.type : 'image/jpeg'
      const b64  = Buffer.from(await file.arrayBuffer()).toString('base64')

      const rawText = await callGemini(b64, mime, PROMPT_DEAL) ?? await callGroq(b64, mime, PROMPT_DEAL)
      if (!rawText) return NextResponse.json({ ok: false, error: 'Impossible d\'analyser l\'image. Réessaie avec une photo plus nette.' }, { status: 422 })

      const ai = extractJson(rawText)
      if (!ai) return NextResponse.json({ ok: false, error: 'Impossible d\'extraire les infos. Assure-toi que la carte et le prix sont visibles.' }, { status: 422 })

      if (listingMeta) {
        if (!ai.listingPrice && listingMeta.price) ai.listingPrice = listingMeta.price
        if (!ai.listingTitle && listingMeta.title) ai.listingTitle = listingMeta.title
        if (!ai.condition && listingMeta.condition) ai.condition = listingMeta.condition
      }
      if (listingUrl) {
        const slug = parseVintedSlug(listingUrl)
        if (slug?.cardNumber && !ai.cardNumber) ai.cardNumber = slug.cardNumber
        if (slug?.listingTitle && !ai.listingTitle) ai.listingTitle = slug.listingTitle
      }
      card = await findCard(ai)
      aiInfo = ai
    }

    if (!fromUrl && !card && !aiInfo.listingPrice)
      return NextResponse.json({ ok: false, error: 'Fournis un lien d\'annonce ou un screenshot.' }, { status: 422 })

    // ── Prix marché ───────────────────────────────────────────────
    let marketPrice = card ? Number(card.prices?.[0]?.market ?? 0) : 0
    if (!marketPrice && card) {
      const lastPH = await prisma.priceHistory.findFirst({ where: { cardId: card.id, source: 'cardmarket' }, orderBy: { recordedAt: 'desc' }, select: { price: true } })
      if (lastPH) marketPrice = Number(lastPH.price)
    }
    if (!marketPrice && card) {
      const anyPrice = await prisma.cardPrice.findFirst({ where: { cardId: card.id }, orderBy: { fetchedAt: 'desc' }, select: { market: true, mid: true } })
      if (anyPrice) marketPrice = Number(anyPrice.market ?? anyPrice.mid ?? 0)
    }

    const shipping = listingMeta?.shipping ?? 0
    const deal = aiInfo.listingPrice > 0 && marketPrice > 0
      ? computeDeal(aiInfo.listingPrice, marketPrice, aiInfo.condition, shipping)
      : null

    await incrementScanUsage(user.id)

    return NextResponse.json({
      ok: true,
      fromUrl,
      ai: aiInfo,
      card: card ? {
        id: card.id, name: card.name, number: card.number, rarity: card.rarity,
        imageUrl: card.imageLgUrl ?? card.imageSmUrl ?? null,
        set: { name: card.set?.name, externalId: card.set?.externalId, logoUrl: card.set?.logoUrl ?? null },
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
      shipping,
      noMarketPrice: marketPrice === 0,
      listingUrl,
      listingPlatform: listingUrl ? detectPlatform(listingUrl) : null,
      listingImageUrl: listingMeta?.imageUrls?.[0] ?? null,
    })
  } catch (err: any) {
    console.error('[deal] fatal:', err?.message)
    return NextResponse.json({ ok: false, error: err?.message ?? 'Erreur interne' }, { status: 500 })
  }
}
