'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowDownRight, ArrowUpRight, Brain, CheckCircle2,
  Loader2, Minus, TrendingDown, TrendingUp, XCircle, Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useT } from '@/lib/i18n/LanguageContext'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function ScoreRing({ value, label, color, tooltip }: { value: number; label: string; color: string; tooltip?: string }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 70 70">
          <circle cx="35" cy="35" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <motion.circle
            cx="35" cy="35" r={radius}
            fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground text-center">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} side="bottom" />}
      </div>
    </div>
  )
}

export function CardAiAnalysis({ cardId }: { cardId: string }) {
  const t = useT()

  const { data, isLoading } = useQuery({
    queryKey: ['card-ai-analysis', cardId],
    queryFn: () => api.ai.getCardAnalysis(cardId),
    staleTime: 5 * 60_000,
  })

  const trendConfig = {
    BULLISH: { icon: TrendingUp, color: 'text-market-bull', bg: 'bg-market-bull/10 border-market-bull/30' },
    BEARISH: { icon: TrendingDown, color: 'text-market-bear', bg: 'bg-market-bear/10 border-market-bear/30' },
    STABLE: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-white/5 border-white/20' },
    VOLATILE: { icon: Zap, color: 'text-pokemon-yellow', bg: 'bg-pokemon-yellow/10 border-pokemon-yellow/30' },
  }

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-5 h-5 text-pokemon-yellow" />
          <h3 className="font-semibold">{t.ai.title}</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-pokemon-yellow animate-spin" />
            <span className="text-sm text-muted-foreground">{t.ai.analyzing}</span>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  const trend = data.trendDirection as keyof typeof trendConfig
  const cfg = trendConfig[trend] ?? trendConfig.STABLE
  const trendLabel = t.trend[trend] ?? trend
  const horizons = [
    { days: 7, label: t.predictions.days7 },
    { days: 30, label: t.predictions.days30 },
    { days: 90, label: t.predictions.days90 },
    { days: 180, label: t.predictions.days180 },
    { days: 365, label: t.predictions.days365 },
  ]

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pokemon-yellow/10 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-pokemon-yellow" />
          </div>
          <div>
            <h3 className="font-semibold">{t.ai.title}</h3>
            <p className="text-xs text-muted-foreground">
              {t.ai.confidence} : {(data.confidenceScore * 100).toFixed(0)}% · {t.ai.updatedRecently}
            </p>
          </div>
        </div>
        <div className={clsx('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border', cfg.bg, cfg.color)}>
          <cfg.icon className="w-4 h-4" />
          {trendLabel}
          <InfoTooltip text={t.tooltips.trend} />
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Score Rings */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ScoreRing value={data.investmentScore} label={t.card.investment} color="#FFCB05" tooltip={t.tooltips.investmentScore} />
          <ScoreRing value={data.rarityScore} label={t.card.rarity} color="#7B2D8B" tooltip={t.tooltips.rarityScore} />
          <ScoreRing value={data.liquidityScore} label={t.card.liquidity} color="#3D7DCA" tooltip={t.tooltips.liquidityScore} />
          <ScoreRing value={100 - data.riskLevel} label={t.card.safety} color="#22C55E" tooltip={t.tooltips.safetyScore} />
        </div>

        {/* Key Insight */}
        {data.keyInsight && (
          <div className="bg-pokemon-yellow/5 border border-pokemon-yellow/20 rounded-xl p-4">
            <p className="text-sm text-foreground/90 leading-relaxed">
              <span className="text-pokemon-yellow font-semibold">{t.ai.insightPrefix} : </span>
              {data.keyInsight}
            </p>
          </div>
        )}

        {/* Price Predictions */}
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            {t.card.predictions}
            <InfoTooltip text={t.tooltips.predictedRoi} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {horizons.map(({ days, label }) => {
              const pred = data.predictions?.find((p: { horizonDays: number }) => p.horizonDays === days)
              if (!pred) return null
              const roi = data.currentPrice > 0
                ? ((pred.predictedPrice - data.currentPrice) / data.currentPrice) * 100
                : 0
              return (
                <div key={days} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-2">{label}</div>
                  <div className="font-bold text-lg font-mono">{formatCurrency(pred.predictedPrice)}</div>
                  <div className={clsx('flex items-center gap-0.5 text-sm font-medium mt-1', roi >= 0 ? 'text-market-bull' : 'text-market-bear')}>
                    {roi >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {Math.abs(roi).toFixed(1)}%
                  </div>
                  <div className="mt-2 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-pokemon-yellow/50 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${pred.confidence * 100}%` }}
                      transition={{ duration: 1, delay: 0.5 }}
                    />
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {(pred.confidence * 100).toFixed(0)}% {t.ai.confidence.toLowerCase()}
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-0.5">
                    {formatCurrency(pred.lowerBound)} – {formatCurrency(pred.upperBound)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="text-sm font-semibold text-market-bull mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {t.card.bullishSignals}
              <InfoTooltip text={t.tooltips.bullishSignals} />
            </h4>
            <ul className="space-y-1.5">
              {data.bullishSignals?.length > 0
                ? data.bullishSignals.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowUpRight className="w-3.5 h-3.5 text-market-bull mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))
                : <li className="text-xs text-muted-foreground/50">—</li>
              }
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-market-bear mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              {t.card.bearishSignals}
              <InfoTooltip text={t.tooltips.bearishSignals} />
            </h4>
            <ul className="space-y-1.5">
              {data.bearishSignals?.length > 0
                ? data.bearishSignals.map((s: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <ArrowDownRight className="w-3.5 h-3.5 text-market-bear mt-0.5 shrink-0" />
                      {s}
                    </li>
                  ))
                : <li className="text-xs text-muted-foreground/50">—</li>
              }
            </ul>
          </div>
        </div>
      </div>

      <div className="px-5 py-3 border-t border-white/10">
        <p className="text-xs text-muted-foreground/50">
          {data.modelVersion} · {t.card.notFinancialAdvice}
        </p>
      </div>
    </div>
  )
}
