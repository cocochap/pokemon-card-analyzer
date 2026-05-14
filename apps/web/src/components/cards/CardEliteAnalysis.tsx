'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  AlertTriangle, ArrowUpRight, Crown, Lock, Sparkles,
  Target, TrendingDown, TrendingUp, Zap, Shield, Brain,
} from 'lucide-react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { useUserTier } from '@/lib/useUserTier'

const VIOLET = '#A78BFA'
const VIOLET_BG = 'rgba(167,139,250,0.10)'
const VIOLET_BORDER = 'rgba(167,139,250,0.20)'
const GOLD = '#FFCB05'

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

function ConvictionBadge({ c }: { c: string }) {
  const map: Record<string, { color: string; bg: string; border: string }> = {
    'FORTE':   { color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.25)' },
    'MODÉRÉE': { color: '#FFCB05', bg: 'rgba(255,203,5,0.10)',  border: 'rgba(255,203,5,0.25)' },
    'FAIBLE':  { color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.20)' },
  }
  const s = map[c] ?? map['MODÉRÉE']
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ background: s.bg, border: `1px solid ${s.border}`, color: s.color }}>
      Conviction {c}
    </span>
  )
}

function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
      <motion.div className="h-full rounded-full" style={{ background: color }}
        initial={{ width: 0 }} animate={{ width: `${Math.min(100, value)}%` }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.2 }} />
    </div>
  )
}

function MultBadge({ mult, label }: { mult: number; label: string }) {
  const color = mult >= 5 ? '#22C55E' : mult >= 2.5 ? '#FFCB05' : '#F59E0B'
  return (
    <div className="rounded-xl p-3 text-center space-y-1"
      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] text-white/35">{label}</p>
      <p className="text-lg font-bold font-mono" style={{ color }}>×{mult.toFixed(1)}</p>
      <p className="text-[9px] text-white/25">vs prix actuel</p>
    </div>
  )
}

