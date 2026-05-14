'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Archive, AlertTriangle, Camera, CheckCircle2, Database, ImageUp,
  Loader2, Lock, Package, Plus, RotateCcw, Search, ScanLine,
  Sparkles, TrendingUp, TrendingDown, Target, X, Zap,
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

// ── Scan beam overlay ─────────────────────────────────────────────────────────
function ScanOverlay() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-10">
      <div className="absolute inset-0 bg-violet-950/20" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`h${i}`} className="absolute left-0 right-0 border-t border-violet-400/10" style={{ top: `${25 * (i + 1)}%` }} />
      ))}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-violet-400/10" style={{ left: `${33 * (i + 1)}%` }} />
      ))}
      <motion.div
        className="absolute left-0 right-0 h-1"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(167,139,250,0.8) 30%, rgba(200,180,255,1) 50%, rgba(167,139,250,0.8) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(167,139,250,0.8)',
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 2, ease: 'linear', repeat: Infinity }}
      />
      {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2',
        'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-violet-400 rounded-sm ${cls}`} />
      ))}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-sm"
        style={{ background: 'rgba(139,92,246,0.8)', border: '1px solid rgba(167,139,250,0.4)', color: '#fff' }}>
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-white" />
        Identification IA...
      </div>
    </div>
  )
}

