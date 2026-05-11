'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { RarityBadge } from '@/components/ui/RarityBadge'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'

export function SimilarCards({ cardId, setId }: { cardId: string; setId: string }) {
  const t = useT()
  const { locale } = useLanguage()

  const { data, isLoading } = useQuery({
    queryKey: ['similar-cards', cardId],
    queryFn: () => api.cards.getSimilar(cardId, setId),
    staleTime: 300_000,
  })

  const cards = Array.isArray(data) ? data : []

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-white/10">
        <h3 className="font-semibold">🃏 {t.card.similarCards}</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 p-4">
        {isLoading
          ? Array(8).fill(null).map((_, i) => (
              <div key={i} className="skeleton aspect-[2/3] rounded-xl" />
            ))
          : cards.length === 0
          ? (
            <div className="col-span-4 py-8 text-center text-sm text-muted-foreground">
              {t.common.noData}
            </div>
          )
          : cards.slice(0, 8).map((card: any, i: number) => {
              const price = Number(card.prices?.[0]?.market ?? 0)
              const change = Number(card.marketData?.priceChange24h ?? 0) * 100

              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/cards/${card.id}`}
                    className="group flex flex-col items-center gap-2"
                  >
                    <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden border border-white/10 group-hover:border-pokemon-yellow/40 transition-all duration-300 group-hover:scale-105 group-hover:shadow-glow">
                      {card.imageSmUrl ? (
                        <Image
                          src={card.imageSmUrl}
                          alt={getCardName(card, locale)}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 50vw, 12.5vw"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/5 flex items-center justify-center p-2 text-center">
                          <span className="text-xs text-muted-foreground">{getCardName(card, locale)}</span>
                        </div>
                      )}
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="absolute bottom-0 p-2 w-full">
                          <p className="text-white text-xs font-medium truncate">{getCardName(card, locale)}</p>
                          {price > 0 && (
                            <p className="text-pokemon-yellow text-xs font-mono">{formatCurrency(price)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Change badge */}
                    {change !== 0 && (
                      <div className={clsx(
                        'flex items-center gap-0.5 text-xs font-semibold',
                        change >= 0 ? 'text-market-bull' : 'text-market-bear',
                      )}>
                        {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {Math.abs(change).toFixed(1)}%
                      </div>
                    )}
                  </Link>
                </motion.div>
              )
            })}
      </div>
    </div>
  )
}
