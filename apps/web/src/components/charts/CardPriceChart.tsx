'use client'

import { useQuery } from '@tanstack/react-query'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { api } from '@/lib/api'

export function CardPriceChart({ cardId }: { cardId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['card-price-history', cardId, '90d'],
    queryFn: () => api.cards.getPriceHistory(cardId, { range: '90d', type: 'line' }),
    staleTime: 60_000,
  })

  if (isLoading) {
    return <div className="rounded-xl border border-border bg-card p-6 h-80 animate-pulse bg-muted" />
  }

  const chartData = Array.isArray(data) ? data.map((d: any) => ({
    date: new Date(d.recordedAt ?? d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    price: d.price ?? d.close ?? 0,
  })) : []

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Price History (90d)</h3>
      {chartData.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-muted-foreground text-sm">
          No price data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={256}>
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#FFCB05" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#FFCB05" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `€${v}`} />
            <Tooltip
              contentStyle={{ background: '#1e2a3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
              labelStyle={{ color: '#94A3B8', fontSize: 11 }}
              formatter={(v: any) => [`€${Number(v).toFixed(2)}`, 'Price']}
            />
            <Area type="monotone" dataKey="price" stroke="#FFCB05" strokeWidth={2} fill="url(#priceGradient)" dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
