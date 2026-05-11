'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowDownRight,
  ArrowUpRight,
  Briefcase,
  Download,
  LineChart,
  Plus,
  TrendingUp,
  Upload,
} from 'lucide-react'
import { clsx } from 'clsx'
import Link from 'next/link'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { api } from '@/lib/api'
import { useT } from '@/lib/i18n/LanguageContext'
import { PortfolioChart } from '@/components/charts/PortfolioChart'
import { PortfolioTable } from '@/components/portfolio/PortfolioTable'
import { AddCardModal } from '@/components/portfolio/AddCardModal'
import { ImportCsvModal } from '@/components/portfolio/ImportCsvModal'

export function PortfolioDashboard() {
  const [showAddCard, setShowAddCard] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y' | 'all'>('30d')
  const t = useT()

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.portfolio.getMyPortfolio,
    staleTime: 60_000,
  })

  const { data: history } = useQuery({
    queryKey: ['portfolio-history', timeRange],
    queryFn: () => api.portfolio.getHistory(timeRange),
    enabled: !!portfolio,
  })

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(4).fill(null).map((_, i) => (
            <div key={i} className="skeleton h-28 rounded-xl" />
          ))}
        </div>
        <div className="skeleton h-80 rounded-xl" />
      </div>
    )
  }

  if (!portfolio) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-20 h-20 bg-pokemon-yellow/10 rounded-2xl flex items-center justify-center mb-6">
          <Briefcase className="w-10 h-10 text-pokemon-yellow" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Start Your Portfolio</h2>
        <p className="text-muted-foreground max-w-md mb-8">
          Track your Pokémon card collection, monitor ROI, and get AI-powered insights to optimize your investments.
        </p>
        <button
          onClick={() => setShowAddCard(true)}
          className="flex items-center gap-2 px-6 py-3 bg-pokemon-yellow text-background font-semibold rounded-xl hover:bg-pokemon-yellow/90 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Your First Card
        </button>
      </div>
    )
  }

  const pnl = portfolio.totalValue - portfolio.totalCost
  const pnlPercent = portfolio.totalCost > 0 ? (pnl / portfolio.totalCost) * 100 : 0

  const kpis = [
    {
      label: 'Total Value',
      value: formatCurrency(portfolio.totalValue),
      sub: `${portfolio.cardCount} cards`,
      icon: Briefcase,
      color: 'text-pokemon-yellow',
      bg: 'bg-pokemon-yellow/10',
    },
    {
      label: 'Total Invested',
      value: formatCurrency(portfolio.totalCost),
      sub: 'Cost basis',
      icon: TrendingUp,
      color: 'text-pokemon-blue',
      bg: 'bg-pokemon-blue/10',
    },
    {
      label: 'P&L',
      value: formatCurrency(Math.abs(pnl)),
      prefix: pnl >= 0 ? '+' : '-',
      sub: `${pnlPercent >= 0 ? '+' : ''}${pnlPercent.toFixed(2)}%`,
      subColor: pnl >= 0 ? 'text-market-bull' : 'text-market-bear',
      icon: pnl >= 0 ? ArrowUpRight : ArrowDownRight,
      color: pnl >= 0 ? 'text-market-bull' : 'text-market-bear',
      bg: pnl >= 0 ? 'bg-market-bull/10' : 'bg-market-bear/10',
    },
    {
      label: 'Best Card',
      value: portfolio.bestCard?.name ?? '—',
      sub: portfolio.bestCard ? `+${portfolio.bestCard.roi.toFixed(1)}% ROI` : '',
      subColor: 'text-market-bull',
      icon: LineChart,
      color: 'text-market-bull',
      bg: 'bg-market-bull/10',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.portfolio.title}</h1>
          <p className="text-muted-foreground text-sm">{t.portfolio.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors"
          >
            <Upload className="w-4 h-4" />
            {t.portfolio.importCsv}
          </button>
          <button
            onClick={() => {/* export */}}
            className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm hover:bg-white/10 transition-colors"
          >
            <Download className="w-4 h-4" />
            {t.portfolio.exportCsv}
          </button>
          <button
            onClick={() => setShowAddCard(true)}
            className="flex items-center gap-2 px-4 py-2 bg-pokemon-yellow text-background font-semibold rounded-lg text-sm hover:bg-pokemon-yellow/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Card
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <motion.div
            key={kpi.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="glass-card p-5"
          >
            <div className={`w-9 h-9 ${kpi.bg} rounded-xl flex items-center justify-center mb-3`}>
              <kpi.icon className={`w-5 h-5 ${kpi.color}`} />
            </div>
            <div className="text-xl font-bold font-mono">
              {kpi.prefix && <span className={kpi.color}>{kpi.prefix}</span>}
              {kpi.value}
            </div>
            <div className="text-xs text-muted-foreground mt-1">{kpi.label}</div>
            {kpi.sub && (
              <div className={clsx('text-xs mt-1 font-medium', kpi.subColor ?? 'text-muted-foreground')}>
                {kpi.sub}
              </div>
            )}
          </motion.div>
        ))}
      </div>

      {/* Portfolio Value Chart */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="font-semibold">{t.portfolio.value}</h3>
          <div className="flex rounded-lg overflow-hidden border border-white/10">
            {(['7d', '30d', '90d', '1y', 'all'] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={clsx(
                  'px-3 py-1.5 text-xs font-medium transition-colors',
                  timeRange === range
                    ? 'bg-pokemon-yellow/20 text-pokemon-yellow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                )}
              >
                {range.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <PortfolioChart data={history ?? []} />
      </div>

      {/* Holdings Table */}
      <PortfolioTable portfolioId={portfolio.id} />

      {/* Modals */}
      <AddCardModal open={showAddCard} onClose={() => setShowAddCard(false)} />
      <ImportCsvModal open={showImport} onClose={() => setShowImport(false)} />
    </div>
  )
}
