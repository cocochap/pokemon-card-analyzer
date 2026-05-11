'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { TrendingUp, ArrowUpRight, Zap, Shield } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { RarityBadge } from '@/components/ui/RarityBadge'
import { useLanguage, useT } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'

export function OpportunitySection() {
  const { data, isLoading } = useQuery({
    queryKey: ['market-opportunities', 6],
    queryFn: () => api.market.getOpportunities(6),
    staleTime: 300_000,
  })

  const t = useT()
  const { locale } = useLanguage()
  const cards = Array.isArray(data) ? data : []

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-market-bull/10 rounded-xl flex items-center justify-center">
            <Zap className="w-5 h-5 text-market-bull" />
          </div>
          <div>
            <h3 className="font-semibold">{locale === 'fr' ? 'Opportunités d\'achat' : 'Buy Opportunities'}</h3>
            <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Score élevé · Risque faible · Momentum positif' : 'High score · Low risk · Positive momentum'}</p>
          </div>
        </div>
        <Link href="/cards" className="text-xs text-pokemon-yellow hover:text-pokemon-yellow/80 transition-colors">
          {t.common.browsAllCards}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-white/5">
        {isLoading
          ? Array(6).fill(null).map((_, i) => (
              <div key={i} className="bg-background/80 p-5 flex gap-4">
                <div className="skeleton w-12 h-16 rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-24 rounded" />
                  <div className="skeleton h-3 w-16 rounded" />
                  <div className="skeleton h-5 w-20 rounded" />
                </div>
              </div>
            ))
          : cards.length === 0
          ? (
            <div className="bg-background/80 col-span-3 py-10 text-center text-sm text-muted-foreground">
              {t.common.noOpportunities}
            </div>
          )
          : cards.map((card: any, i: number) => {
              const price = Number(card.prices?.[0]?.market ?? 0)
              const roi = Number(card.aiAnalysis?.predictedRoi30d ?? 0)
              const score = card.aiAnalysis?.investmentScore ?? 0
              const risk = card.aiAnalysis?.riskLevel ?? 50
              const change7d = Number(card.marketData?.priceChange7d ?? 0)

              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-background/80"
                >
                  <Link
                    href={`/cards/${card.id}`}
                    className="flex gap-4 p-5 hover:bg-white/3 transition-colors group h-full"
                  >
                    {/* Card image */}
                    <div className="w-12 h-16 rounded-lg overflow-hidden shrink-0 bg-white/5 border border-white/10">
                      {card.imageSmUrl ? (
                        <Image src={card.imageSmUrl} alt={getCardName(card, locale)} width={48} height={64} className="w-full h-full object-cover" />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate group-hover:text-pokemon-yellow transition-colors">
                        {getCardName(card, locale)}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <RarityBadge rarity={card.rarity} size="xs" />
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-mono font-bold">{formatCurrency(price)}</span>
                        <span className={clsx(
                          'flex items-center gap-0.5 text-xs font-semibold',
                          change7d >= 0 ? 'text-market-bull' : 'text-market-bear',
                        )}>
                          <ArrowUpRight className="w-3 h-3" />
                          {change7d >= 0 ? '+' : ''}{(change7d * 100).toFixed(1)}% 7d
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-1">
                        <div className="text-center">
                          <div className="text-xs font-bold text-pokemon-yellow">{score}</div>
                          <div className="text-xs text-muted-foreground/60">{t.card.score}</div>
                        </div>
                        <div className="text-center">
                          <div className={clsx('text-xs font-bold', roi >= 0 ? 'text-market-bull' : 'text-market-bear')}>
                            {roi >= 0 ? '+' : ''}{(roi * 100).toFixed(0)}%
                          </div>
                          <div className="text-xs text-muted-foreground/60">{t.card.roi}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-xs font-bold text-market-bear">{risk}</div>
                          <div className="text-xs text-muted-foreground/60">{t.card.risk}</div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              )
            })}
      </div>
    </div>
  )
}
