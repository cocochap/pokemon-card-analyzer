'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'
import { clsx } from 'clsx'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'

type Range = '7d' | '30d' | '90d'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#080d14] border border-white/15 rounded-xl px-3 py-2 shadow-xl text-xs">
      <p className="text-muted-foreground mb-1">{label}</p>
      <p className="font-mono font-bold text-pokemon-yellow">{formatCurrency(payload[0]?.value ?? 0)}</p>
    </div>
  )
}

export function CardPriceChart({ cardId }: { cardId: string }) {
  const t = useT()
  const { locale } = useLanguage()
  const [range, setRange] = useState<Range>('90d')

  const { data, isLoading } = useQuery({
    queryKey: ['card-price-history', cardId, range],
    queryFn: () => api.cards.getPriceHistory(cardId, { range, type: 'line' }),
    staleTime: 60_000,
  })

  // API returns { prices: [{time, value}], priceChange, ... }
  const rawPrices: { time: number; value: number }[] =
    data && typeof data === 'object' && 'prices' in (data as any)
      ? (data as any).prices
      : Array.isArray(data) ? data : []

  const priceChange: number = data && typeof data === 'object' && 'priceChange' in (data as any)
    ? Number((data as any).priceChange)
    : 0

  const chartData = rawPrices.map((d) => ({
    date: new Date(d.time * 1000).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      month: 'short', day: 'numeric',
    }),
    price: Number(d.value.toFixed(2)),
  }))

  const currentPrice = chartData.at(-1)?.price ?? 0
  const startPrice = chartData[0]?.price ?? 0
  const isPositive = priceChange >= 0

  const RANGES: { key: Range; label: string }[] = [
    { key: '7d', label: t.chart.range7d },
    { key: '30d', label: t.chart.range30d },
    { key: '90d', label: t.chart.range90d },
  ]

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-white/10 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h3 className="font-semibold">{t.chart.title}</h3>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-2xl font-bold font-mono">{formatCurrency(currentPrice)}</span>
            {priceChange !== 0 && (
              <span className={clsx(
                'flex items-center gap-1 text-sm font-semibold px-2 py-0.5 rounded-full',
                isPositive
                  ? 'text-market-bull bg-market-bull/10'
                  : 'text-market-bear bg-market-bear/10',
              )}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            )}
          </div>
        </div>

        {/* Range selector */}
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-all',
                range === key
                  ? 'bg-pokemon-yellow text-background font-bold'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        {isLoading ? (
          <div className="h-64 skeleton rounded-xl" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            {t.chart.noPriceData}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isPositive ? '#22C55E' : '#EF4444'} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isPositive ? '#22C55E' : '#EF4444'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `€${Number(v) >= 1 ? Number(v).toFixed(0) : Number(v).toFixed(2)}`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              {startPrice > 0 && (
                <ReferenceLine
                  y={startPrice}
                  stroke="rgba(255,255,255,0.1)"
                  strokeDasharray="4 4"
                />
              )}
              <Area
                type="monotone"
                dataKey="price"
                stroke={isPositive ? '#22C55E' : '#EF4444'}
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: isPositive ? '#22C55E' : '#EF4444' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
