'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle, Camera, CheckCircle2, ExternalLink,
  ImageUp, RotateCcw, TrendingDown, TrendingUp, Upload, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/LanguageContext'

type ScanState = 'idle' | 'preview' | 'scanning' | 'result' | 'error'

interface Identification {
  cardName:       string
  cardNumber:     string
  setName:        string
  setId:          string
  language:       string
  confidence:     number
  isFirstEdition?: boolean
  resolvedName?:  string
  resolvedId?:    string
}

interface DbMatch {
  id:       string
  name:     string
  number:   string
  rarity:   string
  imageUrl: string | null
  set: { name: string; externalId: string; releaseDate: string | null }
  price: { market: number; low: number; high: number; currency: string } | null
  market: {
    investmentScore: number; rarityScore: number; liquidityScore: number
    trendDirection: string
    change7d: number; change30d: number; change1y: number
    allTimeHigh: number; volatility: number
  } | null
  ai: {
    investmentScore: number; trendDirection: string
    bullishSignals: string[]; bearishSignals: string[]
    keyInsight: string | null
    pred1y: { value: number; low: number; high: number } | null
  } | null
  projections: {
    y1: { value: number }; y3: { value: number }
    y5: { value: number }; y10: { value: number }
  } | null
  annualGrowthRate: number
}

interface ScanResult {
  identification: Identification
  dbMatch: DbMatch | null
}

/* ── Scan beam overlay ───────────────────────────────────────── */
function ScanBeamOverlay() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-10">
      <div className="absolute inset-0 bg-blue-950/30" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`h${i}`} className="absolute left-0 right-0 border-t border-blue-400/10" style={{ top: `${20 * (i + 1)}%` }} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-blue-400/10" style={{ left: `${25 * (i + 1)}%` }} />
      ))}
      <motion.div
        className="absolute left-0 right-0 h-1"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.8) 30%, rgba(147,197,253,1) 50%, rgba(59,130,246,0.8) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(59,130,246,0.8)',
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 1.8, ease: 'linear', repeat: Infinity }}
      />
      {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2',
        'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-blue-400 rounded-sm ${cls}`} />
      ))}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600/90 border border-blue-400/30 text-white backdrop-blur-sm">
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-white" />
        Identification IA...
      </div>
    </div>
  )
}

