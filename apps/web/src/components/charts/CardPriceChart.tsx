'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine,
} from 'recharts'
import { clsx } from 'clsx'
import { Lock, TrendingUp, TrendingDown } from 'lucide-react'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'
import { useUserTier } from '@/lib/useUserTier'

type Range = '7d' | '30d' | '90d' | '1y'

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  const price = payload.find((p: any) => p.dataKey === 'price')
  const ma = payload.find((p: any) => p.dataKey === 'ma20')
  return (
    <div className="rounded-xl px-4 py-3 text-xs min-w-[140px]" style={{ background: '#0B1122', border: '1px solid rgba(255,203,5,0.2)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}>
      <p className="text-muted-foreground mb-2 font-medium">{label}</p>
      {price && (
        <p className="font-mono font-bold text-base" style={{ color: price.color }}>
          {formatCurrency(price.value)}
        </p>
      )}
      {ma && ma.value && (
        <p className="font-mono text-xs mt-1" style={{ color: '#94a3b8' }}>
          MA20 {formatCurrency(ma.value)}
        </p>
      )}
    </div>
  )
}

function PriceStat({ label, value, change }: { label: string; value: number; change?: number }) {
  return (
    <div className="text-center">
      <div className="text-xs text-muted-foreground mb-0.5">{label}</div>
      <div className="font-mono font-semibold text-sm">{formatCurrency(value)}</div>
      {change !== undefined && (
        <div className={clsx('text-[10px] font-medium mt-0.5', change >= 0 ? 'text-market-bull' : 'text-market-bear')}>
          {change >= 0 ? '+' : ''}{change.toFixed(1)}%
        </div>
      )}
    </div>
  )
}

export function CardPriceChart({ cardId }: { cardId: string }) {
  const t = useT()
  const { locale } = useLanguage()
  const { isPremium, isElite } = useUserTier()
  const [range, setRange] = useState<Range>('30d')
  const [showMA, setShowMA] = useState(true)

  const allowedRanges = isElite ? ['7d','30d','90d','1y']
    : isPremium ? ['7d','30d','90d','1y']
    : ['7d','30d']

  const { data, isLoading } = useQuery({
    queryKey: ['card-price-history', cardId, range],
    queryFn: () => api.cards.getPriceHistory(cardId, { range, type: 'line' }),
    staleTime: 120_000,
  })

  const rawPrices: { time: number; value: number }[] =
    data && 'prices' in (data as any) ? (data as any).prices : []
  const rawMA20: { time: number; value: number }[] =
    data && 'ma20' in (data as any) ? ((data as any).ma20 ?? []) : []
  const priceChange: number = data && 'priceChange' in (data as any) ? Number((data as any).priceChange) : 0
  const rsi: number = data && 'rsi' in (data as any) ? Number((data as any).rsi) : 50

  // Merger prix + MA20 en un seul tableau, dédupliqué par jour (dernier prix du jour)
  const chartData = useMemo(() => {
    const maMap = new Map(rawMA20.map((m) => [m.time, m.value]))
    const fmt = (t: number) => new Date(t * 1000).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { month: 'short', day: 'numeric' })
    // Garder le dernier prix par jour
    const byDate = new Map<string, { time: number; value: number }>()
    for (const d of rawPrices) {
      byDate.set(fmt(d.time), d)
    }
    return Array.from(byDate.values()).map((d) => ({
      date: fmt(d.time),
      price: +d.value.toFixed(2),
      ma20: maMap.has(d.time) ? +maMap.get(d.time)!.toFixed(2) : null,
    }))
  }, [rawPrices, rawMA20, locale])

  const currentPrice = chartData.at(-1)?.price ?? 0
  const startPrice = chartData[0]?.price ?? 0
  const isPositive = priceChange >= 0
  const color = isPositive ? '#22C55E' : '#EF4444'
  const isSparse = chartData.length < 10

  const RANGES: { key: Range; label: string; locked: boolean }[] = [
    { key: '7d',  label: t.chart.range7d,  locked: false },
    { key: '30d', label: t.chart.range30d, locked: false },
    { key: '90d', label: t.chart.range90d, locked: !allowedRanges.includes('90d') },
    { key: '1y',  label: t.chart.range1y,  locked: !allowedRanges.includes('1y') },
  ]

  const rsiColor = rsi < 30 ? '#22C55E' : rsi > 70 ? '#EF4444' : '#FFCB05'
  const rsiLabel = rsi < 30 ? (locale === 'fr' ? 'Survendu' : 'Oversold') :
    rsi > 70 ? (locale === 'fr' ? 'Suracheté' : 'Overbought') :
    (locale === 'fr' ? 'Neutre' : 'Neutral')

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3" style={{ borderBottom: '1px solid rgba(255,203,5,0.10)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider mb-1">
              {t.chart.title}
            </h3>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-bold font-mono">{formatCurrency(currentPrice)}</span>
              <span className={clsx(
                'flex items-center gap-1 text-sm font-semibold px-2.5 py-1 rounded-full',
                isPositive ? 'text-market-bull bg-market-bull/10' : 'text-market-bear bg-market-bear/10',
              )}>
                {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                {isPositive ? '+' : ''}{priceChange.toFixed(2)}%
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
            {/* Range */}
            <div className="flex gap-1 rounded-xl p-1" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {RANGES.map(({ key, label, locked }) => (
                locked ? (
                  <Link key={key} href="/pricing"
                    className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-white/20 hover:text-white/40 transition-colors"
                    title="Premium requis">
                    <Lock className="w-2.5 h-2.5" />{label}
                  </Link>
                ) : (
                  <button
                    key={key}
                    onClick={() => setRange(key)}
                    className={clsx(
                      'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                      range === key ? 'font-bold' : 'text-white/40 hover:text-white/70',
                    )}
                    style={range === key ? { background: 'rgba(255,203,5,0.15)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.3)' } : {}}
                  >
                    {label}
                  </button>
                )
              ))}
            </div>

            {/* MA toggle */}
            <button
              onClick={() => setShowMA(!showMA)}
              className={clsx(
                'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                showMA
                  ? 'border-blue-400/50 text-blue-400 bg-blue-400/10'
                  : 'border-white/10 text-white/30',
              )}
            >
              MA20
            </button>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="px-5 pt-4 pb-2">
        {isLoading ? (
          <div className="h-64 skeleton rounded-xl" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            {t.chart.noPriceData}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                yAxisId="price"
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v) => `€${v >= 1 ? Number(v).toFixed(0) : Number(v).toFixed(2)}`}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} />
              {startPrice > 0 && (
                <ReferenceLine
                  yAxisId="price"
                  y={startPrice}
                  stroke="rgba(255,255,255,0.08)"
                  strokeDasharray="4 4"
                />
              )}
              <Area
                yAxisId="price"
                type="monotone"
                dataKey="price"
                stroke={color}
                strokeWidth={2}
                fill="url(#priceGrad)"
                dot={isSparse ? { r: 3.5, fill: color, strokeWidth: 0 } : false}
                activeDot={{ r: 4, strokeWidth: 0, fill: color }}
                connectNulls
              />
              {showMA && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="ma20"
                  stroke="#3D7DCA"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="5 3"
                  connectNulls
                  activeDot={false}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Footer stats */}
      {!isLoading && chartData.length > 0 && (
        <div className="px-5 pb-4">
          <div className="flex items-center justify-between pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="grid grid-cols-3 gap-6 flex-1">
              <PriceStat
                label={locale === 'fr' ? 'Début période' : 'Period Open'}
                value={startPrice}
              />
              <PriceStat
                label={locale === 'fr' ? 'Actuel' : 'Current'}
                value={currentPrice}
                change={priceChange}
              />
              <div className="text-center">
                <div className="text-xs text-muted-foreground mb-0.5">RSI 14</div>
                <div className="font-mono font-semibold text-sm" style={{ color: rsiColor }}>
                  {rsi.toFixed(0)}
                </div>
                <div className="text-[10px] mt-0.5" style={{ color: rsiColor }}>{rsiLabel}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
