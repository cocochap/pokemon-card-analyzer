'use client'

import { ArrowDownRight, ArrowUpRight, BarChart2, TrendingUp, Activity } from 'lucide-react'
import { clsx } from 'clsx'
import { formatCurrency } from '@/lib/formatters'
import { useT } from '@/lib/i18n/LanguageContext'
import { InfoTooltip } from '@/components/ui/InfoTooltip'

export function CardMarketStats({ card }: { card: any }) {
  const t = useT()
  const md = card?.marketData
  const prices = card?.prices ?? []
  const cmPrice = prices.find((p: any) => p.source === 'cardmarket')
  const tcgPrice = prices.find((p: any) => p.source === 'tcgplayer')

  if (!md && prices.length === 0) {
    return (
      <div className="glass-card p-5">
        <p className="text-sm text-muted-foreground">{t.market.noData}</p>
      </div>
    )
  }

  const change24h = Number(md?.priceChange24h ?? 0)
  const change7d = Number(md?.priceChange7d ?? 0)
  const change30d = Number(md?.priceChange30d ?? 0)
  const vol30d = Number(md?.volatility30d ?? 0)
  const rsi = Number(md?.rsi14 ?? 50)

  const stats = [
    {
      label: t.market.change24h, tooltip: t.tooltips.priceChange,
      value: `${change24h >= 0 ? '+' : ''}${change24h.toFixed(2)}%`,
      isPositive: change24h >= 0, icon: change24h >= 0 ? ArrowUpRight : ArrowDownRight,
      color: change24h >= 0 ? 'text-market-bull' : 'text-market-bear',
      bg: change24h >= 0 ? 'bg-market-bull/10' : 'bg-market-bear/10',
    },
    {
      label: t.market.change7d, tooltip: t.tooltips.priceChange,
      value: `${change7d >= 0 ? '+' : ''}${change7d.toFixed(2)}%`,
      isPositive: change7d >= 0, icon: change7d >= 0 ? ArrowUpRight : ArrowDownRight,
      color: change7d >= 0 ? 'text-market-bull' : 'text-market-bear',
      bg: change7d >= 0 ? 'bg-market-bull/10' : 'bg-market-bear/10',
    },
    {
      label: t.market.change30d, tooltip: t.tooltips.priceChange,
      value: `${change30d >= 0 ? '+' : ''}${change30d.toFixed(2)}%`,
      isPositive: change30d >= 0, icon: change30d >= 0 ? ArrowUpRight : ArrowDownRight,
      color: change30d >= 0 ? 'text-market-bull' : 'text-market-bear',
      bg: change30d >= 0 ? 'bg-market-bull/10' : 'bg-market-bear/10',
    },
    {
      label: t.card.volatility, tooltip: t.tooltips.volatility,
      value: `${(vol30d * 100).toFixed(1)}%`,
      icon: Activity, color: 'text-pokemon-yellow', bg: 'bg-pokemon-yellow/10',
    },
    {
      label: t.card.rsi, tooltip: t.tooltips.rsi,
      value: rsi.toFixed(1),
      sub: rsi < 30 ? (t.ai.stable + ' ↗') : rsi > 70 ? '↘' : '—',
      icon: BarChart2,
      color: rsi < 30 ? 'text-market-bull' : rsi > 70 ? 'text-market-bear' : 'text-muted-foreground',
      bg: rsi < 30 ? 'bg-market-bull/10' : rsi > 70 ? 'bg-market-bear/10' : 'bg-white/5',
    },
    {
      label: t.card.marketCap, tooltip: t.tooltips.marketCap,
      value: md?.marketCap ? `€${(Number(md.marketCap) / 1000).toFixed(1)}K` : '—',
      icon: TrendingUp, color: 'text-pokemon-blue', bg: 'bg-pokemon-blue/10',
    },
  ]

  return (
    <div className="glass-card overflow-hidden">
      {/* ATH / ATL */}
      {md && (
        <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5">
          <div className="p-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              {t.card.allTimeHigh} <InfoTooltip text={t.tooltips.athAtl} />
            </div>
            <div className="font-mono font-bold text-market-bull">{formatCurrency(Number(md.allTimeHigh ?? 0))}</div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
              {t.card.allTimeLow} <InfoTooltip text={t.tooltips.athAtl} />
            </div>
            <div className="font-mono font-bold text-market-bear">{formatCurrency(Number(md.allTimeLow ?? 0))}</div>
          </div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-px bg-white/5">
        {stats.map((s, i) => (
          <div key={i} className="bg-card/80 p-3 sm:p-4 flex flex-col gap-1.5">
            <div className={clsx('w-7 h-7 rounded-lg flex items-center justify-center', s.bg)}>
              <s.icon className={clsx('w-3.5 h-3.5', s.color)} />
            </div>
            <div className={clsx('text-sm sm:text-base font-bold font-mono', s.color)}>{s.value}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              {s.label}
              {s.tooltip && <InfoTooltip text={s.tooltip} side="bottom" />}
            </div>
          </div>
        ))}
      </div>

      {/* Prices by platform */}
      {(cmPrice || tcgPrice) && (
        <div className="p-4 border-t border-white/5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {t.card.platform}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {cmPrice && (
              <div className="bg-white/3 rounded-xl p-3 border border-white/8">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  Cardmarket <InfoTooltip text={t.tooltips.cardmarket} side="bottom" />
                </div>
                <div className="font-mono font-bold">{formatCurrency(Number(cmPrice.market))}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Min: {formatCurrency(Number(cmPrice.low ?? 0))} · Max: {formatCurrency(Number(cmPrice.high ?? 0))}
                </div>
              </div>
            )}
            {tcgPrice && (
              <div className="bg-white/3 rounded-xl p-3 border border-white/8">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  TCGPlayer <InfoTooltip text={t.tooltips.tcgplayer} side="bottom" />
                </div>
                <div className="font-mono font-bold">${Number(tcgPrice.market).toFixed(2)}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Min: ${Number(tcgPrice.low ?? 0).toFixed(2)} · Max: ${Number(tcgPrice.high ?? 0).toFixed(2)}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
