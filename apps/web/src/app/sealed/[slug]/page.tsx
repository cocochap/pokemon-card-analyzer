'use client'

import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  Archive, ArrowLeft, BarChart2, CheckCircle2, Loader2, Package,
  Plus, Sparkles, Target, TrendingDown, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useAuth, useClerk } from '@clerk/nextjs'
import { AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const GOLD = '#FFCB05'
const VIOLET = '#A78BFA'
const VIOLET_BG = 'rgba(167,139,250,0.10)'
const VIOLET_BORDER = 'rgba(167,139,250,0.20)'

const TREND_COLOR: Record<string, string> = { BULLISH: '#22C55E', BEARISH: '#EF4444', STABLE: '#94A3B8' }
const TREND_LABEL: Record<string, string> = { BULLISH: 'Haussier', BEARISH: 'Baissier', STABLE: 'Stable' }

function AddModal({ product, onClose }: { product: any; onClose: () => void }) {
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const qc = useQueryClient()
  const [qty, setQty] = useState(1)
  const [price, setPrice] = useState(product.currentMarketPrice?.toString() ?? '')
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sealed-portfolio'] }); setSuccess(true); setTimeout(onClose, 1400) },
  })

  if (!isSignedIn) { openSignIn(); onClose(); return null }

  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <motion.div initial={{ scale: 0.95, y: 12 }} animate={{ scale: 1, y: 0 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-sm rounded-2xl p-6 space-y-5"
        style={{ background: '#0B1122', border: '1px solid rgba(255,203,5,0.2)' }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-white">{product.nameFr ?? product.name}</h3>
            <p className="text-xs text-white/40 mt-0.5">Prix marché : €{Math.round(product.currentMarketPrice ?? 0)}</p>
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
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>−</button>
                  <span className="text-xl font-bold text-white w-8 text-center">{qty}</span>
                  <button onClick={() => setQty(q => q + 1)} className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>+</button>
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
              className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:brightness-110"
              style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)', color: GOLD }}>
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Package className="w-4 h-4" />Ajouter à ma collection</>}
            </button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

export default function SealedProductPage() {
  const { slug } = useParams<{ slug: string }>()
  const [addOpen, setAddOpen] = useState(false)

  const { data: product, isLoading, isError } = useQuery({
    queryKey: ['sealed-product', slug],
    queryFn: () => fetch(`/api/sealed/${slug}`).then(r => r.json()),
    staleTime: 5 * 60_000,
  })

  if (isLoading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-8 h-8 animate-spin text-white/30" />
    </div>
  )

  if (isError || product?.error) return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
      <p className="text-white/50">Coffret introuvable</p>
      <Link href="/sealed" className="text-pokemon-yellow text-sm">← Retour aux coffrets</Link>
    </div>
  )

  const marketPrice = product.currentMarketPrice ?? product.retailPrice ?? 0
  const retailPrice = product.retailPrice ?? 0
  const roi = retailPrice > 0 && marketPrice ? Math.round(((marketPrice - retailPrice) / retailPrice) * 100) : null
  const score = Math.round(product.investmentScore ?? 0)
  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#FFCB05' : '#F59E0B'
  const trend = product.trendDirection ?? 'STABLE'

  // Price history for mini chart
  const history: any[] = product.priceHistory ?? []

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-5xl">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm">
          <Link href="/sealed" className="text-white/40 hover:text-white/70 flex items-center gap-1">
            <ArrowLeft className="w-3.5 h-3.5" />Coffrets scellés
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white/60 truncate">{product.nameFr ?? product.name}</span>
        </div>

        <div className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">

          {/* LEFT — main info */}
          <div className="space-y-5">
            {/* Hero card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="glass-card p-6 space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center flex-shrink-0 text-3xl"
                  style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.20)' }}>
                  {product.imageUrl
                    /* eslint-disable-next-line @next/next/no-img-element */
                    ? <img src={product.imageUrl} alt="" className="w-12 h-12 object-contain" />
                    : '📦'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {product.isDiscontinued && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}>
                        Discontinué
                      </span>
                    )}
                    {product.language && product.language !== 'FR' && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: VIOLET_BG, color: VIOLET, border: `1px solid ${VIOLET_BORDER}` }}>
                        {product.language}
                      </span>
                    )}
                    <span className="text-xs text-white/35">{product.type?.replace('_', ' ')}</span>
                  </div>
                  <h1 className="text-2xl font-bold text-white">{product.nameFr ?? product.name}</h1>
                  <p className="text-sm text-white/40 mt-0.5">{[product.setName, product.series].filter(Boolean).join(' · ')}</p>
                </div>
              </div>

              {/* Score */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/40">Score investissement</span>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-semibold" style={{ color: TREND_COLOR[trend] }}>{TREND_LABEL[trend]}</span>
                    <span className="text-base font-bold font-mono" style={{ color: scoreColor }}>{score}/100</span>
                  </div>
                </div>
                <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div className="h-full rounded-full" style={{ background: scoreColor }}
                    initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
                </div>
              </div>

              {/* 3 price boxes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  <p className="text-xs text-white/30 mb-1">Retail de sortie</p>
                  <p className="text-2xl font-bold font-mono text-white/60">€{retailPrice}</p>
                  {product.releaseDate && (
                    <p className="text-[10px] text-white/20 mt-0.5">{new Date(product.releaseDate).getFullYear()}</p>
                  )}
                </div>
                <div className="rounded-xl p-4 text-center"
                  style={{ background: 'rgba(255,203,5,0.07)', border: '1px solid rgba(255,203,5,0.22)' }}>
                  <p className="text-xs text-white/30 mb-1">Prix marché actuel</p>
                  <p className="text-2xl font-bold font-mono" style={{ color: GOLD }}>€{Math.round(marketPrice)}</p>
                </div>
                <div className="rounded-xl p-4 text-center"
                  style={{
                    background: roi && roi > 0 ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)',
                    border: roi && roi > 0 ? '1px solid rgba(34,197,94,0.22)' : '1px solid rgba(255,255,255,0.07)',
                  }}>
                  <p className="text-xs text-white/30 mb-1">ROI vs retail</p>
                  <p className="text-2xl font-bold font-mono"
                    style={{ color: roi && roi > 0 ? '#22C55E' : 'rgba(255,255,255,0.35)' }}>
                    {roi !== null ? `+${roi}%` : '—'}
                  </p>
                </div>
              </div>

              {/* Horizon + tirage */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <Target className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-[10px] text-white/30">Horizon recommandé</p>
                    <p className="text-sm font-semibold text-white">{product.horizon ?? '—'}</p>
                  </div>
                </div>
                <div className="rounded-xl p-3 flex items-center gap-2"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <BarChart2 className="w-4 h-4 text-white/30" />
                  <div>
                    <p className="text-[10px] text-white/30">Risque</p>
                    <p className="text-sm font-semibold"
                      style={{ color: product.riskLevel === 'Faible' ? '#22C55E' : product.riskLevel === 'Modéré' ? '#F59E0B' : '#EF4444' }}>
                      {product.riskLevel ?? '—'}
                    </p>
                  </div>
                </div>
              </div>

              {product.description && (
                <div className="flex items-start gap-2 text-xs text-white/35">
                  <BarChart2 className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <span>{product.description}</span>
                </div>
              )}
            </motion.div>

            {/* Verdict Expert */}
            {product.narrative && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="glass-card p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" style={{ color: VIOLET }} />
                  <h3 className="font-semibold text-white">Verdict Expert</h3>
                </div>
                <p className="text-sm text-white/75 leading-relaxed">{product.narrative}</p>
              </motion.div>
            )}

            {/* Signals */}
            {((product.bullish?.length ?? 0) + (product.bearish?.length ?? 0)) > 0 && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="glass-card p-5 space-y-2">
                <h3 className="font-semibold text-white text-sm mb-3">Signaux</h3>
                {product.bullish?.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <TrendingUp className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    <span className="text-white/70">{s}</span>
                  </div>
                ))}
                {product.bearish?.map((s: string, i: number) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm">
                    <TrendingDown className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <span className="text-white/70">{s}</span>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Price history mini */}
            {history.length > 1 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}
                className="glass-card p-5">
                <h3 className="font-semibold text-white text-sm mb-4">Historique des prix</h3>
                <div className="flex items-end gap-1 h-16">
                  {history.slice(-20).map((h, i) => {
                    const max = Math.max(...history.slice(-20).map((x: any) => x.price))
                    const pct = max > 0 ? (h.price / max) * 100 : 50
                    return (
                      <div key={i} className="flex-1 rounded-sm transition-all"
                        style={{ height: `${pct}%`, background: 'rgba(255,203,5,0.3)', minHeight: 2 }} />
                    )
                  })}
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-white/25">
                  <span>€{Math.round(Math.min(...history.map((h: any) => h.price)))}</span>
                  <span>€{Math.round(Math.max(...history.map((h: any) => h.price)))}</span>
                </div>
              </motion.div>
            )}
          </div>

          {/* RIGHT — actions + sub-info */}
          <div className="space-y-4 lg:sticky lg:top-24">

            {/* CTA */}
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
              className="glass-card p-5 space-y-3">
              <button onClick={() => setAddOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold transition-all hover:brightness-110"
                style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)', color: GOLD }}>
                <Plus className="w-4 h-4" />Ajouter à ma collection
              </button>
              <Link href="/sealed/scan"
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all hover:brightness-110 text-white/60 hover:text-white/80"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <Archive className="w-4 h-4" />Scanner un autre coffret
              </Link>
            </motion.div>

            {/* Scores breakdown */}
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
              className="glass-card p-4 space-y-3">
              <h3 className="text-sm font-semibold text-white">Scores</h3>
              {[
                { label: 'Investissement', value: product.investmentScore, color: scoreColor },
                { label: 'Scarcité',       value: product.scarcityScore,   color: '#FFCB05' },
                { label: 'Popularité',     value: product.popularityScore, color: '#A78BFA' },
              ].filter(s => s.value != null).map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-white/40">{label}</span>
                    <span className="text-xs font-bold font-mono" style={{ color }}>{Math.round(value)}</span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    <motion.div className="h-full rounded-full" style={{ background: color }}
                      initial={{ width: 0 }} animate={{ width: `${Math.round(value)}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }} />
                  </div>
                </div>
              ))}
            </motion.div>

            {/* Similar products teaser */}
            <motion.div initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
              <Link href="/sealed"
                className="glass-card p-4 flex items-center gap-3 hover:brightness-105 transition-all block">
                <Archive className="w-5 h-5" style={{ color: VIOLET }} />
                <div>
                  <p className="font-semibold text-white text-sm">Voir tous les coffrets</p>
                  <p className="text-xs text-white/40">54 coffrets analysés</p>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </main>
      <Footer />

      <AnimatePresence>
        {addOpen && product.id && <AddModal product={product} onClose={() => setAddOpen(false)} />}
      </AnimatePresence>
    </div>
  )
}
