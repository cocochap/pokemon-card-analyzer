'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Archive, CheckCircle2, Crown, Lock, Loader2,
  Package, TrendingUp, TrendingDown, Minus, Plus,
  ShoppingBag, X,
} from 'lucide-react'
import Link from 'next/link'
import { AnimatePresence } from 'framer-motion'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useUserTier } from '@/lib/useUserTier'

const VIOLET = '#A78BFA'
const VIOLET_BG = 'rgba(167,139,250,0.10)'
const VIOLET_BORDER = 'rgba(167,139,250,0.20)'
const GOLD = '#FFCB05'

const TYPE_LABELS: Record<string, string> = {
  BOOSTER_BOX: 'Display', ETB: 'ETB', COFFRET: 'Coffret',
  COLLECTION: 'Collection', BLISTER: 'Blister', TIN: 'Tin', BUNDLE: 'Bundle',
}

const TREND_CONFIG = {
  BULLISH: { icon: TrendingUp, color: '#22C55E', label: 'Haussier' },
  BEARISH: { icon: TrendingDown, color: '#EF4444', label: 'Baissier' },
  STABLE:  { icon: Minus, color: '#94A3B8', label: 'Stable' },
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#22C55E' : score >= 60 ? '#FFCB05' : '#F59E0B'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }} />
      </div>
      <span className="text-xs font-bold font-mono w-7 text-right" style={{ color }}>{score}</span>
    </div>
  )
}

