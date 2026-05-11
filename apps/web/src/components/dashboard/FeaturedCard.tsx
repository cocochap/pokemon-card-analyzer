'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ArrowUpRight, Star, TrendingUp, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { RarityBadge } from '@/components/ui/RarityBadge'
import { useLanguage, useT } from '@/lib/i18n/LanguageContext'
import { getCardName, getSetName } from '@/lib/i18n/cardLocale'

export function FeaturedCard() {
  const { locale } = useLanguage()
  const t = useT()
  const { data: card, isLoading } = useQuery({
    queryKey: ['featured-card'],
    queryFn: api.market.getFeaturedCard,
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="glass-card p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="skeleton h-5 w-28 rounded" />
        </div>
        <div className="skeleton aspect-[5/7] w-44 mx-auto rounded-xl" />
        <div className="mt-4 space-y-2">
          <div className="skeleton h-5 w-3/4 rounded" />
          <div className="skeleton h-4 w-1/2 rounded" />
        </div>
      </div>
    )
  }

  if (!card) {
    return (
      <div className="glass-card p-5 flex flex-col items-center justify-center gap-2">
        <Star className="w-8 h-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{locale === 'fr' ? 'Aucune carte disponible' : 'No featured card available'}</p>
      </div>
    )
  }

  const score = card.aiAnalysis?.investmentScore ?? card.marketData?.investmentScore ?? 0
  const change30d = Number(card.marketData?.priceChange30d ?? 0)
  const price = Number(card.prices?.[0]?.market ?? 0)

  return (
    <div className="glass-card overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-pokemon-yellow/10 rounded-lg flex items-center justify-center">
            <Star className="w-4 h-4 text-pokemon-yellow fill-pokemon-yellow" />
          </div>
          <span className="font-semibold text-sm">{t.dashboard.sections.cardOfWeek}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-market-bull/10 border border-market-bull/30 rounded-full">
          <TrendingUp className="w-3 h-3 text-market-bull" />
          <span className="text-xs font-semibold text-market-bull">{t.card.score} {score}/100</span>
        </div>
      </div>

      {/* Card image */}
      <div className="flex-1 flex flex-col items-center px-5 py-4">
        <Link href={`/cards/${card.id}`} className="group relative">
          <motion.div
            whileHover={{ scale: 1.04, rotateY: 5 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="relative"
          >
            {/* Glow */}
            <div className="absolute -inset-3 rounded-2xl blur-2xl opacity-25 bg-pokemon-yellow/40" />

            {card.imageSmUrl ? (
              <Image
                src={card.imageSmUrl}
                alt={getCardName(card, locale)}
                width={180}
                height={252}
                className="relative rounded-xl shadow-2xl border border-white/10 group-hover:border-pokemon-yellow/30 transition-colors"
              />
            ) : (
              <div className="w-44 aspect-[5/7] bg-white/5 rounded-xl flex items-center justify-center text-xs text-muted-foreground">
                {getCardName(card, locale)}
              </div>
            )}
          </motion.div>
        </Link>

        {/* Info */}
        <div className="mt-4 w-full text-center space-y-2">
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <RarityBadge rarity={card.rarity} />
          </div>
          <Link
            href={`/cards/${card.id}`}
            className="block font-bold text-lg hover:text-pokemon-yellow transition-colors leading-tight"
          >
            {getCardName(card, locale)}
          </Link>
          <p className="text-xs text-muted-foreground">{card.set ? getSetName(card.set, locale) : ""}</p>

          {/* Price & change */}
          <div className="flex items-center justify-center gap-3 mt-2">
            <span className="font-mono font-bold text-xl">{formatCurrency(price)}</span>
            {change30d !== 0 && (
              <span
                className={clsx(
                  'flex items-center gap-0.5 text-sm font-semibold',
                  change30d >= 0 ? 'text-market-bull' : 'text-market-bear',
                )}
              >
                <ArrowUpRight className="w-4 h-4" />
                {change30d >= 0 ? '+' : ''}{(change30d * 100).toFixed(1)}% 30d
              </span>
            )}
          </div>
        </div>
      </div>

      {/* CTA */}
      <Link
        href={`/cards/${card.id}`}
        className="flex items-center justify-center gap-2 py-3 border-t border-white/10 text-sm font-medium text-pokemon-yellow hover:bg-pokemon-yellow/5 transition-colors"
      >
        {t.common.viewAnalysis}
        <ArrowUpRight className="w-4 h-4" />
      </Link>
    </div>
  )
}
