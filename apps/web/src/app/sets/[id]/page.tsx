'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, ArrowUpRight, ArrowDownRight, Search, SlidersHorizontal, Layers } from 'lucide-react'
import { clsx } from 'clsx'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'
import { formatCurrency } from '@/lib/formatters'

type SortOption = 'price_desc' | 'price_asc' | 'name_asc' | 'change_desc' | 'score_desc'

const SORT_OPTIONS: { value: SortOption; labelFr: string; labelEn: string }[] = [
  { value: 'price_desc',  labelFr: 'Prix : Élevé → Bas',  labelEn: 'Price: High → Low' },
  { value: 'price_asc',   labelFr: 'Prix : Bas → Élevé',  labelEn: 'Price: Low → High' },
  { value: 'change_desc', labelFr: 'Variation 24h ↑',      labelEn: '24h Change ↑' },
  { value: 'score_desc',  labelFr: 'Score IA ↑',           labelEn: 'AI Score ↑' },
  { value: 'name_asc',    labelFr: 'Nom A → Z',            labelEn: 'Name A → Z' },
]

export default function SetPage() {
  const params = useParams()
  const id = params.id as string
  const t = useT()
  const { locale } = useLanguage()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('price_desc')
  const [page, setPage] = useState(1)

  const { data: sets = [] } = useQuery<any[]>({
    queryKey: ['sets'],
    queryFn: async () => {
      const res = await fetch('/api/sets')
      return res.json()
    },
    staleTime: 300_000,
  })

  const set = sets.find((s: any) => s.id === id)

  const { data, isLoading } = useQuery({
    queryKey: ['set-cards', id, search, sort, page],
    queryFn: async () => {
      const sp = new URLSearchParams({ set: id, sort, page: String(page), limit: '48' })
      if (search) sp.set('q', search)
      const res = await fetch(`/api/cards?${sp}`)
      return res.json()
    },
    staleTime: 30_000,
    enabled: !!id,
  })

  const cards = data?.items ?? []
  const total = data?.total ?? 0
  const pages = data?.pages ?? 1

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Back link */}
        <Link href="/sets" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
          <ArrowLeft className="w-4 h-4" />
          {t.sets.title}
        </Link>

        {/* Set header */}
        <div className="glass-card p-6 mb-8 flex items-center gap-6">
          {set?.logoUrl ? (
            <div className="relative w-32 h-20 shrink-0">
              <Image src={set.logoUrl} alt={set.name} fill className="object-contain" unoptimized />
            </div>
          ) : (
            <div className="w-20 h-14 shrink-0 flex items-center justify-center bg-white/5 rounded-xl">
              <Layers className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{set?.name ?? '...'}</h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span>{total} {t.sets.cards}</span>
              {set?.releaseDate && (
                <span>
                  {new Date(set.releaseDate).toLocaleDateString(
                    locale === 'fr' ? 'fr-FR' : 'en-US',
                    { year: 'numeric', month: 'long', day: 'numeric' }
                  )}
                </span>
              )}
            </div>
          </div>
          {set?.symbolUrl && (
            <div className="ml-auto shrink-0 relative w-10 h-10">
              <Image src={set.symbolUrl} alt="" fill className="object-contain" unoptimized />
            </div>
          )}
        </div>

        {/* Search + Sort */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t.cards.searchPlaceholder}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm focus:outline-none focus:border-pokemon-yellow/50 transition-colors placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <select
              value={sort}
              onChange={e => { setSort(e.target.value as SortOption); setPage(1) }}
              className="appearance-none pl-9 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-foreground focus:outline-none focus:border-pokemon-yellow/50 transition-colors cursor-pointer min-w-48"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {locale === 'fr' ? o.labelFr : o.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
          {isLoading
            ? Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="skeleton aspect-[2/3] rounded-2xl" />
              ))
            : cards.map((card: any) => {
                const price = Number(card.prices?.[0]?.market ?? 0)
                const change24h = Number(card.marketData?.priceChange24h ?? 0) * 100
                const cardName = getCardName(card, locale)

                return (
                  <Link
                    key={card.id}
                    href={`/cards/${card.id}`}
                    className="group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 hover:border-pokemon-yellow/50 transition-all duration-300 hover:scale-105 hover:shadow-glow bg-white/3"
                  >
                    <div className="relative aspect-[2/3] w-full overflow-hidden">
                      {card.imageSmUrl ? (
                        <Image
                          src={card.imageSmUrl}
                          alt={cardName}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 16vw, 12.5vw"
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                          {cardName}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 p-2 w-full">
                          <p className="text-white text-xs font-semibold truncate">{cardName}</p>
                          <p className="text-muted-foreground/80 text-[10px]">{card.rarity?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </div>
                    <div className="px-2 py-1.5 flex items-center justify-between bg-background/60 backdrop-blur-sm">
                      <span className="font-mono font-bold text-xs text-pokemon-yellow">
                        {price > 0 ? formatCurrency(price) : '—'}
                      </span>
                      {change24h !== 0 && (
                        <span className={clsx(
                          'flex items-center gap-0.5 text-[10px] font-semibold',
                          change24h >= 0 ? 'text-market-bull' : 'text-market-bear',
                        )}>
                          {change24h >= 0 ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                          {Math.abs(change24h).toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })}
        </div>

        {!isLoading && cards.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-muted-foreground">{locale === 'fr' ? 'Aucune carte trouvée' : 'No cards found'}</p>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 hover:border-pokemon-yellow/30 transition-colors"
            >
              {t.cards.prev}
            </button>
            <span className="text-sm text-muted-foreground">
              {t.cards.page} {page} {t.cards.of} {pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-sm disabled:opacity-40 hover:border-pokemon-yellow/30 transition-colors"
            >
              {t.cards.next}
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
