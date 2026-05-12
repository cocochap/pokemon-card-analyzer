'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle, Camera, CheckCircle2, ExternalLink,
  ImageUp, RotateCcw, Sparkles, TrendingDown, TrendingUp, Upload, Zap,
} from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/LanguageContext'

type ScanState = 'idle' | 'preview' | 'scanning' | 'result' | 'error'

interface ScanResult {
  analysis: {
    cardName:          string
    setName:           string
    rarity:            string
    variant:           string
    condition:         string
    conditionDetails?: { centering: string; surface: string; corners: string; edges: string }
    estimatedPsaGrade: number
    psaGradeRationale: string
    confidence:        number
    isFirstEdition:    boolean
    isShadowless:      boolean
    language:          string
    notes:             string
  }
  dbMatch: {
    id:       string
    name:     string
    number:   string
    rarity:   string
    imageUrl: string | null
    set: { name: string; externalId: string; releaseDate: string | null; logoUrl: string | null }
    price:  { market: number; avg7d: number; avg30d: number; currency: string } | null
    market: { investmentScore: number; rarityScore: number; trendDirection: string; priceChange7d: number; priceChange30d: number; allTimeHigh: number } | null
  } | null
}

/* ── Scanning beam overlay ─────────────────────────────────── */
function ScanBeamOverlay() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-10">
      <div className="absolute inset-0 bg-navy-900/20" />

      {/* Grid */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={`h${i}`} className="absolute left-0 right-0 border-t border-electric-500/10" style={{ top: `${20 * (i + 1)}%` }} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-electric-500/10" style={{ left: `${25 * (i + 1)}%` }} />
      ))}

      {/* Beam */}
      <motion.div
        className="absolute left-0 right-0 h-1"
        style={{
          background: 'linear-gradient(90deg, transparent 0%, rgba(59,130,246,0.7) 30%, rgba(147,197,253,1) 50%, rgba(59,130,246,0.7) 70%, transparent 100%)',
          boxShadow: '0 0 20px rgba(59,130,246,0.8), 0 0 40px rgba(59,130,246,0.4)',
        }}
        animate={{ top: ['0%', '100%'] }}
        transition={{ duration: 1.8, ease: 'linear', repeat: Infinity }}
      />

      {/* Corner brackets */}
      {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2',
        'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-electric-400 rounded-sm ${cls}`} />
      ))}

      {/* Status label */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93C5FD' }}>
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-electric-400" />
        Analyzing with AI...
      </div>
    </div>
  )
}

/* ── Grade ring ─────────────────────────────────────────────── */
function GradeRing({ grade }: { grade: number }) {
  const pct = (grade / 10) * 100
  const r   = 22
  const circ = 2 * Math.PI * r
  const color = grade >= 8 ? '#22C55E' : grade >= 6 ? '#F59E0B' : '#EF4444'

  return (
    <div className="relative flex items-center justify-center w-16 h-16">
      <svg width="64" height="64" className="-rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <motion.circle
          cx="32" cy="32" r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ - (pct / 100) * circ }}
          transition={{ delay: 0.3, duration: 1, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold" style={{ color }}>{grade}</span>
        <span className="text-[9px] text-muted-foreground -mt-0.5">PSA</span>
      </div>
    </div>
  )
}

/* ── Condition dot ──────────────────────────────────────────── */
function ConditionBadge({ condition, labels }: { condition: string; labels: Record<string, string> }) {
  const colors: Record<string, string> = {
    'Mint':         '#22C55E',
    'Near Mint':    '#4ADE80',
    'Excellent':    '#86EFAC',
    'Good':         '#FCD34D',
    'Light Played': '#F59E0B',
    'Played':       '#F97316',
    'Poor':         '#EF4444',
  }
  const color = colors[condition] ?? '#94A3B8'
  const label = labels[condition] ?? condition
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
}

