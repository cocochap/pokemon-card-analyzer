'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'

export function CardRecentSales({ cardId }: { cardId: string }) {
  const t = useT()
  const { locale } = useLanguage()

  const { data, isLoading } = useQuery({
    queryKey: ['card-recent-sales', cardId],
    queryFn: () => api.cards.getSales(cardId, 12),
    staleTime: 60_000,
  })

  const sales: any[] = Array.isArray(data) ? data : []
  const avg = sales.length > 0
    ? sales.reduce((s, sale) => s + Number(sale.salePrice), 0) / sales.length
    : 0

  const relativeDate = (dateStr: string) => {
    const daysAgo = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
    if (daysAgo === 0) return t.card.today
    if (daysAgo === 1) return t.card.yesterday
    return `${daysAgo} ${t.card.daysAgo}`
  }

  const conditionLabel = (c: string) => {
    if (c === 'Near Mint') return locale === 'fr' ? 'Quasi parfait' : 'Near Mint'
    if (c === 'Lightly Played') return locale === 'fr' ? 'Légèrement joué' : 'Lightly Played'
    if (c === 'Moderately Played') return locale === 'fr' ? 'Modérément joué' : 'Moderately Played'
    return c
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center">
            <ShoppingCart className="w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="font-semibold">{t.card.recentSales}</h3>
            {avg > 0 && (
              <p className="text-xs text-muted-foreground">
                {locale === 'fr' ? 'Moy.' : 'Avg.'} : {formatCurrency(avg)}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.date}</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.platform}</th>
              <th className="text-left py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.condition}</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-muted-foreground">{t.card.price}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {isLoading ? (
              Array(6).fill(null).map((_, i) => (
                <tr key={i}>
                  {[1, 2, 3, 4].map((j) => (
                    <td key={j} className="py-3 px-5">
                      <div className="skeleton h-4 rounded" style={{ width: j === 4 ? 60 : 80 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sales.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                  {t.card.noSales}
                </td>
              </tr>
            ) : (
              sales.map((sale: any, i: number) => {
                const vs = avg > 0 ? ((Number(sale.salePrice) - avg) / avg) * 100 : 0
                return (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                    className="hover:bg-white/2 transition-colors"
                  >
                    <td className="py-2.5 px-5 text-xs text-muted-foreground">
                      {relativeDate(sale.soldAt ?? Date.now())}
                    </td>
                    <td className="py-2.5 px-5">
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        sale.platform === 'eBay' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400',
                      )}>
                        {sale.platform ?? sale.source ?? '—'}
                      </span>
                    </td>
                    <td className="py-2.5 px-5 text-xs text-muted-foreground">
                      {conditionLabel(sale.condition ?? '')}
                    </td>
                    <td className="py-2.5 px-5 text-right">
                      <div className="font-mono font-medium">{formatCurrency(Number(sale.salePrice))}</div>
                      {Math.abs(vs) > 1 && (
                        <div className={clsx('text-xs', vs > 0 ? 'text-market-bull' : 'text-market-bear')}>
                          {vs > 0 ? '+' : ''}{vs.toFixed(1)}% {t.card.vsAverage}
                        </div>
                      )}
                    </td>
                  </motion.tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
