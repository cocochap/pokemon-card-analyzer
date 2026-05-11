'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { ShoppingCart } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useLanguage, useT } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'

export function RecentSales() {
  const { data, isLoading } = useQuery({
    queryKey: ['market-recent-sales'],
    queryFn: () => api.market.getRecentSales(12),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const t = useT()
  const { locale } = useLanguage()
  const sales = Array.isArray(data) ? data : []

  return (
    <div className="glass-card overflow-hidden flex flex-col">
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-muted-foreground" />
        </div>
        <div>
          <h3 className="font-semibold">{t.dashboard.sections.recentSales}</h3>
          <p className="text-xs text-muted-foreground">{t.market.recentSales}</p>
        </div>
      </div>

      <div className="flex-1 divide-y divide-white/5 overflow-y-auto max-h-[480px]">
        {isLoading
          ? Array(8).fill(null).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="skeleton w-8 h-11 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3.5 w-28 rounded" />
                  <div className="skeleton h-3 w-20 rounded" />
                </div>
                <div className="skeleton h-4 w-14 rounded" />
              </div>
            ))
          : sales.length === 0
          ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              {t.common.noRecentSales}
            </div>
          )
          : sales.map((sale: any, i: number) => {
              const date = new Date(sale.soldAt ?? Date.now())
              const daysAgo = Math.floor((Date.now() - date.getTime()) / 86400000)

              return (
                <motion.div
                  key={sale.id ?? i}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={`/cards/${sale.card?.id ?? sale.cardId}`}
                    className="flex items-center gap-3 p-4 hover:bg-white/3 transition-colors group"
                  >
                    {/* Card thumbnail */}
                    <div className="w-8 h-11 rounded-lg overflow-hidden bg-white/5 shrink-0 border border-white/10">
                      {sale.card?.imageSmUrl ? (
                        <Image src={sale.card.imageSmUrl} alt={sale.card.name} width={32} height={44} className="w-full h-full object-cover" />
                      ) : null}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-pokemon-yellow transition-colors">
                        {sale.card ? getCardName(sale.card, locale) : (locale === 'fr' ? 'Carte inconnue' : 'Unknown Card')}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={clsx(
                          'text-xs px-1.5 py-0.5 rounded-full',
                          sale.platform === 'eBay' ? 'bg-yellow-400/10 text-yellow-400' : 'bg-blue-400/10 text-blue-400',
                        )}>
                          {sale.platform ?? (locale === 'fr' ? 'Inconnu' : 'Unknown')}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {daysAgo === 0 ? t.common.today : `${daysAgo}${t.common.daysAgo}`}
                        </span>
                      </div>
                    </div>

                    {/* Price */}
                    <div className="font-mono font-semibold text-sm shrink-0">
                      {formatCurrency(Number(sale.salePrice))}
                    </div>
                  </Link>
                </motion.div>
              )
            })}
      </div>
    </div>
  )
}
