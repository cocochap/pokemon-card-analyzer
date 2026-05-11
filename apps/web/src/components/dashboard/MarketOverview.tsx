'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Activity, ArrowDownRight, ArrowUpRight, BarChart2, DollarSign, Flame, TrendingDown, TrendingUp } from 'lucide-react'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n/LanguageContext'

export function MarketOverview() {
  const t = useT()
  const { data, isLoading } = useQuery({
    queryKey: ['market-overview'],
    queryFn: api.market.getOverview,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const kpis = data
    ? [
        {
          label: t.market.globalMarketCap,
          value: formatCurrency(data.totalMarketCap),
          change: data.marketCapChange24h,
          icon: DollarSign,
          color: 'text-pokemon-yellow',
          bg: 'bg-pokemon-yellow/10',
        },
        {
          label: t.market.volume24h,
          value: formatCurrency(data.volume24h),
          change: data.volumeChange24h,
          icon: BarChart2,
          color: 'text-pokemon-blue',
          bg: 'bg-pokemon-blue/10',
        },
        {
          label: t.market.pokemonIndex,
          value: data.marketIndex.toFixed(2),
          change: data.indexChange24h,
          icon: Activity,
          color: 'text-market-bull',
          bg: 'bg-market-bull/10',
        },
        {
          label: t.market.trending,
          value: `${data.trendingCount}`,
          icon: Flame,
          color: 'text-orange-400',
          bg: 'bg-orange-400/10',
        },
        {
          label: t.market.topGainers,
          value: formatPercent(data.topGainerChange),
          icon: TrendingUp,
          color: 'text-market-bull',
          bg: 'bg-market-bull/10',
          prefix: '+',
        },
        {
          label: t.market.topLosers,
          value: formatPercent(data.topLoserChange),
          icon: TrendingDown,
          color: 'text-market-bear',
          bg: 'bg-market-bear/10',
        },
      ]
    : Array(6).fill(null)

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
      {kpis.map((kpi, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05, duration: 0.4 }}
          className="glass-card p-4 hover:bg-white/8 transition-all duration-300"
        >
          {isLoading || !kpi ? (
            <div className="space-y-3">
              <div className="skeleton h-8 w-8 rounded-lg" />
              <div className="skeleton h-5 w-24" />
              <div className="skeleton h-4 w-16" />
            </div>
          ) : (
            <>
              <div className={`w-8 h-8 ${kpi.bg} rounded-lg flex items-center justify-center mb-3`}>
                <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              </div>
              <div className="font-bold text-lg font-mono tabular-nums">{kpi.value}</div>
              <div className="text-xs text-muted-foreground">{kpi.label}</div>
              {kpi.change !== undefined && (
                <div
                  className={`flex items-center gap-1 text-xs mt-1 font-medium ${
                    kpi.change >= 0 ? 'text-market-bull' : 'text-market-bear'
                  }`}
                >
                  {kpi.change >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(kpi.change).toFixed(2)}%
                </div>
              )}
            </>
          )}
        </motion.div>
      ))}
    </div>
  )
}
