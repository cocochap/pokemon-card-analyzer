/**
 * Cron news-signals — tourne à 5h30 UTC chaque jour.
 * Scrape PokeBeach + PokéGuardian + Reddit RSS, analyse avec Gemini,
 * extrait signaux BULLISH/BEARISH par carte, stocke en NewsSignal.
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { checkCronAuth } from '@/lib/cron-auth'

export const runtime = 'nodejs'
export const maxDuration = 120

const RSS_SOURCES = [
  { url: 'https://www.pokebeach.com/feed/', name: 'pokebeach' },
  { url: 'https://www.pokeguardian.com/feed', name: 'pokeguardian' },
  { url: 'https://www.reddit.com/r/pkmntcg/top/.rss?t=day', name: 'reddit' },
]

const MAX_ARTICLES_PER_RUN = 12

interface RssItem {
  title: string
  url: string
  description: string
  publishedAt: Date
  source: string
}

interface CardSignal {
  name: string
  sentiment: string
  eventType: string
  impact: number
  reason: string
}

interface GeminiSignal {
  cards: CardSignal[]
  generalSentiment: string
  eventType: string
  impact: number
}

// ── RSS fetching ──────────────────────────────────────────────────────────────

async function fetchRss(source: { url: string; name: string }): Promise<RssItem[]> {
  try {
    const res = await fetch(source.url, {
      headers: { 'User-Agent': 'PokeMarket/1.0 market-intelligence-bot' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const xml = await res.text()
    return parseRssXml(xml, source.name)
  } catch { return [] }
}

function extractTag(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'))
  return m?.[1]?.trim() ?? ''
}

function extractLink(xml: string): string {
  // <link>...</link>
  const m1 = xml.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)
  if (m1?.[1]?.trim()) return m1[1].trim()
  // <link href="..." rel="alternate"/>
  const m2 = xml.match(/<link[^>]+href=["']([^"']+)["'][^>]*(?:rel=["']alternate["'])?/i)
  return m2?.[1] ?? ''
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseRssXml(xml: string, source: string): RssItem[] {
  const items: RssItem[] = []
  const itemRegex = /<(?:item|entry)>([\s\S]*?)<\/(?:item|entry)>/g
  let match
  while ((match = itemRegex.exec(xml)) !== null) {
    const content = match[1]
    const title = decodeEntities(extractTag(content, 'title'))
    const url = extractLink(content) || extractTag(content, 'guid')
    if (!title || !url || !url.startsWith('http')) continue
    const pubDate = extractTag(content, 'pubDate') || extractTag(content, 'published') || extractTag(content, 'updated')
    const parsedDate = pubDate ? new Date(pubDate) : new Date()
    if (isNaN(parsedDate.getTime())) continue
    const rawDesc = extractTag(content, 'description') || extractTag(content, 'summary') || extractTag(content, 'content')
    const description = decodeEntities(stripHtml(rawDesc)).slice(0, 600)
    items.push({ title, url: url.trim(), description, publishedAt: parsedDate, source })
  }
  return items
}

// ── Gemini text analysis ──────────────────────────────────────────────────────

async function callGeminiText(prompt: string): Promise<string | null> {
  const MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite']
  for (const model of MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 800 },
          }),
          signal: AbortSignal.timeout(15000),
        }
      )
      if (res.status === 429) continue
      if (!res.ok) continue
      const json = await res.json()
      const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text) return text
    } catch { continue }
  }
  return null
}

function parseGeminiJson(text: string): GeminiSignal | null {
  try {
    const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(clean)
    if (!parsed.generalSentiment) return null
    return parsed
  } catch { return null }
}

function buildPrompt(title: string, description: string, source: string): string {
  return `You are a Pokemon TCG market intelligence analyst. Analyze this news article and extract investment signals for Pokemon cards.

Source: ${source}
Title: ${title}
Summary: ${description}

Return ONLY valid JSON (no markdown):
{
  "cards": [
    {
      "name": "Charizard ex",
      "sentiment": "BULLISH",
      "eventType": "TOURNAMENT_WIN",
      "impact": 25,
      "reason": "Dominated Regional Championship — high demand expected"
    }
  ],
  "generalSentiment": "BULLISH",
  "eventType": "META_SHIFT",
  "impact": 15
}

Rules:
- sentiment: "BULLISH" | "BEARISH" | "NEUTRAL"
- eventType: "REPRINT" | "TOURNAMENT_WIN" | "SET_ANNOUNCEMENT" | "META_SHIFT" | "MARKET" | "PROMO" | "OTHER"
- impact: integer -50 (very bearish) to +50 (very bullish). 0 = neutral.
- cards: specific Pokemon cards mentioned in English. Include variant ("Charizard ex", "Pikachu VMAX", "Umbreon VMAX alt art").
- REPRINT = BEARISH (more supply = price drop). TOURNAMENT_WIN = BULLISH (demand spike).
- SET_ANNOUNCEMENT = slightly BULLISH for market, check if it reprints existing chase cards (then BEARISH for those).
- If article is not TCG-related: {"cards":[],"generalSentiment":"NEUTRAL","eventType":"OTHER","impact":0}`
}

// ── Card DB matching ──────────────────────────────────────────────────────────

async function matchCardId(cardName: string): Promise<string | null> {
  if (!cardName || cardName.length < 3) return null
  // Normalize: try full name first, then base name without variant
  const searches = [
    cardName,
    cardName.replace(/\s*(ex|EX|GX|V|VMAX|VSTAR|VMax|VStar|alt art|full art|rainbow rare|secret rare|SR|HR|SIR|IR)\s*/gi, '').trim(),
  ].filter(s => s.length >= 3)
  for (const search of searches) {
    try {
      const cards = await prisma.card.findMany({
        where: { name: { contains: search, mode: 'insensitive' } },
        select: { id: true, name: true },
        orderBy: { prices: { _count: 'desc' } },
        take: 1,
      })
      if (cards[0]) return cards[0].id
    } catch { continue }
  }
  return null
}

