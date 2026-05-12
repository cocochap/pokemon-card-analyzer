'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useLanguage, useT } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'

export function TrendingCards() {
  const { locale } = useLanguage()
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['trending-cards'],
    queryFn: () => api.cards.search('', { limit: '8' } as any),
    staleTime: 60_000,
  })

  const cards = (data as any)?.items ?? []

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">{t.dashboard.sections.latestCards}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {isLoading
          ? Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
            ))
          : cards.map((card: any) => (
              <Link key={card.id} href={`/cards/${card.id}`} className="group relative aspect-[2/3] rounded-lg overflow-hidden border border-gray-200 hover:border-amber-300 transition-all duration-300 hover:scale-105 shadow-sm">
                {card.imageSmUrl ? (
                  <Image
                    src={card.imageSmUrl}
                    alt={getCardName(card, locale)}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 50vw, 12.5vw"
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground p-1 text-center">
                    {getCardName(card, locale)}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="absolute bottom-0 p-2">
                    <p className="text-white text-xs font-medium truncate">{card.name}</p>
                  </div>
                </div>
              </Link>
            ))}
      </div>
    </div>
  )
}
