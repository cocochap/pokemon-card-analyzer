'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight, Crown,
  Lock, Sparkles, Target, TrendingDown, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useUserTier } from '@/lib/useUserTier'

const VIOLET = '#A78BFA'
const VIOLET_BG = 'rgba(167,139,250,0.10)'
const VIOLET_BORDER = 'rgba(167,139,250,0.20)'

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    'Faible':  { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)' },
    'Modéré':  { color: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
    'Élevé':   { color: '#EF4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)' },
  }
  const s = map[level] ?? map['Modéré']
  return (
    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      Risque {level}
    </span>
  )
}

function MiniBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, (value / max) * 100)}%` }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
      />
    </div>
  )
}

function EliteGate() {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Blurred teaser content */}
      <div className="blur-sm pointer-events-none select-none p-5 space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {['Score', 'Rareté', 'Scarcité'].map(l => (
            <div key={l} className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="text-xs text-white/40 mb-1">{l}</div>
              <div className="text-xl font-bold font-mono text-white/60">—</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl p-4 space-y-2" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <div className="h-3 bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: 'rgba(7,11,27,0.75)', backdropFilter: 'blur(2px)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
          <Lock className="w-5 h-5" style={{ color: VIOLET }} />
        </div>
        <div className="text-center px-6">
          <p className="font-bold text-white mb-1">Analyse Elite exclusive</p>
          <p className="text-sm text-white/50 mb-4">
            Score de scarcité, targets de prix, RSI, signaux IA approfondis — réservé Elite
          </p>
          <Link href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
            <Crown className="w-4 h-4" />
            Passer Elite — 15€/mois
          </Link>
        </div>
      </div>
    </div>
  )
}

export function CardEliteAnalysis({ cardId }: { cardId: string }) {
  const { isElite } = useUserTier()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['card-elite-analysis', cardId],
    queryFn: () => api.ai.getEliteCardAnalysis(cardId),
    enabled: isElite,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const a = (data as any)?.analysis

  return (
    <div className="glass-card overflow-hidden">
      {/* Header — always visible */}
      <div className="px-5 py-4 flex items-center justify-between"
        style={{ borderBottom: `1px solid ${VIOLET_BORDER}` }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
            <Sparkles className="w-4 h-4" style={{ color: VIOLET }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white">Analyse Elite</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
                ELITE
              </span>
            </div>
            <p className="text-xs text-white/40">Analyse d'investissement approfondie par IA</p>
          </div>
        </div>
        {isElite && a && <RiskBadge level={a.riskLevel} />}
      </div>

      {/* Body */}
      {!isElite ? (
        <EliteGate />
      ) : isLoading ? (
        <div className="p-8 flex flex-col items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
            className="w-7 h-7 rounded-full border-2 border-t-transparent"
            style={{ borderColor: VIOLET, borderTopColor: 'transparent' }} />
          <p className="text-sm text-white/40">Calcul en cours…</p>
        </div>
      ) : isError || !a ? (
        <div className="p-6 text-center text-white/40 text-sm flex flex-col items-center gap-2">
          <AlertTriangle className="w-5 h-5" />
          Analyse non disponible pour cette carte
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-5">

          {/* Scores row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Score invest.', value: a.investmentScore, color: a.investmentScore >= 70 ? '#22C55E' : a.investmentScore >= 45 ? '#F59E0B' : '#EF4444' },
              { label: 'Rareté',        value: a.rarityScore,     color: '#A78BFA' },
              { label: 'Scarcité',      value: a.scarcityScore,   color: '#FFCB05' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-xs text-white/40">{label}</div>
                <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
                <MiniBar value={value} color={color} />
              </div>
            ))}
          </div>

          {/* Target prices + Horizon */}
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" style={{ color: VIOLET }} />
              <span className="text-sm font-semibold" style={{ color: VIOLET }}>Objectifs de prix</span>
              <span className="ml-auto text-xs text-white/40">Horizon : {a.horizon}</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <div className="text-[10px] text-white/40 mb-0.5">Cible basse</div>
                <div className="font-bold font-mono text-green-400">€{a.targetLow.toFixed(2)}</div>
              </div>
              <div className="rounded-lg p-2.5 text-center" style={{ background: 'rgba(167,139,250,0.08)', border: `1px solid ${VIOLET_BORDER}` }}>
                <div className="text-[10px] text-white/40 mb-0.5">Cible haute</div>
                <div className="font-bold font-mono" style={{ color: VIOLET }}>€{a.targetHigh.toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* ATH + RSI indicators */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 space-y-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs text-white/40">Sous ATH</div>
              <div className={`text-lg font-bold font-mono ${a.athDropPct > 0 ? 'text-green-400' : 'text-white/60'}`}>
                {a.athDropPct > 0 ? `-${a.athDropPct}%` : 'À l\'ATH'}
              </div>
              <div className="text-[10px] text-white/30">ATH : €{a.ath.toFixed(2)}</div>
            </div>
            <div className="rounded-xl p-3 space-y-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-xs text-white/40">RSI 14</div>
              <div className="text-lg font-bold font-mono"
                style={{ color: a.rsi === null ? 'rgba(255,255,255,0.3)' : a.rsi < 35 ? '#22C55E' : a.rsi > 65 ? '#EF4444' : '#FFCB05' }}>
                {a.rsi !== null ? a.rsi.toFixed(0) : '—'}
              </div>
              <div className="text-[10px] text-white/30">
                {a.rsi === null ? 'Données insuffisantes' : a.rsi < 35 ? 'Survendu' : a.rsi > 65 ? 'Suracheté' : 'Neutre'}
              </div>
            </div>
          </div>

          {/* Signals */}
          <div className="space-y-2">
            {a.bullish?.map((sig: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-green-400">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="text-white/75">{sig}</span>
              </div>
            ))}
            {a.bearish?.map((sig: string, i: number) => (
              <div key={i} className="flex items-start gap-2.5 text-xs text-red-400">
                <TrendingDown className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span className="text-white/75">{sig}</span>
              </div>
            ))}
          </div>

          {/* Changes */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: '7 jours', value: a.change7d },
              { label: '30 jours', value: a.change30d },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3 flex items-center justify-between"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <span className="text-xs text-white/40">{label}</span>
                <span className={`flex items-center gap-0.5 text-sm font-bold ${value >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {value >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                  {value >= 0 ? '+' : ''}{value.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-white/20 text-center">
            Analyse algorithmique — pas un conseil financier
          </p>
        </motion.div>
      )}
    </div>
  )
}
