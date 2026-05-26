'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import {
  Newspaper, TrendingUp, TrendingDown, Minus, ExternalLink,
  Calendar, ChevronLeft, ChevronRight, Zap, Trophy, Tag,
  Megaphone, BarChart3, Globe,
} from 'lucide-react'
import { clsx } from 'clsx'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

interface CardMention {
  cardId: string | null
  name: string
  image: string | null
  sentiment: string
  impact: number
  reason: string
}

interface NewsItem {
  id: string
  source: string
  title: string
  url: string
  summary: string
  sentiment: string
  eventType: string
  impact: number
  publishedAt: string
  cards: CardMention[]
}

const SENTIMENTS = [
  { value: 'ALL',     label: 'Tous',      icon: Globe },
  { value: 'BULLISH', label: 'Haussier',  icon: TrendingUp },
  { value: 'BEARISH', label: 'Baissier',  icon: TrendingDown },
  { value: 'NEUTRAL', label: 'Neutre',    icon: Minus },
]

const EVENT_TYPES = [
  { value: 'ALL',              label: 'Tous les types' },
  { value: 'TOURNAMENT_WIN',   label: 'Tournoi' },
  { value: 'META_SHIFT',       label: 'Méta' },
  { value: 'REPRINT',          label: 'Reprint' },
  { value: 'SET_ANNOUNCEMENT', label: 'Set annoncé' },
  { value: 'PROMO',            label: 'Promo' },
  { value: 'MARKET',           label: 'Marché' },
  { value: 'OTHER',            label: 'Autre' },
]

function sentimentColor(s: string) {
  if (s === 'BULLISH') return { text: '#22c55e', bg: 'rgba(34,197,94,0.12)', border: 'rgba(34,197,94,0.25)' }
  if (s === 'BEARISH') return { text: '#ef4444', bg: 'rgba(239,68,68,0.12)', border: 'rgba(239,68,68,0.25)' }
  return { text: 'rgba(255,255,255,0.45)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' }
}

function eventIcon(e: string) {
  if (e === 'TOURNAMENT_WIN') return Trophy
  if (e === 'META_SHIFT') return Zap
  if (e === 'REPRINT') return Tag
  if (e === 'SET_ANNOUNCEMENT') return Megaphone
  if (e === 'MARKET') return BarChart3
  return Globe
}

function eventLabel(e: string) {
  return EVENT_TYPES.find(t => t.value === e)?.label ?? e
}

function sourceLabel(s: string) {
  if (s === 'google_news_en') return 'Google News EN'
  if (s === 'google_news_tournament') return 'Google News Tournois'
  if (s === 'google_news_fr') return 'Google News FR'
  if (s === 'reddit') return 'Reddit'
  return s
}

async function fetchNews(page: number, sentiment: string, eventType: string) {
  const params = new URLSearchParams({ page: String(page), limit: '15' })
  if (sentiment !== 'ALL') params.set('sentiment', sentiment)
  if (eventType !== 'ALL') params.set('eventType', eventType)
  const res = await fetch(`/api/news?${params}`)
  if (!res.ok) throw new Error('Failed to fetch news')
  return res.json() as Promise<{ items: NewsItem[]; total: number; page: number; pages: number }>
}

function ImpactBadge({ impact }: { impact: number }) {
  const abs = Math.abs(impact)
  const color = impact > 5 ? '#22c55e' : impact < -5 ? '#ef4444' : 'rgba(255,255,255,0.4)'
  const sign = impact > 0 ? '+' : ''
  if (abs < 3) return null
  return (
    <span className="text-xs font-bold tabular-nums" style={{ color }}>
      {sign}{impact}
    </span>
  )
}