/* ── Score ring ──────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const r = 22; const circ = 2 * Math.PI * r
  const color = score >= 70 ? '#16A34A' : score >= 45 ? '#D97706' : '#DC2626'
  const trackColor = score >= 70 ? 'rgba(22,163,74,0.1)' : score >= 45 ? 'rgba(217,119,6,0.1)' : 'rgba(220,38,38,0.1)'
  return (
    <div className="relative flex items-center justify-center w-16 h-16 flex-shrink-0">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke={trackColor} strokeWidth="4" />
        <motion.circle cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (score / 100) * circ }}
          transition={{ delay: 0.4, duration: 1, ease: 'easeOut' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold" style={{ color }}>{score}</span>
        <span className="text-[9px] text-gray-400 -mt-0.5">/100</span>
      </div>
    </div>
  )
}

/* ── Change badge ────────────────────────────────────────────── */
function ChangeBadge({ value, label }: { value: number; label: string }) {
  const up = value >= 0
  return (
    <div className="glass-card p-3 text-center">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`flex items-center justify-center gap-1 text-sm font-bold ${up ? 'text-green-600' : 'text-red-600'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? '+' : ''}{value.toFixed(1)}%
      </div>
    </div>
  )
}

/* ── Result panel ────────────────────────────────────────────── */
function ResultPanel({ result, preview, onReset, s }: { result: ScanResult; preview: string; onReset: () => void; s: any }) {
  const { identification: id, dbMatch: db } = result

  const displayName = db?.name ?? id.resolvedName ?? id.cardName
  const displaySet  = db?.set.name ?? id.setName
  const displayNum  = db?.number ?? id.cardNumber
  const displayRar  = db?.rarity ?? ''
  const imageUrl    = db?.imageUrl

  const price    = db?.price?.market ?? 0
  const currency = db?.price?.currency ?? 'EUR'
  const sym      = currency === 'EUR' ? '€' : '$'
  const score    = db?.ai?.investmentScore ?? db?.market?.investmentScore ?? 0
  const proj     = db?.projections
  const rate     = db?.annualGrowthRate ?? 0
  const ratePos  = rate >= 0

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-3">

      {/* Identified header */}
      <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        {s.identified} {id.confidence}%
        {id.isFirstEdition && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 border border-amber-200 text-amber-800">
            {s.firstEdition}
          </span>
        )}
      </div>

      {/* Card hero */}
      <div className="glass-card p-4 flex gap-4 items-start">
        <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0 border border-gray-200">
          {imageUrl
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img src={preview}  alt="preview"     className="w-full h-full object-cover" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">{displayName}</h3>
          <p className="text-xs text-gray-500 mb-0.5">{displaySet}</p>
          {displayNum && <p className="text-xs text-gray-400 mb-2">#{displayNum}</p>}
          {displayRar && (
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full mb-2 bg-blue-50 border border-blue-200 text-blue-700">
              {displayRar}
            </span>
          )}
          {db?.ai?.keyInsight && (
            <p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mt-1 italic">{db.ai.keyInsight}</p>
          )}
        </div>
        {score > 0 && <ScoreRing score={score} />}
      </div>

      {/* Price + changes */}
      {db ? (
        price > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card p-3 text-center col-span-1">
              <div className="text-xs text-gray-500 mb-1">{s.currentPrice}</div>
              <div className="text-xl font-bold text-gray-900">{sym}{price.toFixed(2)}</div>
              {db.price!.high > 0 && (
                <div className="text-[10px] text-gray-400 mt-0.5">
                  {sym}{db.price!.low.toFixed(2)} – {sym}{db.price!.high.toFixed(2)}
                </div>
              )}
            </div>
            <ChangeBadge value={db.market?.change7d ?? 0}  label={s.change7d} />
            <ChangeBadge value={db.market?.change1y ?? 0}  label={s.change1y} />
          </div>
        ) : (
          <div className="glass-card px-4 py-3 flex items-center gap-2 text-sm text-gray-500">
            <span>💰</span>
            <span>Prix Cardmarket non disponible pour cette carte</span>
          </div>
        )
      ) : (
        <div className="glass-card px-4 py-3 text-sm text-gray-500">
          Cette carte n&apos;est pas encore dans notre base — mais l&apos;IA l&apos;a bien identifiée.
        </div>
      )}

      {/* Market scores */}
      {db?.market && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Score invest.',  value: `${db.market.investmentScore}/100`, color: db.market.investmentScore > 70 ? 'text-green-600' : db.market.investmentScore > 40 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Score rareté',   value: `${db.market.rarityScore}/100`,    color: 'text-blue-600' },
            { label: 'Liquidité',      value: `${db.market.liquidityScore}/100`, color: 'text-violet-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card p-3 text-center">
              <div className="text-xs text-gray-500 mb-1">{label}</div>
              <div className={`text-sm font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projections */}
      {proj && price > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-gray-900">{s.projectionTitle}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ratePos ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
              {ratePos ? '+' : ''}{rate.toFixed(1)}%/an
            </span>
          </div>
          <div className="space-y-1">
            {[
              { label: s.today,      value: price },
              { label: s.in1year,   value: proj.y1.value },
              { label: s.in3years,  value: proj.y3.value },
              { label: s.in5years,  value: proj.y5.value },
              { label: s.in10years, value: proj.y10.value, highlight: true },
            ].map(({ label, value, highlight }) => (
              <div key={label} className={`flex justify-between items-center py-1.5 px-3 rounded-xl ${highlight ? 'bg-blue-50 border border-blue-100' : 'hover:bg-gray-50'} transition-colors`}>
                <span className="text-sm text-gray-600">{label}</span>
                <span className={`text-sm font-bold ${highlight ? 'text-blue-700' : 'text-gray-900'}`}>
                  {sym}{value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2 text-center">{s.projectionDisclaimer}</p>
        </div>
      )}

      {/* Signals */}
      {db?.ai && (db.ai.bullishSignals.length > 0 || db.ai.bearishSignals.length > 0) && (
        <div className="glass-card p-4 space-y-1.5">
          {db.ai.bullishSignals.map((sig, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-green-700">
              <span className="text-green-600 font-bold mt-0.5">↑</span>{sig}
            </div>
          ))}
          {db.ai.bearishSignals.map((sig, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-700">
              <span className="text-red-600 font-bold mt-0.5">↓</span>{sig}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {db && (
          <Link href={`/cards/${db.id}`} className="btn-primary flex-1 justify-center py-3 rounded-xl text-sm">
            <Zap className="w-4 h-4" />{s.fullAnalysis}<ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        )}
        <button className="btn-ghost px-4 py-3 rounded-xl" onClick={onReset}>
          <RotateCcw className="w-4 h-4" />
          {!db && <span className="ml-1 text-sm">{s.scanAgain}</span>}
        </button>
      </div>
    </motion.div>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export function ScanUpload() {
  const t = useT()
  const s = t.scan

  const [state, setState]           = useState<ScanState>('idle')
  const [preview, setPreview]       = useState<string | null>(null)
  const [fileObj, setFileObj]       = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult]         = useState<ScanResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')

  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setFileObj(file)
    setPreview(URL.createObjectURL(file))
    setState('preview')
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (f) processFile(f)
  }
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) processFile(f)
  }, [processFile])

  const startScan = async () => {
    if (!fileObj) return
    setState('scanning'); setErrorMsg('')
    try {
      const form = new FormData()
      form.append('image', fileObj)
      const res  = await fetch('/api/ai/scan', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Scan failed')
      setResult(data as ScanResult)
      setState('result')
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Unknown error')
      setState('error')
    }
  }

  const reset = () => {
    setState('idle'); setPreview(null); setFileObj(null)
    setResult(null); setErrorMsg('')
    if (fileRef.current)   fileRef.current.value   = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      <AnimatePresence mode="wait">

        {/* IDLE */}
        {state === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className={`scan-zone relative flex flex-col items-center justify-center min-h-64 p-8 cursor-pointer ${isDragging ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileRef.current?.click()}
            >
              {/* Corner marks */}
              {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2',
                'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 border-blue-400/50 rounded-sm ${cls}`} />
              ))}

              {/* Upload icon */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
                className="mb-5"
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-blue-50 border border-blue-200">
                  <ImageUp className="w-7 h-7 text-blue-600" />
                </div>
              </motion.div>

              <p className="text-base font-bold text-gray-900 mb-1">{s.dropTitle}</p>
              <p className="text-sm text-gray-500 text-center mb-6">{s.dropSubtitle}</p>

              <div className="flex gap-2">
                <button
                  className="btn-primary px-5 py-2.5 text-sm rounded-xl"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                >
                  <Upload className="w-4 h-4" />{s.upload}
                </button>
                <button
                  className="btn-ghost px-5 py-2.5 text-sm rounded-xl"
                  onClick={e => { e.stopPropagation(); cameraRef.current?.click() }}
                >
                  <Camera className="w-4 h-4" />{s.camera}
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-4">{s.fileTypes}</p>
            </div>
          </motion.div>
        )}

        {/* PREVIEW / SCANNING */}
        {(state === 'preview' || state === 'scanning') && preview && (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div
              className="relative rounded-2xl overflow-hidden"
              style={{ border: `2px solid ${state === 'scanning' ? 'rgba(59,130,246,0.7)' : 'rgba(59,130,246,0.3)'}` }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Card preview" className="w-full object-contain max-h-80" />
              {state === 'scanning' && <ScanBeamOverlay />}
            </div>

            {state === 'preview' && (
              <div className="flex gap-3 mt-4">
                <button
                  className="btn-primary flex-1 justify-center py-3 text-base rounded-xl font-bold"
                  onClick={startScan}
                >
                  <Zap className="w-5 h-5" />{s.analyze}
                </button>
                <button className="btn-ghost px-4 py-3 rounded-xl" onClick={reset}>
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            )}

            {state === 'scanning' && (
              <div className="mt-4 glass-card px-4 py-3 flex items-center gap-3">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
                  className="w-5 h-5 rounded-full border-2 border-blue-600 border-t-transparent flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-gray-900">{s.analyzing}</p>
                  <p className="text-xs text-gray-500">{s.analyzingDetail}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* RESULT */}
        {state === 'result' && result && preview && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ResultPanel result={result} preview={preview} onReset={reset} s={s} />
          </motion.div>
        )}

        {/* ERROR */}
        {state === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-6 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-red-500 mx-auto" />
              <div>
                <p className="font-bold text-gray-900 mb-1">{s.scanFailed}</p>
                <p className="text-sm text-gray-500">{errorMsg || s.scanFailedDesc}</p>
              </div>
              <button className="btn-primary w-full justify-center py-3 rounded-xl" onClick={reset}>
                <RotateCcw className="w-4 h-4" />{s.tryAgain}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
