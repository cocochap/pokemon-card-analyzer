'use client'

import Link from 'next/link'
import { ArrowUpRight, ArrowDownRight, TrendingUp, Shield, Target, Star } from 'lucide-react'

function ScoreRing({ score }: { score: number }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const progress = (score / 100) * circumference
  const color = score >= 70 ? '#22C55E' : score >= 50 ? '#FFCB05' : '#EF4444'

  return (
    <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
      <svg className="absolute inset-0 -rotate-90" width="96" height="96">
        <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
        <circle
          cx="48" cy="48" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={`${progress} ${circumference}`}
          strokeLinecap="round"
          style={{ filter: `drop-shadow(0 0 6px ${color}80)` }}
        />
      </svg>
      <div className="text-center z-10">
        <div className="text-2xl font-bold" style={{ color }}>{score}</div>
        <div className="text-[9px] text-white/40 uppercase tracking-wider">score</div>
      </div>
    </div>
  )
}

export function FeaturedPickHero({ pick }: { pick: any }) {
  const { card, score, signals, narrative, bullish, bearish, targetLow, targetHigh, horizon, riskLevel, priceAtPick } = pick
  const md = card.marketData
  const change30d = md?.priceChange30d ? Number(md.priceChange30d) : 0
  const change7d = md?.priceChange7d ? Number(md.priceChange7d) : 0
  const ath = md?.allTimeHigh ? Number(md.allTimeHigh) : priceAtPick
  const athDropPct = ath > priceAtPick ? (((ath - priceAtPick) / ath) * 100).toFixed(0) : '0'

  const riskColor = riskLevel === 'faible' ? '#22C55E' : riskLevel === 'modéré' ? '#FFCB05' : '#EF4444'

  return (
    <div className="relative overflow-hidden rounded-2xl"
      style={{
        background: 'linear-gradient(135deg, rgba(255,203,5,0.06) 0%, rgba(15,23,42,0.95) 40%, rgba(6,9,24,0.98) 100%)',
        border: '1px solid rgba(255,203,5,0.25)',
        boxShadow: '0 0 40px rgba(255,203,5,0.08), inset 0 1px 0 rgba(255,203,5,0.12)',
      }}>

      {/* Gold shimmer top bar */}
      <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.6), transparent)' }} />

      <div className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row gap-8">

          {/* Card image */}
          <div className="flex-shrink-0 flex justify-center md:justify-start">
            {card.imageSmUrl ? (
              <div className="relative group">
                <div className="absolute -inset-2 rounded-2xl opacity-40 blur-xl"
                  style={{ background: 'radial-gradient(circle, rgba(255,203,5,0.4), transparent 70%)' }} />
                <img
                  src={card.imageSmUrl}
                  alt={card.name}
                  className="relative w-40 h-56 object-contain drop-shadow-2xl transition-transform duration-300 group-hover:scale-105"
                  style={{ filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.8))' }}
                />
              </div>
            ) : (
              <div className="w-40 h-56 rounded-xl flex items-center justify-center text-4xl"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
                🃏
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4 mb-4 flex-wrap">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-pokemon-yellow fill-pokemon-yellow" />
                  <span className="text-xs font-bold uppercase tracking-widest text-pokemon-yellow/70">Carte du mois</span>
                </div>
                <h3 className="text-2xl md:text-3xl font-bold mb-1">{card.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {card.set?.name} — {card.rarity?.replace(/_/g, ' ').toLowerCase()}
                </p>
              </div>
              <ScoreRing score={score} />
            </div>

            {/* Price stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              <StatBox label="Prix actuel" value={`${priceAtPick.toFixed(2)}€`} highlight />
              <StatBox label="All-Time High" value={`${ath.toFixed(2)}€`} sub={`-${athDropPct}%`} subColor="#60A5FA" />
              <StatBox
                label="7 jours"
                value={`${change7d >= 0 ? '+' : ''}${change7d.toFixed(1)}%`}
                highlight={change7d > 0}
                valueColor={change7d >= 0 ? '#22C55E' : '#EF4444'}
              />
              <StatBox
                label="30 jours"
                value={`${change30d >= 0 ? '+' : ''}${change30d.toFixed(1)}%`}
                valueColor={change30d >= 0 ? '#22C55E' : '#EF4444'}
              />
            </div>

            {/* AI Narrative */}
            <p className="text-sm text-white/70 leading-relaxed mb-5 italic">
              "{narrative}"
            </p>

            {/* Signals */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                  <span className="text-xs font-semibold text-green-400 uppercase tracking-wider">Signaux haussiers</span>
                </div>
                <ul className="space-y-1.5">
                  {(bullish ?? []).map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowUpRight className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/65">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Shield className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Risques</span>
                </div>
                <ul className="space-y-1.5">
                  {(bearish ?? []).map((b: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <ArrowDownRight className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                      <span className="text-white/65">{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Footer row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                {targetLow && targetHigh && (
                  <div className="flex items-center gap-1.5 text-sm">
                    <Target className="w-3.5 h-3.5 text-pokemon-yellow" />
                    <span className="text-white/50">Cible :</span>
                    <span className="font-semibold text-pokemon-yellow">{targetLow}€ – {targetHigh}€</span>
                  </div>
                )}
                <div className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)' }}>
                  Horizon : {horizon}
                </div>
                <div className="text-xs px-2.5 py-1 rounded-full font-semibold"
                  style={{ background: `${riskColor}15`, color: riskColor, border: `1px solid ${riskColor}40` }}>
                  Risque {riskLevel}
                </div>
              </div>
              <Link href={`/cards/${card.id}`}
                className="flex items-center gap-1.5 text-sm font-semibold transition-colors text-pokemon-yellow hover:text-pokemon-yellow/80">
                Voir la carte <ArrowUpRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatBox({ label, value, sub, highlight, valueColor, subColor }: {
  label: string
  value: string
  sub?: string
  highlight?: boolean
  valueColor?: string
  subColor?: string
}) {
  return (
    <div className="rounded-xl p-3"
      style={{
        background: highlight ? 'rgba(255,203,5,0.06)' : 'rgba(255,255,255,0.04)',
        border: highlight ? '1px solid rgba(255,203,5,0.2)' : '1px solid rgba(255,255,255,0.06)',
      }}>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="font-bold text-lg leading-tight" style={{ color: valueColor ?? (highlight ? '#FFCB05' : undefined) }}>
        {value}
      </div>
      {sub && <div className="text-xs mt-0.5 font-medium" style={{ color: subColor ?? 'rgba(255,255,255,0.4)' }}>{sub}</div>}
    </div>
  )
}