function NewsCard({ item }: { item: NewsItem }) {
  const sc = sentimentColor(item.sentiment)
  const EventIcon = eventIcon(item.eventType)
  const SentimentIcon = item.sentiment === 'BULLISH' ? TrendingUp : item.sentiment === 'BEARISH' ? TrendingDown : Minus

  return (
    <article
      className="rounded-2xl p-5 flex flex-col gap-4 transition-all duration-200 hover:brightness-105"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${sc.border}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Sentiment pill */}
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold"
          style={{ background: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
          <SentimentIcon className="w-3 h-3" />
          {item.sentiment === 'BULLISH' ? 'Haussier' : item.sentiment === 'BEARISH' ? 'Baissier' : 'Neutre'}
        </div>

        {/* Event type */}
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/40"
          style={{ background: 'rgba(255,255,255,0.05)' }}>
          <EventIcon className="w-3 h-3" />
          {eventLabel(item.eventType)}
        </div>

        {/* Impact */}
        <div className="ml-auto flex items-center gap-2">
          <ImpactBadge impact={item.impact} />
        </div>
      </div>

      {/* Title */}
      <a href={item.url} target="_blank" rel="noopener noreferrer"
        className="group flex items-start gap-2">
        <h3 className="font-semibold text-white/90 text-sm leading-snug group-hover:text-white transition-colors line-clamp-3">
          {item.title}
        </h3>
        <ExternalLink className="w-3.5 h-3.5 text-white/25 group-hover:text-white/60 flex-shrink-0 mt-0.5 transition-colors" />
      </a>

      {/* Summary */}
      {item.summary && (
        <p className="text-xs text-white/45 leading-relaxed line-clamp-3">
          {item.summary}
        </p>
      )}

      {/* Card mentions */}
      {item.cards.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {item.cards.slice(0, 4).map((c, i) => {
            const csc = sentimentColor(c.sentiment)
            const inner = (
              <span
                key={i}
                className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.75)' }}
              >
                {c.image && (
                  <Image src={c.image} alt={c.name} width={20} height={28} className="rounded object-contain" />
                )}
                <span className="truncate max-w-[120px]">{c.name}</span>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: csc.text }} />
              </span>
            )
            return c.cardId ? (
              <Link key={i} href={`/cards/${c.cardId}`}>{inner}</Link>
            ) : inner
          })}
          {item.cards.length > 4 && (
            <span className="flex items-center px-2 py-1 rounded-lg text-xs text-white/30"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              +{item.cards.length - 4} cartes
            </span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center gap-2 text-[10px] text-white/30 pt-1 border-t border-white/5">
        <Calendar className="w-3 h-3" />
        <span>
          {formatDistanceToNow(new Date(item.publishedAt), { addSuffix: true, locale: fr })}
        </span>
        <span className="ml-auto">{sourceLabel(item.source)}</span>
      </div>
    </article>
  )
}

export default function NewsPage() {
  const [sentiment, setSentiment] = useState('ALL')
  const [eventType, setEventType] = useState('ALL')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['news', page, sentiment, eventType],
    queryFn: () => fetchNews(page, sentiment, eventType),
    staleTime: 60_000,
  })

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  function handleFilter(newSentiment: string, newEvent: string) {
    setSentiment(newSentiment)
    setEventType(newEvent)
    setPage(1)
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl pb-mobile-nav md:pb-10">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.25)' }}>
              <Newspaper className="w-5 h-5 text-pokemon-yellow" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Actualités TCG</h1>
              <p className="text-sm text-white/45 mt-0.5">
                Signaux de marché extraits des dernières news Pokémon — mis à jour chaque matin.
              </p>
            </div>
          </div>
          {total > 0 && (
            <p className="text-xs text-white/30 ml-[52px]">{total} article{total > 1 ? 's' : ''} analysés</p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 mb-6">
          {/* Sentiment filter */}
          <div className="flex gap-2 flex-wrap">
            {SENTIMENTS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => handleFilter(value, eventType)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all',
                  sentiment === value
                    ? 'text-white'
                    : 'text-white/45 hover:text-white/70',
                )}
                style={sentiment === value
                  ? { background: 'rgba(255,203,5,0.15)', border: '1px solid rgba(255,203,5,0.35)', color: '#FFCB05' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Icon className="w-3 h-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Event type filter */}
          <div className="flex gap-2 flex-wrap">
            {EVENT_TYPES.map(({ value, label }) => (
              <button
                key={value}
                onClick={() => handleFilter(sentiment, value)}
                className={clsx(
                  'px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all',
                  eventType === value ? 'text-white/90' : 'text-white/35 hover:text-white/55',
                )}
                style={eventType === value
                  ? { background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.2)' }
                  : { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {isLoading && (
          <div className="grid gap-4 md:grid-cols-2">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl animate-pulse"
                style={{ background: 'rgba(255,255,255,0.04)' }} />
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="text-center py-24 text-white/30">
            <Newspaper className="w-10 h-10 mx-auto mb-4 opacity-40" />
            <p className="font-medium">Aucun article trouvé</p>
            <p className="text-sm mt-1">Le cron tourne chaque matin à 5h30 — revenez demain.</p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <>
            <div className="grid gap-4 md:grid-cols-2">
              {items.map(item => (
                <NewsCard key={item.id} item={item} />
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-8">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30 transition-colors hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  <ChevronLeft className="w-4 h-4" />
                  Précédent
                </button>
                <span className="text-sm text-white/40">
                  {page} / {pages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-30 transition-colors hover:bg-white/5"
                  style={{ border: '1px solid rgba(255,255,255,0.1)' }}
                >
                  Suivant
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}
