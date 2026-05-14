'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive, AlertTriangle, CheckCircle2, Database, Loader2,
  Package, Plus, RotateCcw, Search, ScanLine, Sparkles,
  TrendingUp, TrendingDown, Target, X,
} from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useAuth } from '@clerk/nextjs'
import { useUserTier } from '@/lib/useUserTier'

const VIOLET = '#A78BFA'
const VIOLET_BG = 'rgba(167,139,250,0.10)'
const VIOLET_BORDER = 'rgba(167,139,250,0.20)'
const GOLD = '#FFCB05'

const TREND_LABEL: Record<string, string> = { BULLISH: 'Haussier', BEARISH: 'Baissier', STABLE: 'Stable' }
const TREND_COLOR: Record<string, string> = { BULLISH: '#22C55E', BEARISH: '#EF4444', STABLE: '#94A3B8' }

const EXAMPLES = [
  'Display Évolutions Prismatiques', 'ETB 151', 'Coffret Dracaufeu ex 151',
  'Display Couronne Zénith', 'Display Base Set FR', 'ETB Célébrations 25 ans',
  'Tin Pikachu VMAX', 'Display VMAX Climax JP',
]

function ProductResult({ data, onReset, onAddToDb, addingToDb, addedToDb }: {
  data: any; onReset: () => void; onAddToDb: () => void
  addingToDb: boolean; addedToDb: boolean
}) {
  const { isPremium } = useUserTier()
  const p = data.product
  const marketPrice = p.currentMarketPrice ?? p.retailPrice ?? 0
  const retailPrice = p.retailPrice ?? 0
  const roi = retailPrice > 0 && marketPrice ? Math.round(((marketPrice - retailPrice) / retailPrice) * 100) : null
  const score = Math.round(p.investmentScore ?? 0)
  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#FFCB05' : '#F59E0B'
  const trend = p.trendDirection ?? 'STABLE'

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Found header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
          <CheckCircle2 className="w-4 h-4" />
          Coffret identifié
          {data.inDb && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}>
              Dans notre base
            </span>
          )}
        </div>
        <button onClick={onReset} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Product card */}
      <div className="glass-card p-5 space-y-4">
        {/* Name + type */}
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {p.isDiscontinued && (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}>
                Discontinué
              </span>
            )}
            <span className="text-[9px] px-2 py-0.5 rounded-full text-white/40"
              style={{ background: 'rgba(255,255,255,0.05)' }}>{p.type?.replace('_', ' ')}</span>
          </div>
          <h2 className="text-xl font-bold text-white">{p.nameFr ?? p.name}</h2>
          {p.setName && <p className="text-sm text-white/40 mt-0.5">{p.setName} · {p.series} · {p.language}</p>}
        </div>

        {/* Score */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-white/40">Score investissement</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: TREND_COLOR[trend] }}>
                {TREND_LABEL[trend]}
              </span>
              <span className="text-xs font-bold" style={{ color: scoreColor }}>{score}/100</span>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div className="h-full rounded-full" style={{ background: scoreColor }}
              initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
          </div>
        </div>

        {/* Prices — core info */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[9px] text-white/30 mb-1">Retail de sortie</p>
            <p className="text-lg font-bold font-mono text-white/60">€{retailPrice}</p>
          </div>
          <div className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(255,203,5,0.07)', border: '1px solid rgba(255,203,5,0.20)' }}>
            <p className="text-[9px] text-white/30 mb-1">Marché actuel</p>
            <p className="text-lg font-bold font-mono" style={{ color: GOLD }}>€{Math.round(marketPrice)}</p>
          </div>
          <div className="rounded-xl p-3 text-center"
            style={{
              background: roi && roi > 0 ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)',
              border: roi && roi > 0 ? '1px solid rgba(34,197,94,0.20)' : '1px solid rgba(255,255,255,0.07)',
            }}>
            <p className="text-[9px] text-white/30 mb-1">ROI vs retail</p>
            <p className="text-lg font-bold font-mono" style={{ color: roi && roi > 0 ? '#22C55E' : 'rgba(255,255,255,0.4)' }}>
              {roi !== null ? `+${roi}%` : '—'}
            </p>
          </div>
        </div>

        {/* Targets */}
        {(p.target1y || p.target3y) && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
            <div className="flex items-center gap-2">
              <Target className="w-3.5 h-3.5" style={{ color: VIOLET }} />
              <span className="text-xs font-semibold" style={{ color: VIOLET }}>Projections</span>
              <span className="ml-auto text-[10px] text-white/30">{p.horizon}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {p.target1y && (
                <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.15)' }}>
                  <p className="text-[9px] text-white/30">Cible 1 an</p>
                  <p className="text-sm font-bold font-mono text-green-400">€{p.target1y}</p>
                </div>
              )}
              {p.target3y && (
                <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(167,139,250,0.07)', border: `1px solid ${VIOLET_BORDER}` }}>
                  <p className="text-[9px] text-white/30">Cible 3 ans</p>
                  <p className="text-sm font-bold font-mono" style={{ color: VIOLET }}>€{p.target3y}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verdict */}
        {p.narrative && (
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: VIOLET }} />
              <span className="text-xs font-semibold" style={{ color: VIOLET }}>Verdict Expert</span>
            </div>
            <p className="text-xs text-white/70 leading-relaxed">{p.narrative}</p>
          </div>
        )}

        {/* Signals */}
        {p.bullish?.length > 0 && (
          <div className="space-y-1.5">
            {p.bullish.map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <TrendingUp className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-white/65">{s}</span>
              </div>
            ))}
            {p.bearish?.map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <TrendingDown className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />
                <span className="text-white/65">{s}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {data.inDb ? (
          <Link href={`/sealed/${data.slug}`}
            className="btn-primary flex-1 justify-center py-3 rounded-xl text-sm">
            <Archive className="w-4 h-4" />Voir la fiche complète
          </Link>
        ) : isPremium && !addedToDb ? (
          <button onClick={onAddToDb} disabled={addingToDb}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
            {addingToDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Database className="w-4 h-4" />Ajouter à la base de données</>}
          </button>
        ) : addedToDb ? (
          <div className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}>
            <CheckCircle2 className="w-4 h-4" />Ajouté à la base !
          </div>
        ) : null}
        <button onClick={onReset} className="btn-ghost px-4 py-3 rounded-xl">
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  )
}

