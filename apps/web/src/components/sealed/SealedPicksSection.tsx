'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Archive, CheckCircle2, Crown, Lock, Loader2,
  Package, Plus, ShoppingBag, TrendingUp, TrendingDown,
  Minus, X, Target, Sparkles, BarChart2, Filter,
} from 'lucide-react'
import Link from 'next/link'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useUserTier } from '@/lib/useUserTier'

const VIOLET = '#A78BFA'
const VIOLET_BG = 'rgba(167,139,250,0.10)'
const VIOLET_BORDER = 'rgba(167,139,250,0.20)'
const GOLD = '#FFCB05'

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  BOOSTER_BOX: { label: 'Display', emoji: '📦' },
  ETB:         { label: 'ETB', emoji: '🎁' },
  COFFRET:     { label: 'Coffret', emoji: '🎴' },
  COLLECTION:  { label: 'Collection', emoji: '⭐' },
  BLISTER:     { label: 'Blister', emoji: '📋' },
  TIN:         { label: 'Tin', emoji: '🥫' },
  BUNDLE:      { label: 'Bundle', emoji: '🎯' },
}

const TREND_CONFIG = {
  BULLISH: { icon: TrendingUp,   color: '#22C55E', label: 'Haussier', bg: 'rgba(34,197,94,0.10)', border: 'rgba(34,197,94,0.25)' },
  BEARISH: { icon: TrendingDown, color: '#EF4444', label: 'Baissier', bg: 'rgba(239,68,68,0.10)', border: 'rgba(239,68,68,0.25)' },
  STABLE:  { icon: Minus,        color: '#94A3B8', label: 'Stable',   bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.20)' },
}

