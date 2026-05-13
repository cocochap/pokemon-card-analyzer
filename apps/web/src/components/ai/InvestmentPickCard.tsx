'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, Target } from 'lucide-react'

const ACCENT_COLORS = {
  gold: { bg: 'rgba(255,203,5,0.08)', border: 'rgba(255,203,5,0.25)', text: '#FFCB05' },
  blue: { bg: 'rgba(96,165,250,0.08)', border: 'rgba(96,165,250,0.25)', text: '#60A5FA' },
  purple: { bg: 'rgba(167,139,250,0.08)', border: 'rgba(167,139,250,0.25)', text: '#A78BFA' },
  green: { bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.25)', text: '#22C55E' },
}

export function InvestmentPickCard({
  pick,
  accent = 'gold',
}: {
  pick: any
  accent?: keyof typeof ACCENT_COLORS
}) {
  const { card, score, signals, narrative, bullish, targetLow, targetHigh, horizon, riskLevel, priceAtPick } = pick
  const md = card.marketData
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const change7d = md?.priceChange7d ? Number(md.priceChange7d) : 0
  const ac = ACCENT_COLORS[accent]

  const riskColor = riskLevel === 'faible' ? '#22C55E' : riskLevel === 'modéré' ? '#FFCB05' : '#EF4444'

  return (
    <Link href={`/cards/${card.id}`} className="block group">
      <div className="rounded-xl overflow-hidden transition-all duration-200 group-hover:scale-[1.02]"
        style={{
          background: 'rgba(15,23,42,0.6)',
          border: `1px solid ${ac.border}`,
          boxShadow: `0 0 20px ${ac.bg}`,
        }}>

        {/* Score badge */}
        <div className="relative">
          {card.imageSmUrl ? (
            <div className="relative w-full aspect-[3/4] overflow-hidden bg-black/20">
              <img
                src={card.imageSmUrl}
                alt={card.name}
                className="absolute inset-0 w-full h-full object-contain p-2 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            </div>
          ) : (
            <div className="w-full aspect-[3/4] flex items-center justify-center text-5xl"
              style={{ background: 'rgba(255,255,255,0.03)' }}>
              🃏
            </div>
          )}
          {/* Score pill overlay */}
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-bold"
            style={{ background: 'rgba(0,0,0,0.75)', color: ac.text, border: `1px solid ${ac.border}`, backdropFilter: 'blur(4px)' }}>
            {score}
          </div>
        </div>

        {/* Info */}
        <div className="p-3">
          <h4 className="font-semibold text-sm truncate mb-0.5">{card.name}</h4>
          <p className="text-xs text-muted-foreground truncate mb-2">{card.set?.name}</p>

          {/* Price + change */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-bold text-sm" style={{ color: ac.text }}>
              {priceAtPick.toFixed(2)}€
            </span>
            <div className={`flex items-center gap-0.5 text-xs font-semibold ${change30d >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {change30d >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(change30d).toFixed(1)}%
              <span className="text-white/30 font-normal ml-0.5">30j</span>
            </div>
          </div>

          {/* Top bullish signal */}
          {bullish?.[0] && (
            <p className="text-xs text-white/50 mb-2 line-clamp-2">
              ↑ {bullish[0]}
            </p>
          )}

          {/* Target + risk */}
          <div className="flex items-center justify-between gap-1 flex-wrap">
            {targetLow && targetHigh && (
              <div className="flex items-center gap-1 text-xs">
                <Target className="w-3 h-3" style={{ color: ac.text }} />
                <span style={{ color: ac.text }} className="font-medium">{targetHigh}€</span>
              </div>
            )}
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: `${riskColor}15`, color: riskColor }}>
              {riskLevel}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