function EliteGate() {
  return (
    <div className="relative overflow-hidden rounded-2xl">
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
          <div className="h-3 bg-white/10 rounded w-3/4" /><div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
        <div className="rounded-xl p-3 space-y-1.5">
          {[80, 60, 45].map(w => <div key={w} className="h-2 bg-white/8 rounded" style={{ width: `${w}%` }} />)}
        </div>
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4"
        style={{ background: 'rgba(7,11,27,0.75)', backdropFilter: 'blur(2px)' }}>
        <div className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
          <Lock className="w-5 h-5" style={{ color: VIOLET }} />
        </div>
        <div className="text-center px-6">
          <p className="font-bold text-white mb-1">Analyse Expert Elite</p>
          <p className="text-sm text-white/50 mb-4">
            Comparables réels, targets ambitieux, PSA potential, catalyseurs — analyse niveau hedge fund
          </p>
          <Link href="/pricing"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:brightness-110"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
            <Crown className="w-4 h-4" />Passer Elite — 15€/mois
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
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-2"
        style={{ borderBottom: `1px solid ${VIOLET_BORDER}` }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
            <Brain className="w-4 h-4" style={{ color: VIOLET }} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-white">Analyse Expert</h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>ELITE</span>
              {isElite && a && <ConvictionBadge c={a.conviction} />}
            </div>
            <p className="text-xs text-white/40">Niveau analyste professionnel TCG</p>
          </div>
        </div>
        {isElite && a && <RiskBadge level={a.riskLevel} />}
      </div>

      {!isElite ? <EliteGate /> : isLoading ? (
        <div className="p-8 flex flex-col items-center gap-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
            className="w-7 h-7 rounded-full border-2 border-t-transparent"
            style={{ borderColor: VIOLET, borderTopColor: 'transparent' }} />
          <p className="text-sm text-white/40">Analyse en cours…</p>
        </div>
      ) : isError || !a ? (
        <div className="p-6 text-center text-white/40 text-sm flex flex-col items-center gap-2">
          <AlertTriangle className="w-5 h-5" />Analyse non disponible
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-5 space-y-5">

          {/* Scores */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Score invest.', value: a.investmentScore, color: a.investmentScore >= 70 ? '#22C55E' : '#F59E0B' },
              { label: 'Rareté',        value: a.rarityScore,     color: VIOLET },
              { label: 'Scarcité',      value: a.scarcityScore,   color: GOLD },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl p-3 text-center space-y-1.5"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="text-[10px] text-white/40">{label}</div>
                <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
                <MiniBar value={value} color={color} />
              </div>
            ))}
          </div>

          {/* Tier badges */}
          <div className="flex gap-2 flex-wrap">
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{
                background: a.charTier === 'S' ? 'rgba(255,203,5,0.12)' : a.charTier === 'A' ? 'rgba(167,139,250,0.10)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${a.charTier === 'S' ? 'rgba(255,203,5,0.3)' : a.charTier === 'A' ? VIOLET_BORDER : 'rgba(255,255,255,0.10)'}`,
                color: a.charTier === 'S' ? GOLD : a.charTier === 'A' ? VIOLET : 'rgba(255,255,255,0.4)',
              }}>
              Personnage Tier {a.charTier}
            </span>
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.45)' }}>
              {a.era === 'vintage' ? '🏆 Vintage' : a.era === 'sv' ? '⚡ Écarlate & Violet' : a.era === 'swsh' ? '⚔️ Épée & Bouclier' : '📦 Moderne'}
            </span>
          </div>

          {/* Narrative */}
          <div className="rounded-xl p-4"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={{ color: VIOLET }} />
              <span className="text-xs font-semibold" style={{ color: VIOLET }}>Verdict Expert</span>
              <span className="ml-auto text-[10px] text-white/30">{a.horizon}</span>
            </div>
            <p className="text-xs text-white/80 leading-relaxed">{a.narrative}</p>
          </div>

          {/* Multi-year targets */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-4 h-4" style={{ color: VIOLET }} />
              <span className="text-sm font-semibold text-white">Projections de prix</span>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-2">
              <MultBadge mult={a.mult1y} label="1 an" />
              <MultBadge mult={a.mult3y} label="3 ans" />
              <MultBadge mult={a.mult5y} label="5 ans" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '1 an', value: a.target1y, color: '#22C55E' },
                { label: '3 ans', value: a.target3y, color: GOLD },
                { label: '5 ans', value: a.target5y, color: VIOLET },
              ].map(({ label, value, color }) => (
                <div key={label} className="rounded-xl p-2.5 text-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <p className="text-[9px] text-white/30 mb-0.5">Cible {label}</p>
                  <p className="text-sm font-bold font-mono" style={{ color }}>€{value.toLocaleString('fr-FR')}</p>
                </div>
              ))}
            </div>
            {a.athTarget && (
              <div className="mt-2 rounded-xl px-3 py-2 flex items-center justify-between"
                style={{ background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.15)' }}>
                <span className="text-[10px] text-white/40">Cible récupération ATH</span>
                <span className="text-sm font-bold font-mono text-green-400">€{a.athTarget.toLocaleString('fr-FR')}</span>
              </div>
            )}
          </div>

          {/* Comparables */}
          {a.comparables?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2.5">
                <ArrowUpRight className="w-4 h-4 text-green-400" />
                <span className="text-sm font-semibold text-white">Cartes similaires qui ont explosé</span>
              </div>
              <div className="space-y-2">
                {a.comparables.map((c: any, i: number) => (
                  <div key={i} className="rounded-xl px-3 py-2.5 flex items-center justify-between gap-3"
                    style={{ background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold text-white/80 truncate">{c.card}</p>
                      <p className="text-[10px] text-white/35">{c.from} → {c.to} · {c.timeframe}</p>
                    </div>
                    <span className="text-xs font-bold text-green-400 flex-shrink-0">{c.pct}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PSA Section */}
          {a.psa && (
            <div className="rounded-xl p-4 space-y-2"
              style={{
                background: a.psa.worthy ? 'rgba(255,203,5,0.06)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${a.psa.worthy ? 'rgba(255,203,5,0.18)' : 'rgba(255,255,255,0.07)'}`,
              }}>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="w-4 h-4" style={{ color: a.psa.worthy ? GOLD : 'rgba(255,255,255,0.3)' }} />
                <span className="text-xs font-semibold text-white">Potentiel PSA/BGS</span>
                {a.psa.worthy && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full ml-auto"
                    style={{ background: 'rgba(255,203,5,0.15)', color: GOLD, border: '1px solid rgba(255,203,5,0.3)' }}>
                    Grading recommandé
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-white/40">PSA 10 estimé</span>
                <span className="text-sm font-bold font-mono" style={{ color: a.psa.worthy ? GOLD : 'rgba(255,255,255,0.3)' }}>
                  ~€{a.psa.estimatedPsa10.toLocaleString('fr-FR')} (×{a.psa.multiplier})
                </span>
              </div>
              <p className="text-[10px] text-white/35">{a.psa.popEstimate}</p>
              <p className="text-[11px] text-white/60 leading-relaxed">{a.psa.recommendation}</p>
            </div>
          )}

          {/* Catalysts */}
          {a.catalysts?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <span className="text-sm font-semibold text-white">Catalyseurs de hausse</span>
              </div>
              <div className="space-y-1.5">
                {a.catalysts.map((cat: string, i: number) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="text-amber-400 mt-0.5 flex-shrink-0">◆</span>
                    <span className="text-white/65 leading-relaxed">{cat}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signals */}
          <div className="space-y-1.5">
            {a.bullish?.map((sig: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <TrendingUp className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-green-400" />
                <span className="text-white/70">{sig}</span>
              </div>
            ))}
            {a.bearish?.map((sig: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <TrendingDown className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" />
                <span className="text-white/70">{sig}</span>
              </div>
            ))}
          </div>

          {/* ATH + RSI */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl p-3 space-y-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] text-white/40">Distance ATH</div>
              <div className={`text-base font-bold font-mono ${a.athDropPct > 0 ? 'text-green-400' : 'text-white/50'}`}>
                {a.athDropPct > 0 ? `-${a.athDropPct}%` : 'Au sommet'}
              </div>
              <div className="text-[10px] text-white/25">ATH : €{a.ath?.toFixed(2)}</div>
            </div>
            <div className="rounded-xl p-3 space-y-1"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="text-[10px] text-white/40">RSI 14</div>
              <div className="text-base font-bold font-mono"
                style={{ color: a.rsi === null ? 'rgba(255,255,255,0.25)' : a.rsi < 35 ? '#22C55E' : a.rsi > 65 ? '#EF4444' : GOLD }}>
                {a.rsi !== null ? a.rsi.toFixed(0) : '—'}
              </div>
              <div className="text-[10px] text-white/25">
                {a.rsi === null ? 'Données insuffisantes' : a.rsi < 35 ? 'Survendu' : a.rsi > 65 ? 'Suracheté' : 'Neutre'}
              </div>
            </div>
          </div>

          <p className="text-[10px] text-white/20 text-center">
            Analyse algorithmique basée sur données historiques TCG — pas un conseil financier
          </p>
        </motion.div>
      )}
    </div>
  )
}