function ScoreBar({ score, color }: { score: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div className="h-full rounded-full" style={{ background: color }}
          initial={{ width: 0 }} animate={{ width: `${Math.min(100, score)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
      <span className="text-xs font-bold font-mono w-7 text-right" style={{ color }}>{score}</span>
    </div>
  )
}

function AddModal({ product, onClose }: { product: any; onClose: () => void }) {
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const qc = useQueryClient()
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(product.currentMarketPrice?.toString() ?? product.retailPrice?.toString() ?? '')
  const [success, setSuccess] = useState(false)

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/sealed/portfolio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId: product.id, quantity: qty, purchasePrice: price ? parseFloat(price) : null }),
      })
      if (!res.ok) throw new Error('Erreur')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sealed-portfolio'] })
      setSuccess(true)
      setTimeout(onClose, 1400)
    },
  })

  if (!isSignedIn) { openSignIn(); onClose(); return null }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: '#0B1122', border: '1px solid rgba(255,203,5,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-white text-sm leading-tight">{product.nameFr ?? product.name}</h3>
            <p className="text-xs text-white/40 mt-0.5">{TYPE_LABELS[product.type]?.label ?? product.type} · {product.setName}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 flex-shrink-0"><X className="w-4 h-4" /></button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
            <p className="font-semibold text-white">Ajouté à votre collection !</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Retail</span>
                <span className="font-mono text-white/70">€{product.retailPrice}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-white/40">Marché actuel</span>
                <span className="font-mono font-bold text-pokemon-yellow">€{product.currentMarketPrice ?? '—'}</span>
              </div>
              {product.currentMarketPrice && product.retailPrice && (
                <div className="flex justify-between text-xs">
                  <span className="text-white/40">ROI vs retail</span>
                  <span className="font-bold text-green-400">
                    +{(((product.currentMarketPrice - product.retailPrice) / product.retailPrice) * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Quantité</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))}
                    className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>−</button>
                  <span className="text-xl font-bold text-white w-8 text-center">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)}
                    className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>+</button>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1.5 block">Prix d'achat (€)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">€</span>
                  <input type="number" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
              </div>
            </div>
            <button onClick={() => mutate()} disabled={isPending}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110"
              style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)', color: GOLD }}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Package className="w-4 h-4" />Ajouter à ma collection</>}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

function SealedCard({ product, rank }: { product: any; rank: number }) {
  const [addOpen, setAddOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const trend = TREND_CONFIG[(product.trendDirection as keyof typeof TREND_CONFIG) ?? 'STABLE']
  const TrendIcon = trend.icon
  const typeInfo = TYPE_LABELS[product.type] ?? { label: product.type, emoji: '📦' }
  const marketPrice = product.currentMarketPrice ?? product.retailPrice
  const retailPrice = product.retailPrice ?? 0
  const roiPct = retailPrice > 0 && marketPrice ? (((marketPrice - retailPrice) / retailPrice) * 100) : null
  const score = Math.round(product.investmentScore ?? 0)
  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#FFCB05' : '#F59E0B'

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: Math.min(rank * 0.04, 0.5) }}
        className="glass-card overflow-hidden"
        style={rank === 0 ? { border: '1px solid rgba(255,203,5,0.25)', boxShadow: '0 0 24px rgba(255,203,5,0.05)' } : {}}
      >
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
              {product.imageUrl
                /* eslint-disable-next-line @next/next/no-img-element */
                ? <img src={product.imageUrl} alt="" className="w-8 h-8 object-contain" />
                : typeInfo.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                {rank === 0 && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,203,5,0.15)', color: GOLD, border: '1px solid rgba(255,203,5,0.3)' }}>★ TOP</span>
                )}
                {product.isDiscontinued && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>Discontinué</span>
                )}
                <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/40"
                  style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {typeInfo.emoji} {typeInfo.label}
                </span>
                {product.language && product.language !== 'FR' && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(167,139,250,0.10)', color: VIOLET, border: `1px solid ${VIOLET_BORDER}` }}>
                    {product.language}
                  </span>
                )}
              </div>
              <p className="font-semibold text-white text-sm leading-tight">{product.nameFr ?? product.name}</p>
              {product.setName && <p className="text-[10px] text-white/35 mt-0.5">{product.setName}</p>}
            </div>
          </div>

          {/* Score + trend */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-white/40">Score investissement</span>
              <div className="flex items-center gap-1">
                <TrendIcon className="w-3 h-3" style={{ color: trend.color }} />
                <span className="text-[10px] font-semibold" style={{ color: trend.color }}>{trend.label}</span>
              </div>
            </div>
            <ScoreBar score={score} color={scoreColor} />
          </div>

          {/* Prices — the key info */}
          <div className="grid grid-cols-3 gap-1.5 mb-3">
            <div className="rounded-xl p-2 text-center"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-[9px] text-white/30 mb-0.5">Sortie retail</p>
              <p className="text-xs font-bold font-mono text-white/60">€{retailPrice}</p>
            </div>
            <div className="rounded-xl p-2 text-center"
              style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.18)' }}>
              <p className="text-[9px] text-white/30 mb-0.5">Marché actuel</p>
              <p className="text-xs font-bold font-mono" style={{ color: GOLD }}>
                {marketPrice ? `€${Math.round(marketPrice)}` : 'N/A'}
              </p>
            </div>
            <div className="rounded-xl p-2 text-center"
              style={{
                background: roiPct && roiPct > 0 ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${roiPct && roiPct > 0 ? 'rgba(34,197,94,0.18)' : 'rgba(255,255,255,0.06)'}`,
              }}>
              <p className="text-[9px] text-white/30 mb-0.5">ROI retail</p>
              <p className="text-xs font-bold font-mono"
                style={{ color: roiPct && roiPct > 0 ? '#22C55E' : 'rgba(255,255,255,0.4)' }}>
                {roiPct !== null ? `+${Math.round(roiPct)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Horizon */}
          {product.horizon && (
            <div className="flex items-center gap-1.5 mb-3">
              <Target className="w-3 h-3 text-white/30" />
              <span className="text-[10px] text-white/45">Horizon recommandé : <span className="text-white/70 font-semibold">{product.horizon}</span></span>
            </div>
          )}

          {/* Print run estimate */}
          {product.description && (
            <div className="flex items-start gap-1.5 mb-3">
              <BarChart2 className="w-3 h-3 text-white/20 flex-shrink-0 mt-0.5" />
              <p className="text-[9px] text-white/30 leading-relaxed">{product.description}</p>
            </div>
          )}

          {/* Verdict (truncated) */}
          {product.narrative && (
            <div className="rounded-xl p-3 mb-3"
              style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Sparkles className="w-3 h-3 flex-shrink-0" style={{ color: VIOLET }} />
                <span className="text-[10px] font-semibold" style={{ color: VIOLET }}>Verdict Expert</span>
              </div>
              <p className={`text-[10px] text-white/75 leading-relaxed ${expanded ? '' : 'line-clamp-3'}`}>
                {product.narrative}
              </p>
              {product.narrative.length > 160 && (
                <button onClick={() => setExpanded(e => !e)}
                  className="text-[9px] mt-1" style={{ color: VIOLET }}>
                  {expanded ? 'Voir moins ↑' : 'Lire la suite ↓'}
                </button>
              )}
            </div>
          )}

          {/* Bullish signals */}
          {product.bullish?.length > 0 && (
            <div className="space-y-1 mb-3">
              {product.bullish.slice(0, 3).map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px]">
                  <TrendingUp className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/60">{s}</span>
                </div>
              ))}
              {product.bearish?.slice(0, 1).map((s: string, i: number) => (
                <div key={i} className="flex items-start gap-1.5 text-[10px]">
                  <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                  <span className="text-white/60">{s}</span>
                </div>
              ))}
            </div>
          )}

          {/* CTA */}
          <button onClick={() => setAddOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:brightness-110"
            style={{ background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.2)', color: GOLD }}>
            <Plus className="w-3.5 h-3.5" />
            Ajouter à ma collection
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {addOpen && <AddModal product={product} onClose={() => setAddOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function EliteGate() {
  return (
    <div className="glass-card p-8 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto"
        style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
        <Lock className="w-6 h-6" style={{ color: VIOLET }} />
      </div>
      <div>
        <p className="font-bold text-white mb-1">Analyse coffrets scellés — Réservé Elite</p>
        <p className="text-sm text-white/45 max-w-xs mx-auto">
          Accédez aux prix marché en temps réel, ROI vs retail, analyses expert et suivi de votre collection scellée.
        </p>
      </div>
      <Link href="/pricing"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold hover:brightness-110"
        style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
        <Crown className="w-4 h-4" />Passer Elite — 15€/mois
      </Link>
    </div>
  )
}

const FILTERS = [
  { key: 'all', label: 'Tous' },
  { key: 'BOOSTER_BOX', label: '📦 Displays' },
  { key: 'ETB', label: '🎁 ETB' },
  { key: 'COFFRET', label: '🎴 Coffrets' },
  { key: 'TIN', label: '🥫 Tins' },
  { key: 'COLLECTION', label: '⭐ Collections' },
  { key: 'BUNDLE', label: '🎯 Bundles' },
]

export function SealedPicksSection() {
  const { isSignedIn } = useAuth()
  const { isPremium } = useUserTier()
  const [typeFilter, setTypeFilter] = useState('all')
  const [showDiscontinued, setShowDiscontinued] = useState<'all' | 'true' | 'false'>('all')

  const { data, isLoading } = useQuery({
    queryKey: ['sealed-list', typeFilter, showDiscontinued],
    queryFn: () => {
      const params = new URLSearchParams({ sort: 'score' })
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (showDiscontinued !== 'all') params.set('discontinued', showDiscontinued)
      return fetch(`/api/sealed?${params}`).then(r => r.json())
    },
    enabled: isSignedIn && isPremium,
    staleTime: 5 * 60_000,
  })

  const products: any[] = Array.isArray(data) ? data : []

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
          <Archive className="w-5 h-5" style={{ color: VIOLET }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="font-bold text-white">Coffrets Scellés</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>ELITE</span>
            {isPremium && <span className="text-xs text-white/30">{products.length} coffrets analysés</span>}
          </div>
          <p className="text-xs text-white/40">Prix marché, ROI, tirage estimé — expertise investissement scellé</p>
        </div>
      </div>

      {!isSignedIn || !isPremium ? (
        <EliteGate />
      ) : (
        <>
          {/* Filters */}
          <div className="space-y-2">
            <div className="flex gap-1.5 flex-wrap">
              {FILTERS.map(f => (
                <button key={f.key} onClick={() => setTypeFilter(f.key)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                  style={typeFilter === f.key
                    ? { background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }
                    : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {([['all', 'Tous'], ['true', 'Discontinués ✓'], ['false', 'Disponibles']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setShowDiscontinued(val)}
                  className="px-3 py-1 rounded-xl text-[10px] font-medium transition-all"
                  style={showDiscontinued === val
                    ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }
                    : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array(6).fill(null).map((_, i) => <div key={i} className="skeleton h-80 rounded-2xl" />)}
            </div>
          ) : products.length === 0 ? (
            <div className="glass-card p-8 text-center text-white/40 text-sm flex flex-col items-center gap-2">
              <Package className="w-8 h-8 opacity-30" />
              Aucun coffret dans cette catégorie
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product: any, i: number) => (
                <SealedCard key={product.id} product={product} rank={i} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
