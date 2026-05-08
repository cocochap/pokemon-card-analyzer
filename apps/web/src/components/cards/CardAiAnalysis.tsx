'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Brain,
  CheckCircle2,
  Loader2,
  Minus,
  Shield,
  TrendingDown,
  TrendingUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency, formatPercent } from '@/lib/formatters'

interface CardAiAnalysisProps {
  cardId: string
}

const HORIZONS = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
]

function TrendBadge({ direction }: { direction: string }) {
  const config = {
    BULLISH: { icon: TrendingUp, color: 'text-market-bull', bg: 'bg-market-bull/10 border-market-bull/30', label: 'Bullish' },
    BEARISH: { icon: TrendingDown, color: 'text-market-bear', bg: 'bg-market-bear/10 border-market-bear/30', label: 'Bearish' },
    STABLE: { icon: Minus, color: 'text-muted-foreground', bg: 'bg-white/5 border-white/20', label: 'Stable' },
    VOLATILE: { icon: Zap, color: 'text-pokemon-yellow', bg: 'bg-pokemon-yellow/10 border-pokemon-yellow/30', label: 'Volatile' },
  }[direction] ?? { icon: Minus, color: 'text-muted-foreground', bg: 'bg-white/5 border-white/20', label: direction }

  return (
    <div className={clsx('inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border', config.bg, config.color)}>
      <config.icon className="w-4 h-4" />
      {config.label}
    </div>
  )
}

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const radius = 28
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (value / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 70 70">
          <circle cx="35" cy="35" r={radius} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
          <motion.circle
            cx="35"
            cy="35"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
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
      <span className="text-xs text-muted-foreground text-center">{label}</span>
    </div>
  )
}

export function CardAiAnalysis({ cardId }: CardAiAnalysisProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['card-ai-analysis', cardId],
    queryFn: () => api.ai.getCardAnalysis(cardId),
    staleTime: 5 * 60_000,
  })

  if (isLoading) {
    return (
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <Brain className="w-5 h-5 text-pokemon-yellow" />
          <h3 className="font-semibold">AI Analysis</h3>
        </div>
        <div className="flex items-center justify-center h-48">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-pokemon-yellow animate-spin" />
            <span className="text-sm text-muted-foreground">Analyzing market data...</span>
          </div>
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-pokemon-yellow/10 rounded-xl flex items-center justify-center">
            <Brain className="w-5 h-5 text-pokemon-yellow" />
          </div>
          <div>
            <h3 className="font-semibold">AI Market Analysis</h3>
            <p className="text-xs text-muted-foreground">
              Confidence: {(data.confidenceScore * 100).toFixed(0)}% · Updated recently
            </p>
          </div>
        </div>
        <TrendBadge direction={data.trendDirection} />
      </div>

      <div className="p-5 space-y-6">
        {/* Score Rings */}
        <div className="grid grid-cols-4 gap-4">
          <ScoreRing value={data.investmentScore} label="Investment" color="#FFCB05" />
          <ScoreRing value={data.rarityScore} label="Rarity" color="#7B2D8B" />
          <ScoreRing value={data.liquidityScore} label="Liquidity" color="#3D7DCA" />
          <ScoreRing value={100 - data.riskLevel} label="Safety" color="#22C55E" />
        </div>

        {/* Key Insight */}
        {data.keyInsight && (
          <div className="bg-pokemon-yellow/5 border border-pokemon-yellow/20 rounded-xl p-4">
            <p className="text-sm text-foreground/90 leading-relaxed">
              <span className="text-pokemon-yellow font-semibold">AI Insight: </span>
              {data.keyInsight}
            </p>
          </div>
        )}

        {/* Price Predictions */}
        <div>
          <h4 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Price Predictions
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {HORIZONS.map(({ days, label }) => {
              const pred = data.predictions.find((p: { horizonDays: number }) => p.horizonDays === days)
              if (!pred) return null
              const roi = ((pred.predictedPrice - data.currentPrice) / data.currentPrice) * 100
              return (
                <div key={days} className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-2">{label}</div>
                  <div className="font-bold text-lg font-mono">{formatCurrency(pred.predictedPrice)}</div>
                  <div
                    className={clsx(
                      'flex items-center gap-0.5 text-sm font-medium mt-1',
                      roi >= 0 ? 'text-market-bull' : 'text-market-bear',
                    )}
                  >
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
                    {(pred.confidence * 100).toFixed(0)}% confidence
                  </div>
                  <div className="text-xs text-muted-foreground/60 mt-1">
                    {formatCurrency(pred.lowerBound)} – {formatCurrency(pred.upperBound)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Signals */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Bullish Signals */}
          <div>
            <h4 className="text-sm font-semibold text-market-bull mb-2 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Bullish Signals
            </h4>
            <ul className="space-y-1.5">
              {data.bullishSignals.map((signal: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ArrowUpRight className="w-3.5 h-3.5 text-market-bull mt-0.5 shrink-0" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>

          {/* Bearish Signals */}
          <div>
            <h4 className="text-sm font-semibold text-market-bear mb-2 flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Bearish Signals
            </h4>
            <ul className="space-y-1.5">
              {data.bearishSignals.map((signal: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <ArrowDownRight className="w-3.5 h-3.5 text-market-bear mt-0.5 shrink-0" />
                  {signal}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-white/10 bg-white/2">
        <p className="text-xs text-muted-foreground/60">
          Model: {data.modelVersion} · For informational purposes only. Not financial advice.
        </p>
      </div>
    </div>
  )
}
