'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Brain, TrendingUp, TrendingDown, Minus, Zap } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n/LanguageContext'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

function ScoreGauge({ value, label, color, tooltip }: { value: number; label: string; color: string; tooltip?: string }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative w-[72px] h-[72px]">
        <svg width="72" height="72" viewBox="0 0 70 70" className="-rotate-90">
          <circle cx="35" cy="35" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
          <motion.circle
            cx="35" cy="35" r={r}
            fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold font-mono">{value}</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <span className="text-xs text-muted-foreground text-center">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} side="bottom" />}
      </div>
    </div>
  )
}

export function CardInvestmentScore({ cardId }: { cardId: string }) {
  const t = useT()

  const { data, isLoading } = useQuery({
    queryKey: ['card-ai-analysis', cardId],
    queryFn: () => api.ai.getCardAnalysis(cardId),
    staleTime: 300_000,
  })

  if (isLoading) {
    return (
      <div className="glass-card p-5 mt-4">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-pokemon-yellow" />
          <span className="font-semibold text-sm">{t.card.investmentScore}</span>
        </div>
        <div className="skeleton h-28 rounded-xl" />
      </div>
    )
  }

  if (!data) return null

  const trendLabel = t.trend[data.trendDirection as keyof typeof t.trend] ?? data.trendDirection
  const TrendIcon = data.trendDirection === 'BULLISH' ? TrendingUp
    : data.trendDirection === 'BEARISH' ? TrendingDown
    : data.trendDirection === 'VOLATILE' ? Zap : Minus
  const trendColor = data.trendDirection === 'BULLISH' ? 'text-market-bull bg-market-bull/10 border-market-bull/30'
    : data.trendDirection === 'BEARISH' ? 'text-market-bear bg-market-bear/10 border-market-bear/30'
    : data.trendDirection === 'VOLATILE' ? 'text-pokemon-yellow bg-pokemon-yellow/10 border-pokemon-yellow/30'
    : 'text-muted-foreground bg-white/5 border-white/15'

  return (
    <div className="glass-card p-5 mt-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-pokemon-yellow" />
          <span className="font-semibold text-sm">{t.card.investmentScore}</span>
          <InfoTooltip text={t.tooltips.investmentScore} />
        </div>
        <div className={clsx('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border', trendColor)}>
          <TrendIcon className="w-3 h-3" />
          {trendLabel}
        </div>
      </div>

      {/* Score gauges */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <ScoreGauge value={data.investmentScore} label={t.card.investment} color="#FFCB05" tooltip={t.tooltips.investmentScore} />
        <ScoreGauge value={data.rarityScore} label={t.card.rarity} color="#7B2D8B" tooltip={t.tooltips.rarityScore} />
        <ScoreGauge value={data.liquidityScore} label={t.card.liquidity} color="#3D7DCA" tooltip={t.tooltips.liquidityScore} />
        <ScoreGauge value={Math.max(0, 100 - data.riskLevel)} label={t.card.safety} color="#22C55E" tooltip={t.tooltips.safetyScore} />
      </div>

      {/* Predicted ROI */}
      {(data.predictedRoi30d !== undefined || data.predictedRoi90d !== undefined) && (
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              {t.card.roi} 30j <InfoTooltip text={t.tooltips.predictedRoi} side="bottom" />
            </div>
            <div className={clsx('text-sm font-bold font-mono', data.predictedRoi30d >= 0 ? 'text-market-bull' : 'text-market-bear')}>
              {data.predictedRoi30d >= 0 ? '+' : ''}{(data.predictedRoi30d * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-3 border border-white/10">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-0.5">
              {t.card.roi} 90j <InfoTooltip text={t.tooltips.predictedRoi} side="bottom" />
            </div>
            <div className={clsx('text-sm font-bold font-mono', data.predictedRoi90d >= 0 ? 'text-market-bull' : 'text-market-bear')}>
              {data.predictedRoi90d >= 0 ? '+' : ''}{(data.predictedRoi90d * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Confidence */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <div className="flex items-center gap-1 text-muted-foreground">
            {t.ai.confidence} <InfoTooltip text={t.tooltips.aiConfidence} side="bottom" />
          </div>
          <span className="font-mono">{(data.confidenceScore * 100).toFixed(0)}%</span>
        </div>
        <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-pokemon-yellow/60 rounded-full"
            initial={{ width: 0 }}
            animate={{ width: `${data.confidenceScore * 100}%` }}
            transition={{ duration: 1, delay: 0.5 }}
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground/40 mt-3">{t.card.notFinancialAdvice}</p>
    </div>
  )
}
