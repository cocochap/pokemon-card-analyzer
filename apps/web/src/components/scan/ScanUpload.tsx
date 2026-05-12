'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, CheckCircle2, ImageUp, RotateCcw, Sparkles, Upload, Zap } from 'lucide-react'
import Image from 'next/image'

type ScanState = 'idle' | 'preview' | 'scanning' | 'result'

interface ScanResult {
  cardName:   string
  set:        string
  rarity:     string
  condition:  string
  psaGrade:   number
  confidence: number
  value:      number
  trend:      number
}

/* ── Scanning animation overlay ─────────────────────────────── */
function ScanBeamOverlay() {
  return (
    <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none z-10">
      {/* Darkened sides */}
      <div className="absolute inset-0 bg-navy-900/30" />

      {/* Grid lines */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-electric-500/10"
          style={{ top: `${20 * (i + 1)}%` }}
        />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="absolute top-0 bottom-0 border-l border-electric-500/10"
          style={{ left: `${25 * (i + 1)}%` }}
        />
      ))}

      {/* The scanning beam */}
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
      {[
        'top-3 left-3 border-t-2 border-l-2',
        'top-3 right-3 border-t-2 border-r-2',
        'bottom-3 left-3 border-b-2 border-l-2',
        'bottom-3 right-3 border-b-2 border-r-2',
      ].map((cls, i) => (
        <div key={i} className={`absolute w-6 h-6 border-electric-400 rounded-sm ${cls}`} />
      ))}

      {/* Scanning label */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', color: '#93C5FD' }}>
        <motion.div
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-electric-400"
        />
        Analyzing with AI...
      </div>
    </div>
  )
}

/* ── Result card ─────────────────────────────────────────────── */
function ResultCard({ result, onReset }: { result: ScanResult; onReset: () => void }) {
  const trendPositive = result.trend >= 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="space-y-4"
    >
      {/* Success badge */}
      <div className="flex items-center gap-2 text-green-400 text-sm font-semibold">
        <CheckCircle2 className="w-5 h-5" />
        Card identified successfully
      </div>

      {/* Card name & set */}
      <div className="glass-card p-4">
        <h3 className="text-xl font-bold text-white mb-1">{result.cardName}</h3>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>{result.set}</span>
          <span className="w-1 h-1 rounded-full bg-white/30" />
          <span>{result.rarity}</span>
        </div>
      </div>

      {/* Grade + value grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass-card p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">PSA Grade</div>
          <div className="text-3xl font-bold"
            style={{ background: 'linear-gradient(135deg, #D97706, #FBBF24)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {result.psaGrade}
          </div>
          <div className="text-xs text-muted-foreground mt-1">Confidence: {result.confidence}%</div>
        </div>

        <div className="glass-card p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">Market Value</div>
          <div className="text-3xl font-bold text-white">€{result.value}</div>
          <div className={`text-xs mt-1 font-semibold ${trendPositive ? 'text-green-400' : 'text-red-400'}`}>
            {trendPositive ? '+' : ''}{result.trend}% this month
          </div>
        </div>
      </div>

      {/* Condition bar */}
      <div className="glass-card p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-muted-foreground">Condition</span>
          <span className="text-sm font-semibold text-electric-300">{result.condition}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #2563EB, #60A5FA)' }}
            initial={{ width: 0 }}
            animate={{ width: `${(result.psaGrade / 10) * 100}%` }}
            transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-3">
        <button className="btn-primary flex-1 justify-center py-3 rounded-xl">
          <Sparkles className="w-4 h-4" />
          Full Analysis
        </button>
        <button className="btn-ghost px-4 py-3 rounded-xl" onClick={onReset}>
          <RotateCcw className="w-4 h-4" />
          Scan Again
        </button>
      </div>
    </motion.div>
  )
}

/* ── Main upload component ──────────────────────────────────── */
export function ScanUpload() {
  const [state, setState] = useState<ScanState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setPreview(url)
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

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)

  const startScan = async () => {
    setState('scanning')
    // Simulate AI analysis (replace with real API call)
    await new Promise(r => setTimeout(r, 3200))
    setResult({
      cardName:   'Charizard',
      set:        'Base Set (1999)',
      rarity:     'Holo Rare',
      condition:  'Near Mint',
      psaGrade:   9,
      confidence: 94,
      value:      280,
      trend:      18.4,
    })
    setState('result')
  }

  const reset = () => {
    setState('idle')
    setPreview(null)
    setResult(null)
    if (fileRef.current)   fileRef.current.value = ''
    if (cameraRef.current) cameraRef.current.value = ''
  }

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Hidden file inputs */}
      <input ref={fileRef}   type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      <AnimatePresence mode="wait">

        {/* ── IDLE: drop zone ─────────────────────────────── */}
        {state === 'idle' && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              className={`scan-zone flex flex-col items-center justify-center min-h-64 p-8 cursor-pointer transition-all duration-300 ${isDragging ? 'drag-over' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileRef.current?.click()}
            >
              {/* Animated corner brackets */}
              {[
                'top-3 left-3 border-t-2 border-l-2',
                'top-3 right-3 border-t-2 border-r-2',
                'bottom-3 left-3 border-b-2 border-l-2',
                'bottom-3 right-3 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 border-electric-400/50 rounded-sm ${cls}`} />
              ))}

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}
                className="mb-4"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(59,130,246,0.1) 100%)',
                    border: '1px solid rgba(59,130,246,0.3)',
                  }}
                >
                  <ImageUp className="w-7 h-7 text-electric-400" />
                </div>
              </motion.div>

              <p className="text-base font-semibold text-white mb-1">Drop your card here</p>
              <p className="text-sm text-muted-foreground text-center mb-5">
                or tap to browse files
              </p>

              <div className="flex gap-2">
                <button
                  className="btn-primary px-4 py-2 text-sm rounded-xl"
                  onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
                >
                  <Upload className="w-4 h-4" />
                  Upload Image
                </button>
                <button
                  className="btn-ghost px-4 py-2 text-sm rounded-xl"
                  onClick={e => { e.stopPropagation(); cameraRef.current?.click() }}
                >
                  <Camera className="w-4 h-4" />
                  Camera
                </button>
              </div>

              <p className="text-xs text-muted-foreground mt-4">Supports JPG, PNG, WEBP · Max 10MB</p>
            </div>
          </motion.div>
        )}

        {/* ── PREVIEW: show image + scan button ───────────── */}
        {(state === 'preview' || state === 'scanning') && preview && (
          <motion.div key="preview" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="relative rounded-2xl overflow-hidden"
              style={{ border: state === 'scanning' ? '2px solid rgba(59,130,246,0.7)' : '2px solid rgba(59,130,246,0.3)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="Card preview" className="w-full object-contain max-h-80" />
              {state === 'scanning' && <ScanBeamOverlay />}
            </div>

            {state === 'preview' && (
              <div className="flex gap-3 mt-4">
                <button className="btn-primary flex-1 justify-center py-3 text-base rounded-xl font-bold" onClick={startScan}>
                  <Zap className="w-5 h-5" />
                  Analyze with AI
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
                  <p className="text-sm font-semibold text-white">AI is analyzing your card...</p>
                  <p className="text-xs text-muted-foreground">Checking 22,000+ cards in database</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── RESULT ──────────────────────────────────────── */}
        {state === 'result' && result && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ResultCard result={result} onReset={reset} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