// ── Main handler ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const authErr = checkCronAuth(req)
  if (authErr) return authErr

  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json({ ok: false, error: 'GEMINI_API_KEY not configured' }, { status: 500 })
  }

  // 1. Fetch all RSS sources in parallel
  const allItems = (await Promise.all(RSS_SOURCES.map(fetchRss))).flat()

  // 2. Keep only last 48h
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000)
  const recentItems = allItems.filter(item => item.publishedAt >= cutoff)

  if (recentItems.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'No recent articles found' })
  }

  // 3. Deduplicate against DB
  const existingUrls = new Set(
    (await prisma.newsSignal.findMany({
      where: { url: { in: recentItems.map(i => i.url) } },
      select: { url: true },
    })).map(s => s.url)
  )

  const newItems = recentItems
    .filter(item => !existingUrls.has(item.url))
    .slice(0, MAX_ARTICLES_PER_RUN)

  if (newItems.length === 0) {
    return NextResponse.json({ ok: true, created: 0, message: 'All recent articles already processed' })
  }

  // 4. Analyze each article with Gemini + create signals
  const toCreate: Parameters<typeof prisma.newsSignal.createMany>[0]['data'] = []

  for (const item of newItems) {
    await new Promise(r => setTimeout(r, 600)) // rate limit buffer
    const raw = await callGeminiText(buildPrompt(item.title, item.description, item.source))
    if (!raw) continue
    const signal = parseGeminiJson(raw)
    if (!signal) continue
    // Skip fully neutral/unrelated articles
    if (signal.generalSentiment === 'NEUTRAL' && signal.eventType === 'OTHER' && signal.cards.length === 0) continue

    const clampImpact = (n: number) => Math.max(-50, Math.min(50, n || 0))

    // General article signal (no card)
    toCreate.push({
      cardId: null,
      source: item.source,
      title: item.title.slice(0, 255),
      url: item.url,
      summary: item.description.slice(0, 300),
      sentiment: signal.generalSentiment || 'NEUTRAL',
      eventType: signal.eventType || 'OTHER',
      impact: clampImpact(signal.impact),
      publishedAt: item.publishedAt,
    })

    // Card-specific signals (match each card to DB)
    for (const cs of (signal.cards ?? []).slice(0, 5)) {
      if (!cs.name) continue
      const cardId = await matchCardId(cs.name)
      toCreate.push({
        cardId,
        source: item.source,
        title: item.title.slice(0, 255),
        url: item.url,
        summary: (cs.reason ?? cs.name).slice(0, 300),
        sentiment: cs.sentiment || signal.generalSentiment || 'NEUTRAL',
        eventType: cs.eventType || signal.eventType || 'OTHER',
        impact: clampImpact(cs.impact ?? signal.impact),
        publishedAt: item.publishedAt,
      })
    }
  }

  if (toCreate.length === 0) {
    return NextResponse.json({ ok: true, created: 0, articlesProcessed: newItems.length })
  }

  await prisma.newsSignal.createMany({ data: toCreate, skipDuplicates: true })

  return NextResponse.json({
    ok: true,
    articlesProcessed: newItems.length,
    signalsCreated: toCreate.length,
  })
}
