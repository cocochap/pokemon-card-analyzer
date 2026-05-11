'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'

type Range = '7d' | '30d' | '90d'

export function CardPriceTable({ cardId }: { cardId: string }) {
  const t = useT()
  const { locale } = useLanguage()
  const [range, setRange] = useState<Range>('30d')

  const { data, isLoading } = useQuery({
    queryKey: ['card-price-history-table', cardId, range],
    queryFn: () => api.cards.getPriceHistory(cardId, { range, type: 'line' }),
    staleTime: 60_000,
  })

  // The API returns { prices: [{time, value}], ... }
  const rawPrices: { time: number; value: number }[] =
    data && typeof data === 'object' && 'prices' in (data as any)
      ? (data as any).prices
      : Array.isArray(data) ? data : []

  const step = Math.max(1, Math.floor(rawPrices.length / 15))
  const rows = rawPrices.filter((_, i) => i % step === 0 || i === rawPrices.length - 1).slice(-15).reverse()

  const RANGES: { key: Range; label: string }[] = [
    { key: '7d', label: t.chart.range7d },
    { key: '30d', label: t.chart.range30d },
    { key: '90d', label: t.chart.range90d },
  ]

  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US'

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center justify-between flex-wrap gap-3">
        <h3 className="font-semibold">{t.card.priceHistory}</h3>
        <div className="flex gap-1 bg-white/5 rounded-xl p-1">
          {RANGES.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={clsx(
                'px-3 py-1 rounded-lg text-sm font-medium transition-all',
                range === key ? 'bg-pokemon-yellow text-background font-bold' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.date}</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.price}</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.change}</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.volume}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array(8).fill(null).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4].map((j) => (
                    <td key={j} className="py-3 px-5">
                      <div className="skeleton h-4 rounded" style={{ width: j === 1 ? 80 : 60 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-muted-foreground text-sm">
                  {t.chart.noPriceData}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => {
                const price = row.value ?? 0
                const prevRow = rows[i + 1]
                const prevPrice = prevRow ? (prevRow.value ?? 0) : price
                const change = prevPrice > 0 ? ((price - prevPrice) / prevPrice) * 100 : 0
                const date = new Date(row.time * 1000)

                return (
                  <tr key={i} className="hover:bg-white/2 transition-colors">
                    <td className="py-2.5 px-5 text-muted-foreground text-xs">
                      {date.toLocaleDateString(dateLocale, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="py-2.5 px-5 text-right font-mono font-medium">
                      {formatCurrency(price)}
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      {change !== 0 ? (
                        <span className={clsx(
                          'flex items-center justify-end gap-0.5 text-xs font-semibold',
                          change >= 0 ? 'text-market-bull' : 'text-market-bear',
                        )}>
                          {change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {Math.abs(change).toFixed(2)}%
                        </span>
                      ) : <span className="text-xs text-muted-foreground/40">—</span>}
                    </td>
                    <td className="py-2.5 px-5 text-right text-xs text-muted-foreground">—</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
