'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Brain, ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { RarityBadge } from '@/components/ui/RarityBadge'
import { useLanguage, useT } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <span className="text-xs font-mono text-muted-foreground w-6">{value}</span>
    </div>
  )
}

export function AiInsightsPanel() {
  const { data, isLoading } = useQuery({
    queryKey: ['ai-opportunities'],
    queryFn: () => api.market.getOpportunities(6),
    staleTime: 120_000,
    refetchInterval: 300_000,
  })

  const t = useT()
  const { locale } = useLanguage()
  const cards = Array.isArray(data) ? data : []

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pokemon-yellow/10 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-pokemon-yellow" />
          </div>
          <div>
            <h3 className="font-semibold">{locale === 'fr' ? 'Opportunités d\'achat IA' : 'AI Buy Opportunities'}</h3>
            <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Score ≥ 70 · Risque ≤ 40' : 'Score ≥ 70 · Risk ≤ 40'}</p>
          </div>
        </div>
        <Link href="/cards?sort=score" className="text-xs text-pokemon-yellow hover:text-pokemon-yellow/80 transition-colors">
          {t.common.viewAll} →
        </Link>
      </div>

      {/* List */}
      <div className="divide-y divide-white/5">
        {isLoading
          ? Array(5).fill(null).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="skeleton w-10 h-14 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-4 w-28 rounded" />
                  <div className="skeleton h-3 w-40 rounded" />
                </div>
                <div className="skeleton h-8 w-16 rounded" />
              </div>
            ))
          : cards.length === 0
          ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              {t.common.noOpportunities}
            </div>
          )
          : cards.map((card: any, i: number) => {
              const price = Number(card.prices?.[0]?.market ?? 0)
              const change30d = Number(card.marketData?.priceChange30d ?? 0)
              const score = card.aiAnalysis?.investmentScore ?? 0
              const roi = Number(card.aiAnalysis?.predictedRoi30d ?? 0)
              const trend = card.aiAnalysis?.trendDirection ?? 'STABLE'

              return (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                >
                  <Link
                    href={`/cards/${card.id}`}
                    className="flex items-center gap-3 p-4 hover:bg-white/3 transition-colors group"
                  >
                    {/* Rank */}
                    <span className="text-sm font-bold text-muted-foreground/40 w-4 shrink-0">{i + 1}</span>

                    {/* Card thumbnail */}
                    <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0 border border-white/10">
                      {card.imageSmUrl ? (
                        <Image src={card.imageSmUrl} alt={card.name} width={40} height={56} className="w-full h-full object-cover" />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate group-hover:text-pokemon-yellow transition-colors">
                        {getCardName(card, locale)}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <RarityBadge rarity={card.rarity} size="xs" />
                        <span className="text-xs text-muted-foreground truncate">{card.set?.name}</span>
                      </div>
                      <div className="mt-1.5 space-y-0.5">
                        <ScoreBar value={score} color="#FFCB05" />
                      </div>
                    </div>

                    {/* Right */}
                    <div className="text-right shrink-0 space-y-1">
                      <div className="font-mono font-bold text-sm">{formatCurrency(price)}</div>
                      <div className={clsx(
                        'flex items-center justify-end gap-0.5 text-xs font-semibold',
                        roi >= 0 ? 'text-market-bull' : 'text-market-bear',
                      )}>
                        {roi >= 0 ? <TrendingUp className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {roi >= 0 ? '+' : ''}{(roi * 100).toFixed(1)}% ROI
                      </div>
                      <div className={clsx(
                        'text-xs px-1.5 py-0.5 rounded-full font-medium',
                        trend === 'BULLISH' ? 'bg-market-bull/10 text-market-bull'
                        : trend === 'BEARISH' ? 'bg-market-bear/10 text-market-bear'
                        : trend === 'VOLATILE' ? 'bg-pokemon-yellow/10 text-pokemon-yellow'
                        : 'bg-white/5 text-muted-foreground',
                      )}>
                        {t.trend[trend as keyof typeof t.trend] ?? trend}
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