export default function SealedScanPage() {
  const { isSignedIn } = useAuth()
  const { isPremium } = useUserTier()
  const [query, setQuery] = useState('')
  const [result, setResult] = useState<any>(null)
  const [addedToDb, setAddedToDb] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const { mutate: identify, isPending, isError } = useMutation({
    mutationFn: (name: string) =>
      fetch('/api/sealed/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(r => r.json()),
    onSuccess: (data) => { setResult(data); setAddedToDb(false) },
  })

  const { mutate: addToDb, isPending: addingToDb } = useMutation({
    mutationFn: () =>
      fetch('/api/sealed/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: query, addToDb: true }),
      }).then(r => r.json()),
    onSuccess: (data) => {
      setResult(data)
      setAddedToDb(true)
    },
  })

  const reset = () => { setResult(null); setQuery(''); setAddedToDb(false); inputRef.current?.focus() }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 max-w-2xl py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
            <ScanLine className="w-4 h-4" />Scanner un coffret scellé
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="text-3xl md:text-4xl font-bold text-white mb-3">
            Identifiez n'importe quel{' '}
            <span style={{ background: 'linear-gradient(135deg,#A78BFA,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              coffret scellé
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
            className="text-white/50 max-w-md mx-auto">
            Tapez le nom du coffret — notre IA l'identifie, donne son prix marché, son ROI et son analyse investissement.
            Même s'il n'est pas encore dans notre base.
          </motion.p>
        </div>

        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-5">

              {/* Search input */}
              <div className="rounded-2xl p-6 space-y-4"
                style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${VIOLET_BORDER}` }}>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && query.trim()) identify(query.trim()) }}
                    placeholder="Ex : Display Évolutions Prismatiques, ETB 151, Coffret Dracaufeu…"
                    className="w-full pl-12 pr-4 py-4 rounded-xl text-base text-white outline-none"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => query.trim() && identify(query.trim())}
                  disabled={isPending || !query.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm transition-all hover:brightness-110 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#A78BFA,#8B5CF6)', color: '#fff' }}>
                  {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ScanLine className="w-5 h-5" />Identifier ce coffret</>}
                </button>
              </div>

              {isError && (
                <div className="glass-card p-4 flex items-center gap-3 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  Erreur lors de l'identification. Réessayez.
                </div>
              )}

              {/* Examples */}
              <div>
                <p className="text-xs text-white/30 mb-2.5">Exemples :</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map(ex => (
                    <button key={ex} onClick={() => { setQuery(ex); identify(ex) }}
                      className="px-3 py-1.5 rounded-xl text-xs text-white/55 transition-all hover:text-white/80 hover:bg-white/5"
                      style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {/* Info */}
              <div className="glass-card p-4 flex items-start gap-3">
                <Package className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-white/45 leading-relaxed">
                  Notre système identifie automatiquement le type, la série, le set, les personnages et calcule le prix marché estimé.
                  {isPremium && ' En tant qu\'abonné, vous pouvez ajouter les nouveaux coffrets identifiés directement à notre base de données.'}
                </div>
              </div>

              <div className="text-center">
                <Link href="/sealed" className="text-sm text-white/30 hover:text-white/60 transition-colors">
                  ← Voir tous les coffrets
                </Link>
              </div>
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ProductResult
                data={result}
                onReset={reset}
                onAddToDb={() => addToDb()}
                addingToDb={addingToDb}
                addedToDb={addedToDb}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