// ── Result panel ──────────────────────────────────────────────────────────────
function ProductResult({ data, preview, onReset, onAddToDb, addingToDb, addedToDb }: {
  data: any; preview?: string | null; onReset: () => void
  onAddToDb: () => void; addingToDb: boolean; addedToDb: boolean
}) {
  const { isPremium } = useUserTier()
  const p = data.product
  const marketPrice = p.currentMarketPrice ?? p.retailPrice ?? 0
  const retailPrice = p.retailPrice ?? 0
  const roi = retailPrice > 0 && marketPrice ? Math.round(((marketPrice - retailPrice) / retailPrice) * 100) : null
  const score = Math.round(p.investmentScore ?? 0)
  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#FFCB05' : '#F59E0B'
  const trend = p.trendDirection ?? 'STABLE'
  const confidence = data.identification?.confidence

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <span className="text-sm font-semibold text-green-400">Coffret identifié</span>
          {confidence && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.20)', color: '#22C55E' }}>
              {Math.round(confidence * 100)}% confiance
            </span>
          )}
          {data.inDb && (
            <span className="text-[10px] px-2 py-0.5 rounded-full"
              style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
              Dans notre base
            </span>
          )}
        </div>
        <button onClick={onReset} className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Preview + info */}
      <div className="glass-card p-5 space-y-4">
        {preview && (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(167,139,250,0.2)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="coffret" className="w-full object-contain max-h-48" />
          </div>
        )}

        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {p.isDiscontinued && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}>
                Discontinué
              </span>
            )}
            <span className="text-[9px] px-1.5 py-0.5 rounded-full text-white/40"
              style={{ background: 'rgba(255,255,255,0.05)' }}>{p.type?.replace('_', ' ')}</span>
            {p.language && p.language !== 'FR' && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                style={{ background: VIOLET_BG, color: VIOLET, border: `1px solid ${VIOLET_BORDER}` }}>{p.language}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{p.nameFr ?? p.name}</h2>
          {p.setName && <p className="text-sm text-white/40 mt-0.5">{[p.setName, p.series].filter(Boolean).join(' · ')}</p>}
        </div>

        {/* Score */}
        <div>
          <div className="flex justify-between mb-1.5">
            <span className="text-xs text-white/40">Score investissement</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold" style={{ color: TREND_COLOR[trend] }}>{TREND_LABEL[trend]}</span>
              <span className="text-xs font-bold font-mono" style={{ color: scoreColor }}>{score}/100</span>
            </div>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div className="h-full rounded-full" style={{ background: scoreColor }}
              initial={{ width: 0 }} animate={{ width: `${score}%` }} transition={{ duration: 0.8 }} />
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[9px] text-white/30 mb-1">Retail</p>
            <p className="text-base font-bold font-mono text-white/60">€{retailPrice}</p>
          </div>
          <div className="rounded-xl p-3 text-center" style={{ background: 'rgba(255,203,5,0.07)', border: '1px solid rgba(255,203,5,0.20)' }}>
            <p className="text-[9px] text-white/30 mb-1">Marché actuel</p>
            <p className="text-base font-bold font-mono" style={{ color: GOLD }}>€{Math.round(marketPrice)}</p>
          </div>
          <div className="rounded-xl p-3 text-center"
            style={{ background: roi && roi > 0 ? 'rgba(34,197,94,0.07)' : 'rgba(255,255,255,0.04)', border: roi && roi > 0 ? '1px solid rgba(34,197,94,0.20)' : '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-[9px] text-white/30 mb-1">ROI retail</p>
            <p className="text-base font-bold font-mono" style={{ color: roi && roi > 0 ? '#22C55E' : 'rgba(255,255,255,0.4)' }}>
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
                  <p className="text-[9px] text-white/30">1 an</p>
                  <p className="text-sm font-bold font-mono text-green-400">€{p.target1y}</p>
                </div>
              )}
              {p.target3y && (
                <div className="rounded-lg p-2 text-center" style={{ background: 'rgba(167,139,250,0.07)', border: `1px solid ${VIOLET_BORDER}` }}>
                  <p className="text-[9px] text-white/30">3 ans</p>
                  <p className="text-sm font-bold font-mono" style={{ color: VIOLET }}>€{p.target3y}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Verdict */}
        {p.narrative && (
          <div className="space-y-1.5">
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
            {p.bullish.slice(0, 3).map((s: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-[11px]">
                <TrendingUp className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />
                <span className="text-white/65">{s}</span>
              </div>
            ))}
            {p.bearish?.slice(0, 1).map((s: string, i: number) => (
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
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold hover:brightness-110"
            style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}>
            {addingToDb ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Database className="w-4 h-4" />Ajouter à la base</>}
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SealedScanPage() {
  const { isSignedIn } = useAuth()
  const { isPremium } = useUserTier()
  const qc = useQueryClient()

  const [mode, setMode] = useState<'text' | 'photo'>('text')
  const [query, setQuery] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [fileObj, setFileObj] = useState<File | null>(null)
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState('')
  const [addedToDb, setAddedToDb] = useState(false)

  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const inputRef  = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setFileObj(file)
    setPreview(URL.createObjectURL(file))
    setError('')
    setResult(null)
  }, [])

  // Text identification
  const { mutate: identifyText, isPending: textPending } = useMutation({
    mutationFn: (name: string) =>
      fetch('/api/sealed/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(r => r.json()),
    onSuccess: (data) => { setResult(data); setAddedToDb(false); setError('') },
    onError: () => setError('Erreur lors de l\'identification'),
  })

  // Photo scan
  const scanPhoto = async () => {
    if (!fileObj) return
    setScanning(true); setError('')
    try {
      const form = new FormData()
      form.append('image', fileObj)
      const res  = await fetch('/api/sealed/scan', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Scan échoué')
      setResult(data); setAddedToDb(false)
    } catch (e: any) {
      setError(e.message ?? 'Erreur inconnue')
    } finally {
      setScanning(false)
    }
  }

  // Add to DB
  const { mutate: addToDb, isPending: addingToDb } = useMutation({
    mutationFn: () =>
      fetch('/api/sealed/identify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: result?.identification?.name ?? query, addToDb: true }),
      }).then(r => r.json()),
    onSuccess: (data) => { setResult(data); setAddedToDb(true) },
  })

  const reset = () => {
    setResult(null); setError(''); setQuery(''); setPreview(null); setFileObj(null); setAddedToDb(false)
    if (fileRef.current) fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const isPending = textPending || scanning

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 max-w-2xl py-10">

        {/* Header */}
        <div className="text-center mb-8">
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
            Par nom ou par photo — notre IA identifie le coffret et génère son analyse investissement complète.
          </motion.p>
        </div>

        <AnimatePresence mode="wait">
          {result ? (
            <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ProductResult
                data={result} preview={mode === 'photo' ? preview : null}
                onReset={reset} onAddToDb={() => addToDb()}
                addingToDb={addingToDb} addedToDb={addedToDb}
              />
            </motion.div>
          ) : (
            <motion.div key="search" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="space-y-5">

              {/* Mode selector */}
              <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <button onClick={() => { setMode('text'); setError('') }}
                  className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                  style={mode === 'text'
                    ? { background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }
                    : { color: 'rgba(255,255,255,0.4)' }}>
                  <Search className="w-4 h-4" />Recherche par nom
                </button>
                {isPremium ? (
                  <button onClick={() => { setMode('photo'); setError('') }}
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={mode === 'photo'
                      ? { background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }
                      : { color: 'rgba(255,255,255,0.4)' }}>
                    <Camera className="w-4 h-4" />Photo / Scanner
                  </button>
                ) : (
                  <Link href="/pricing"
                    className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all"
                    style={{ color: 'rgba(255,255,255,0.30)', background: 'rgba(255,255,255,0.02)' }}>
                    <Lock className="w-4 h-4" />Photo — Premium
                  </Link>
                )}
              </div>

              {/* TEXT mode */}
              {mode === 'text' && (
                <div className="rounded-2xl p-6 space-y-4"
                  style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${VIOLET_BORDER}` }}>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                    <input
                      ref={inputRef}
                      type="text" value={query}
                      onChange={e => setQuery(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && query.trim()) identifyText(query.trim()) }}
                      placeholder="Ex : Display Évolutions Prismatiques, ETB 151…"
                      className="w-full pl-12 pr-4 py-4 rounded-xl text-base text-white outline-none"
                      style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                      autoFocus
                    />
                  </div>
                  <button onClick={() => query.trim() && identifyText(query.trim())}
                    disabled={isPending || !query.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'linear-gradient(135deg,#A78BFA,#8B5CF6)', color: '#fff' }}>
                    {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ScanLine className="w-5 h-5" />Identifier ce coffret</>}
                  </button>

                  {/* Examples */}
                  <div>
                    <p className="text-xs text-white/30 mb-2">Exemples :</p>
                    <div className="flex flex-wrap gap-1.5">
                      {EXAMPLES.map(ex => (
                        <button key={ex} onClick={() => { setQuery(ex); identifyText(ex) }}
                          className="px-2.5 py-1 rounded-xl text-xs text-white/50 hover:text-white/75 transition-all"
                          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* PHOTO mode */}
              {mode === 'photo' && (
                <div className="space-y-4">
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
                  <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />

                  {!preview ? (
                    /* Drop zone */
                    <div
                      className="relative rounded-2xl overflow-hidden cursor-pointer min-h-56 flex flex-col items-center justify-center p-8 gap-4"
                      style={{ background: 'rgba(255,255,255,0.03)', border: `2px dashed ${VIOLET_BORDER}` }}
                      onClick={() => fileRef.current?.click()}
                      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
                      onDragOver={e => e.preventDefault()}>
                      <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}>
                        <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                          style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}` }}>
                          <ImageUp className="w-7 h-7" style={{ color: VIOLET }} />
                        </div>
                      </motion.div>
                      <div className="text-center">
                        <p className="font-bold text-white mb-1">Glissez ou cliquez pour uploader</p>
                        <p className="text-sm text-white/50">Photo de la boîte ou du coffret scellé</p>
                      </div>
                      <div className="flex gap-3">
                        <button
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                          style={{ background: VIOLET_BG, border: `1px solid ${VIOLET_BORDER}`, color: VIOLET }}
                          onClick={e => { e.stopPropagation(); fileRef.current?.click() }}>
                          <ImageUp className="w-4 h-4" />Importer
                        </button>
                        <button
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all hover:bg-white/5"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)' }}
                          onClick={e => { e.stopPropagation(); cameraRef.current?.click() }}>
                          <Camera className="w-4 h-4" />Caméra
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Preview + scan */
                    <div className="space-y-3">
                      <div className="relative rounded-2xl overflow-hidden"
                        style={{ border: `2px solid ${scanning ? VIOLET : VIOLET_BORDER}` }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={preview} alt="coffret" className="w-full object-contain max-h-80" />
                        {scanning && <ScanOverlay />}
                      </div>

                      {scanning ? (
                        <div className="glass-card px-4 py-3 flex items-center gap-3">
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.2, ease: 'linear', repeat: Infinity }}
                            className="w-5 h-5 rounded-full border-2 border-t-transparent flex-shrink-0"
                            style={{ borderColor: VIOLET, borderTopColor: 'transparent' }} />
                          <div>
                            <p className="text-sm font-semibold text-white">Analyse IA en cours…</p>
                            <p className="text-xs text-white/50">Identification du coffret et calcul du prix marché</p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-3">
                          <button onClick={scanPhoto}
                            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm hover:brightness-110"
                            style={{ background: 'linear-gradient(135deg,#A78BFA,#8B5CF6)', color: '#fff' }}>
                            <Zap className="w-5 h-5" />Analyser ce coffret
                          </button>
                          <button onClick={reset} className="btn-ghost px-4 py-3 rounded-xl">
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="glass-card p-4 flex items-center gap-3 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              {/* Info box */}
              <div className="glass-card p-4 flex items-start gap-3">
                <Package className="w-5 h-5 text-white/30 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-white/45 leading-relaxed">
                  Identification par nom ou par photo d'un coffret Pokémon TCG.
                  Le système détecte automatiquement le type, la série, le set et calcule le prix marché estimé.
                  {isPremium && ' En tant qu\'abonné, vous pouvez ajouter les nouveaux coffrets à notre base.'}
                </div>
              </div>

              <div className="text-center">
                <Link href="/sealed" className="text-sm text-white/30 hover:text-white/60 transition-colors">
                  ← Voir tous les coffrets analysés
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <Footer />
    </div>
  )
}