function AddToSealedPortfolioModal({ product, onClose }: { product: any; onClose: () => void }) {
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const qc = useQueryClient()
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(product.retailPrice?.toString() ?? '')
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

  if (!isSignedIn) {
    openSignIn()
    onClose()
    return null
  }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: '#0B1122', border: '1px solid rgba(255,203,5,0.2)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">{product.nameFr ?? product.name}</h3>
            <p className="text-xs text-white/40">{TYPE_LABELS[product.type] ?? product.type}</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-green-400" />
            <p className="font-semibold text-white">Ajouté à votre collection !</p>
          </div>
        ) : (
          <>
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
                  <input type="number" min="0" step="0.01" value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
                </div>
              </div>
            </div>
            <button onClick={() => mutate()} disabled={isPending}
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
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
  const trend = TREND_CONFIG[product.trendDirection as keyof typeof TREND_CONFIG] ?? TREND_CONFIG.STABLE
  const TrendIcon = trend.icon
  const isDiscontinued = product.isDiscontinued
  const marketPrice = product.currentMarketPrice ?? product.retailPrice
  const ratio = product.retailPrice && marketPrice ? (marketPrice / product.retailPrice) : null

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: rank * 0.06 }}
        className="glass-card p-4 flex flex-col gap-3 hover:brightness-105 transition-all"
        style={{ border: rank === 0 ? '1px solid rgba(255,203,5,0.2)' : undefined }}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
            {product.imageUrl
              /* eslint-disable-next-line @next/next/no-img-element */
              ? <img src={product.imageUrl} alt="" className="w-8 h-8 object-contain" />
              : <ShoppingBag className="w-5 h-5 text-white/30" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              {rank === 0 && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(255,203,5,0.15)', color: GOLD, border: '1px solid rgba(255,203,5,0.3)' }}>
                  ★ TOP
                </span>
              )}
              {isDiscontinued && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.25)' }}>
                  Discontinué
                </span>
              )}
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white/40"
                style={{ background: 'rgba(255,255,255,0.05)' }}>
                {TYPE_LABELS[product.type] ?? product.type}
              </span>
            </div>
            <p className="font-semibold text-white text-sm mt-1 leading-tight">{product.nameFr ?? product.name}</p>
            {product.setName && <p className="text-xs text-white/35 mt-0.5">{product.setName} {product.language !== 'FR' ? `· ${product.language}` : ''}</p>}
          </div>
        </div>

        {/* Score */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-white/40">Score investissement</span>
            <div className="flex items-center gap-1">
              <TrendIcon className="w-3 h-3" style={{ color: trend.color }} />
              <span className="text-[10px] font-semibold" style={{ color: trend.color }}>{trend.label}</span>
            </div>
          </div>
          <ScoreBar score={Math.round(product.investmentScore ?? 0)} />
        </div>

        {/* Prices */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl p-2.5 text-center"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-[9px] text-white/30 mb-0.5">Retail</p>
            <p className="text-sm font-bold font-mono text-white/70">
              {product.retailPrice ? `€${product.retailPrice}` : '—'}
            </p>
          </div>
          <div className="rounded-xl p-2.5 text-center"
            style={{ background: 'rgba(255,203,5,0.05)', border: '1px solid rgba(255,203,5,0.15)' }}>
            <p className="text-[9px] text-white/30 mb-0.5">Marché</p>
            <p className="text-sm font-bold font-mono" style={{ color: GOLD }}>
              {marketPrice ? `€${Math.round(marketPrice)}` : 'N/A'}
            </p>
          </div>
        </div>

        {ratio && ratio > 1 && (
          <div className="flex items-center gap-1.5 text-[10px] text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span className="font-semibold">+{((ratio - 1) * 100).toFixed(0)}% vs retail</span>
            {product.horizon && <span className="text-white/30 ml-auto">{product.horizon}</span>}
          </div>
        )}

        {/* Narrative */}
        {product.narrative && (
          <p className="text-[10px] text-white/45 leading-relaxed line-clamp-2 italic">{product.narrative}</p>
        )}

        {/* Signals */}
        {product.bullish?.length > 0 && (
          <div className="space-y-1">
            {product.bullish.slice(0, 2).map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-1.5 text-[10px] text-green-400">
                <span className="font-bold mt-0.5 flex-shrink-0">↑</span>
                <span className="text-white/60">{s}</span>
              </div>
            ))}
          </div>
        )}

        {/* CTA */}
        <button onClick={() => setAddOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
          style={{ background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.2)', color: GOLD }}>
          <Plus className="w-3.5 h-3.5" />
          Ajouter à ma collection
        </button>
      </motion.div>

      <AnimatePresence>
        {addOpen && <AddToSealedPortfolioModal product={product} onClose={() => setAddOpen(false)} />}
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
        <p className="font-bold text-white mb-1">Picks coffrets réservés Elite</p>
        <p className="text-sm text-white/45 max-w-xs mx-auto">
          Accédez aux recommandations IA sur les coffrets scellés, l'analyse ROI et le suivi de votre collection.
        </p>
      </div>
      <Link href="/pricing"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold"
        style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
        <Crown className="w-4 h-4" />
        Passer Elite — 15€/mois
      </Link>
    </div>
  )
}

export function SealedPicksSection() {
  const { isSignedIn } = useAuth()
  const { isPremium } = useUserTier()

  const { data, isLoading } = useQuery({
    queryKey: ['sealed-picks'],
    queryFn: () => fetch('/api/sealed/picks').then(r => r.json()),
    enabled: isSignedIn && isPremium,
    staleTime: 5 * 60_000,
    retry: false,
  })

  const products: any[] = data?.products ?? data?.picks?.map((p: any) => p.product) ?? []

  return (
    <div className="space-y-5">
      {/* Section header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
          <Archive className="w-5 h-5" style={{ color: VIOLET }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-white">Coffrets Scellés</h2>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
              ELITE
            </span>
          </div>
          <p className="text-xs text-white/40">Meilleurs investissements en coffrets scellés du moment</p>
        </div>
      </div>

      {!isSignedIn || !isPremium ? (
        <EliteGate />
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(null).map((_, i) => (
            <div key={i} className="skeleton h-64 rounded-2xl" />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="glass-card p-8 text-center text-white/40 text-sm">
          <Package className="w-8 h-8 mx-auto mb-3 opacity-30" />
          Données en cours de chargement…
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {products.map((product: any, i: number) => (
            <SealedCard key={product.id ?? product.slug} product={product} rank={i} />
          ))}
        </div>
      )}
    </div>
  )
}