/* ── Result panel ───────────────────────────────────────────── */
function ResultPanel({ result, preview, onReset, s }: { result: ScanResult; preview: string; onReset: () => void; s: Record<string, any> }) {
  const { analysis, dbMatch } = result
  const price = dbMatch?.price?.market ?? 0
  const trend = dbMatch?.market?.priceChange30d ?? 0
  const trendUp = trend >= 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-3"
    >
      {/* Success */}
      <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        {s.identified} {analysis.confidence}%
      </div>

      {/* Card preview + grade */}
      <div className="glass-card p-4 flex gap-4 items-center">
        {/* Thumbnail */}
        <div className="w-20 h-28 rounded-xl overflow-hidden flex-shrink-0 border border-white/[0.08]">
          {dbMatch?.imageUrl
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={dbMatch.imageUrl} alt={dbMatch.name} className="w-full h-full object-cover" />
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img src={preview} alt="preview" className="w-full h-full object-cover" />
          }
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-bold text-white truncate">{dbMatch?.name ?? analysis.cardName}</h3>
          <p className="text-xs text-muted-foreground mb-2 truncate">
            {dbMatch?.set.name ?? analysis.setName}
            {dbMatch?.number && ` · #${dbMatch.number}`}
          </p>
          <ConditionBadge condition={analysis.condition} labels={s.conditionLabels} />
          {(analysis.isFirstEdition || analysis.isShadowless) && (
            <div className="flex gap-1.5 mt-1.5">
              {analysis.isFirstEdition && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.35)', color: '#FBBF24' }}>
                  {s.firstEdition}
                </span>
              )}
              {analysis.isShadowless && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                  style={{ background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.35)', color: '#C4B5FD' }}>
                  {s.shadowless}
                </span>
              )}
            </div>
          )}
        </div>

        <GradeRing grade={analysis.estimatedPsaGrade} />
      </div>

      {/* Grade rationale */}
      <div className="glass-card px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <span className="font-semibold text-white mr-1">{s.gradeRationale}</span>
        {analysis.psaGradeRationale}
      </div>

      {/* Price + market */}
      {price > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="glass-card p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">{s.marketValue}</div>
            <div className="text-2xl font-bold text-white">
              {dbMatch?.price?.currency === 'EUR' ? '€' : '$'}{price.toFixed(2)}
            </div>
            <div className={`flex items-center justify-center gap-1 text-xs mt-1 font-semibold ${trendUp ? 'text-green-400' : 'text-red-400'}`}>
              {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trendUp ? '+' : ''}{trend.toFixed(1)}% (30d)
            </div>
          </div>

          <div className="glass-card p-4 text-center">
            <div className="text-xs text-muted-foreground mb-1">{s.investScore}</div>
            <div className="text-2xl font-bold"
              style={{ color: (dbMatch?.market?.investmentScore ?? 0) > 70 ? '#22C55E' : (dbMatch?.market?.investmentScore ?? 0) > 40 ? '#F59E0B' : '#EF4444' }}>
              {dbMatch?.market?.investmentScore ?? '—'}/100
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              {dbMatch?.market?.trendDirection?.replace('_', ' ') ?? ''}
            </div>
          </div>
        </div>
      )}

      {/* Condition detail */}
      {analysis.conditionDetails && (
        <div className="glass-card p-4">
          <p className="text-xs font-semibold text-white mb-3">{s.conditionBreakdown}</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(analysis.conditionDetails).map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground capitalize">{k}</span>
                <span className="font-medium text-white">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI notes */}
      {analysis.notes && (
        <div className="glass-card px-4 py-3 text-xs text-muted-foreground leading-relaxed">
          <span className="font-semibold text-white mr-1">{s.notes}</span>{analysis.notes}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {dbMatch && (
          <Link href={`/cards/${dbMatch.id}`} className="btn-primary flex-1 justify-center py-3 rounded-xl text-sm">
            <Sparkles className="w-4 h-4" />
            {s.fullAnalysis}
            <ExternalLink className="w-3 h-3 opacity-60" />
          </Link>
        )}
        <button className="btn-ghost px-4 py-3 rounded-xl" onClick={onReset}>
          <RotateCcw className="w-4 h-4" />
          {!dbMatch && <span className="ml-1 text-sm">{s.scanAgain}</span>}
        </button>
      </div>
    </motion.div>
  )
}

/* ── Main upload component ─────────────────────────────────── */
export function ScanUpload() {
  const t = useT()
  const s = t.scan

  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview]     = useState<string | null>(null)
  const [fileObj, setFileObj]     = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult]       = useState<ScanResult | null>(null)
  const [errorMsg, setErrorMsg]   = useState<string>('')

  const fileRef   = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    setFileObj(file)
    setPreview(URL.createObjectURL(file))
    setState('preview')
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const startScan = async () => {
    if (!fileObj) return
    setState('scanning')
    setErrorMsg('')

    try {
      const form = new FormData()
      form.append('image', fileObj)

      const res  = await fetch('/api/ai/scan', { method: 'POST', body: form })
      const data = await res.json()

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Scan failed')
      }

      setResult(data as ScanResult)
      setState('result')
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Unknown error')
      setState('error')
    }
  }

  const reset = () => {
    setState('idle')
    setPreview(null)
    setFileObj(null)
    setResult(null)
    setErrorMsg('')
    if (fileRef.current)   fileRef.current.value   = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      <AnimatePresence mode="wait">

        {/* ── IDLE ──────────────────────────────────────────── */}
        {state === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className={`scan-zone relative flex flex-col items-center justify-center min-h-64 p-8 cursor-pointer ${isDragging ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => fileRef.current?.click()}
            >
              {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2',
                'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 border-electric-400/50 rounded-sm ${cls}`} />
              ))}

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
                className="mb-4"
              >
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(59,130,246,0.25)' }}>
                  <ImageUp className="w-7 h-7 text-electric-400" />
                </div>
              </motion.div>

              <p className="text-base font-semibold text-white mb-1">{s.dropTitle}</p>
              <p className="text-sm text-muted-foreground text-center mb-5">{s.dropSubtitle}</p>

              <div className="flex gap-2">
                <button
                  className="btn-primary px-4 py-2 text-sm rounded-xl"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                >
                  <Upload className="w-4 h-4" />
                  {s.upload}
                </button>
                <button
                  className="btn-ghost px-4 py-2 text-sm rounded-xl"
                  onClick={e => { e.stopPropagation(); cameraRef.current?.click() }}
                >
                  <Camera className="w-4 h-4" />
                  {s.camera}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-4">{s.fileTypes}</p>
            </div>
          </motion.div>
        )}

        {/* ── PREVIEW / SCANNING ────────────────────────────── */}
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
                <button className="btn-primary flex-1 justify-center py-3 text-base rounded-xl font-bold" onClick={startScan}>
                  <Zap className="w-5 h-5" />
                  {s.analyze}
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
                  className="w-5 h-5 rounded-full border-2 border-electric-500 border-t-transparent flex-shrink-0"
                />
                <div>
                  <p className="text-sm font-semibold text-white">{s.analyzing}</p>
                  <p className="text-xs text-muted-foreground">{s.analyzingDetail}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── RESULT ────────────────────────────────────────── */}
        {state === 'result' && result && preview && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ResultPanel result={result} preview={preview} onReset={reset} s={s} />
          </motion.div>
        )}

        {/* ── ERROR ─────────────────────────────────────────── */}
        {state === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="glass-card p-6 text-center space-y-4">
              <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
              <div>
                <p className="font-semibold text-white mb-1">{s.scanFailed}</p>
                <p className="text-sm text-muted-foreground">{errorMsg || s.scanFailedDesc}</p>
              </div>
              <button className="btn-primary w-full justify-center py-3 rounded-xl" onClick={reset}>
                <RotateCcw className="w-4 h-4" />
                {s.tryAgain}
              </button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
