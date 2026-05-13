'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Search, SlidersHorizontal, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { clsx } from 'clsx'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { api } from '@/lib/api'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'
import { formatCurrency } from '@/lib/formatters'

type SortOption = 'price_desc' | 'price_asc' | 'name_asc' | 'change_desc' | 'score_desc'

const SORT_OPTIONS: { value: SortOption; labelFr: string; labelEn: string }[] = [
  { value: 'price_desc', labelFr: 'Prix : Élevé → Bas', labelEn: 'Price: High → Low' },
  { value: 'price_asc',  labelFr: 'Prix : Bas → Élevé', labelEn: 'Price: Low → High' },
  { value: 'change_desc',labelFr: 'Variation 24h ↑',     labelEn: '24h Change ↑' },
  { value: 'score_desc', labelFr: 'Score IA ↑',          labelEn: 'AI Score ↑' },
  { value: 'name_asc',   labelFr: 'Nom A → Z',           labelEn: 'Name A → Z' },
]

export default function CardsPage() {
  const t = useT()
  const { locale } = useLanguage()
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortOption>('price_desc')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['cards', search, sort, page],
    queryFn: () => api.cards.search(search, { page: String(page), limit: '24', sort } as any),
    staleTime: 30_000,
  })

  const cards = (data as any)?.items ?? []
  const total = (data as any)?.total ?? 0
  const pages = (data as any)?.pages ?? 1

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sort)

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">🃏 {t.cards.title}</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} {t.cards.inDatabase}</p>
        </div>

        {/* Search + Sort */}
        <div className="flex gap-3 mb-6 flex-wrap">
          <div className="relative flex-1 min-w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t.cards.searchPlaceholder}
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400 text-gray-900 shadow-sm"
            />
          </div>

          {/* Sort dropdown */}
          <div className="relative">
            <SlidersHorizontal className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value as SortOption); setPage(1) }}
              className="appearance-none pl-9 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:border-blue-400 transition-colors cursor-pointer min-w-48 shadow-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {locale === 'fr' ? o.labelFr : o.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Grid */}
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
                    className="group relative flex flex-col rounded-2xl overflow-hidden border border-gray-200 hover:border-amber-300 transition-all duration-300 hover:scale-105 hover:shadow-md bg-white shadow-sm"
                  >
                    {/* Card image */}
                    <div className="relative aspect-[2/3] w-full overflow-hidden bg-gray-100">
                      {card.imageSmUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageSmUrl}
                          alt={cardName}
                          className="absolute inset-0 w-full h-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                          {cardName}
                        </div>
                      )}

                      {/* Hover overlay with name */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 p-2 w-full">
                          <p className="text-white text-xs font-semibold truncate">{cardName}</p>
                          <p className="text-muted-foreground/80 text-[10px]">{card.rarity?.replace(/_/g, ' ')}</p>
                        </div>
                      </div>
                    </div>

                    {/* Price bar — always visible */}
                    <div className="px-2 py-1.5 flex items-center justify-between bg-white border-t border-gray-100">
                      <span className="font-mono font-bold text-xs text-blue-600">
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

        {/* Empty state */}
        {!isLoading && cards.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-muted-foreground">{locale === 'fr' ? 'Aucune carte trouvée' : 'No cards found'}</p>
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 disabled:opacity-40 hover:border-blue-300 transition-colors shadow-sm"
            >
              {t.cards.prev}
            </button>
            <span className="text-sm text-muted-foreground">
              {t.cards.page} {page} {t.cards.of} {pages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 disabled:opacity-40 hover:border-blue-300 transition-colors shadow-sm"
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
