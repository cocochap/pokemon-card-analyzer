'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from 'recharts'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n/LanguageContext'

const RANGES = ['7d', '30d', '90d', '1y'] as const
const INDEX_TYPES = [
  { key: 'GLOBAL', label: 'Global', color: '#FFCB05' },
  { key: 'MODERN', label: 'Modern', color: '#3D7DCA' },
  { key: 'VINTAGE', label: 'Vintage', color: '#7B2D8B' },
  { key: 'SEALED', label: 'Sealed', color: '#22C55E' },
]

export function MarketIndexChart() {
  const [range, setRange] = useState<typeof RANGES[number]>('90d')
  const [indexType, setIndexType] = useState('GLOBAL')
  const t = useT()

  const { data, isLoading } = useQuery({
    queryKey: ['market-index', indexType, range],
    queryFn: () => api.market.getIndex({ range, type: indexType }),
    staleTime: 120_000,
  })

  const chartData = Array.isArray(data) ? data : []
  const currentColor = INDEX_TYPES.find((t) => t.key === indexType)?.color ?? '#FFCB05'

  const firstVal = chartData[0]?.value ?? 0
  const lastVal = chartData.at(-1)?.value ?? 0
  const totalChange = firstVal > 0 ? ((lastVal - firstVal) / firstVal) * 100 : 0
  const isPositive = totalChange >= 0

  return (
    <div className="glass-card overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-white/10">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-semibold text-lg">{t.dashboard.sections.marketIndex}</h3>
            <div className="flex items-baseline gap-3 mt-1">
              <span className="text-2xl font-bold font-mono">{lastVal.toFixed(2)}</span>
              <span className={clsx('text-sm font-medium', isPositive ? 'text-market-bull' : 'text-market-bear')}>
                {isPositive ? '+' : ''}{totalChange.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {/* Index type selector */}
            <div className="flex gap-1">
              {INDEX_TYPES.map((idx) => (
                <button
                  key={idx.key}
                  onClick={() => setIndexType(idx.key)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    indexType === idx.key
                      ? 'text-background font-semibold'
                      : 'text-muted-foreground hover:text-foreground bg-white/5 hover:bg-white/10',
                  )}
                  style={indexType === idx.key ? { background: idx.color } : undefined}
                >
                  {idx.label}
                </button>
              ))}
            </div>
            {/* Range selector */}
            <div className="flex gap-1">
              {RANGES.map((r) => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={clsx(
                    'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                    range === r
                      ? 'bg-white/15 text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        {isLoading ? (
          <div className="h-64 skeleton rounded-xl" />
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
            {t.common.noIndexData}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={256}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`gradient-${indexType}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={currentColor} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={currentColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => {
                  const d = new Date(v)
                  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#64748B' }}
                tickLine={false}
                axisLine={false}
                domain={['auto', 'auto']}
                tickFormatter={(v) => v.toFixed(0)}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  background: 'rgba(10,14,23,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 10,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#64748B', marginBottom: 4 }}
                formatter={(v: any) => [Number(v).toFixed(2), 'Index']}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={currentColor}
                strokeWidth={2}
                fill={`url(#gradient-${indexType})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: currentColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
