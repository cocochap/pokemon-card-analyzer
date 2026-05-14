'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle, Camera, CheckCircle2, ExternalLink, Info,
  ImageUp, Plus, RotateCcw, TrendingDown, TrendingUp, Upload, Zap, X,
} from 'lucide-react'
import Link from 'next/link'
import { useT } from '@/lib/i18n/LanguageContext'

type ScanState = 'idle' | 'preview' | 'scanning' | 'candidates' | 'result' | 'error'

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

interface Candidate {
  id:       string
  name:     string
  number:   string
  rarity:   string
  imageUrl: string | null
  setName:  string
  setId:    string
  price:    number | null
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

/* ── Photo tips ──────────────────────────────────────────────── */
const TIPS = [
  { icon: '📸', label: 'Face recto visible', desc: 'Montrez la face avant de la carte, centrée dans le cadre' },
  { icon: '💡', label: 'Bonne lumière', desc: 'Lumière naturelle de côté — évitez le flash sur les holographiques' },
  { icon: '🔢', label: 'Numéro lisible', desc: 'Le numéro en bas doit être net (ex: 004/165 ou SV107/SV122)' },
  { icon: '📐', label: 'Carte à plat', desc: 'Posez la carte sur une surface stable, sans flou ni angle' },
]

function PhotoTips({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(!compact)
  if (compact) {
    return (
      <div>
        <button onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/60 transition-colors mb-2">
          <Info className="w-3.5 h-3.5" />
          Conseils pour une bonne photo
          <span className="text-white/25">{open ? '▲' : '▼'}</span>
        </button>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="grid grid-cols-2 gap-2 pb-2">
                {TIPS.map(t => (
                  <div key={t.label} className="flex items-start gap-2 p-2.5 rounded-xl"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <span className="text-lg flex-shrink-0">{t.icon}</span>
                    <div>
                      <p className="text-[10px] font-semibold text-white/70">{t.label}</p>
                      <p className="text-[9px] text-white/35 leading-tight mt-0.5">{t.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 mb-5">
      {TIPS.map(t => (
        <div key={t.label} className="flex items-start gap-2 p-2.5 rounded-xl"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <span className="text-xl flex-shrink-0">{t.icon}</span>
          <div>
            <p className="text-xs font-semibold text-white/70">{t.label}</p>
            <p className="text-[10px] text-white/35 leading-tight mt-0.5">{t.desc}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ── Scan beam overlay ───────────────────────────────────────── */
function ScanBeamOverlay({ count }: { count: number }) {
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
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600/90 border border-blue-400/30 text-white backdrop-blur-sm whitespace-nowrap">
        <motion.div animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }}
          className="w-1.5 h-1.5 rounded-full bg-white flex-shrink-0" />
        Identification IA en cours{count > 1 ? ` (${count} photos)` : ''}…
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
        <span className="text-[9px] text-white/30 -mt-0.5">/100</span>
      </div>
    </div>
  )
}

/* ── Change badge ────────────────────────────────────────────── */
function ChangeBadge({ value, label }: { value: number; label: string }) {
  const up = value >= 0
  return (
    <div className="glass-card p-3 text-center">
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className={`flex items-center justify-center gap-1 text-sm font-bold ${up ? 'text-green-400' : 'text-red-400'}`}>
        {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
        {up ? '+' : ''}{value.toFixed(1)}%
      </div>
    </div>
  )
}

/* ── Result panel ────────────────────────────────────────────── */
function ResultPanel({ result, previews, onReset, s }: { result: ScanResult; previews: string[]; onReset: () => void; s: any }) {
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
      <div className="flex items-center gap-2 text-sm font-semibold text-green-400">
        <CheckCircle2 className="w-4 h-4" />
        {s.identified} {id.confidence}%
        {id.isFirstEdition && (
          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
            style={{ background: 'rgba(255,203,5,0.15)', border: '1px solid rgba(255,203,5,0.3)', color: '#FFCB05' }}>
            {s.firstEdition}
          </span>
        )}
      </div>

      {/* Card hero */}
      <div className="glass-card p-4 flex gap-4 items-start">
        <div className="w-24 h-32 rounded-xl overflow-hidden flex-shrink-0"
          style={{ border: '1px solid rgba(255,255,255,0.12)' }}>
          {imageUrl
            /* eslint-disable-next-line @next/next/no-img-element */
            ? <img src={imageUrl} alt={displayName} className="w-full h-full object-cover" />
            /* eslint-disable-next-line @next/next/no-img-element */
            : <img src={previews[0]} alt="preview" className="w-full h-full object-cover" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-bold text-white leading-tight mb-1">{displayName}</h3>
          <p className="text-xs text-white/50 mb-0.5">{displaySet}</p>
          {displayNum && <p className="text-xs text-white/35 mb-2">#{displayNum}</p>}
          {displayRar && (
            <span className="inline-block text-[11px] px-2 py-0.5 rounded-full mb-2"
              style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.25)', color: '#FFCB05' }}>
              {displayRar.replace(/_/g, ' ')}
            </span>
          )}
          {db?.ai?.keyInsight && (
            <p className="text-xs text-white/45 leading-relaxed line-clamp-2 mt-1 italic">{db.ai.keyInsight}</p>
          )}
        </div>
        {score > 0 && <ScoreRing score={score} />}
      </div>

      {/* Price + changes */}
      {db ? (
        price > 0 ? (
          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card p-3 text-center col-span-1">
              <div className="text-xs text-white/40 mb-1">{s.currentPrice}</div>
              <div className="text-xl font-bold text-pokemon-yellow">{sym}{price.toFixed(2)}</div>
              {db.price!.high > 0 && (
                <div className="text-[10px] text-white/30 mt-0.5">
                  {sym}{db.price!.low.toFixed(2)} – {sym}{db.price!.high.toFixed(2)}
                </div>
              )}
            </div>
            <ChangeBadge value={db.market?.change7d ?? 0}  label={s.change7d} />
            <ChangeBadge value={db.market?.change1y ?? 0}  label={s.change1y} />
          </div>
        ) : (
          <div className="glass-card px-4 py-3 flex items-center gap-2 text-sm text-white/45">
            <span>💰</span>
            <span>Prix Cardmarket non disponible pour cette carte</span>
          </div>
        )
      ) : (
        <div className="glass-card px-4 py-3 text-sm text-white/45">
          Cette carte n&apos;est pas encore dans notre base — mais l&apos;IA l&apos;a bien identifiée.
        </div>
      )}

      {/* Market scores */}
      {db?.market && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'Score invest.',  value: `${db.market.investmentScore}/100`, color: db.market.investmentScore > 70 ? 'text-green-400' : db.market.investmentScore > 40 ? 'text-amber-400' : 'text-red-400' },
            { label: 'Score rareté',   value: `${db.market.rarityScore}/100`,    color: 'text-blue-400' },
            { label: 'Liquidité',      value: `${db.market.liquidityScore}/100`, color: 'text-violet-400' },
          ].map(({ label, value, color }) => (
            <div key={label} className="glass-card p-3 text-center">
              <div className="text-xs text-white/40 mb-1">{label}</div>
              <div className={`text-sm font-bold ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Projections */}
      {proj && price > 0 && (
        <div className="glass-card p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-white">{s.projectionTitle}</p>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${ratePos ? 'text-green-400' : 'text-red-400'}`}
              style={{ background: ratePos ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${ratePos ? 'rgba(34,197,94,0.25)' : 'rgba(239,68,68,0.25)'}` }}>
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
              <div key={label} className="flex justify-between items-center py-1.5 px-3 rounded-xl transition-colors"
                style={highlight ? { background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.20)' } : {}}>
                <span className="text-sm text-white/55">{label}</span>
                <span className="text-sm font-bold" style={{ color: highlight ? '#FFCB05' : 'rgba(255,255,255,0.85)' }}>
                  {sym}{value.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-white/25 mt-2 text-center">{s.projectionDisclaimer}</p>
        </div>
      )}

      {/* Signals */}
      {db?.ai && (db.ai.bullishSignals.length > 0 || db.ai.bearishSignals.length > 0) && (
        <div className="glass-card p-4 space-y-1.5">
          {db.ai.bullishSignals.map((sig, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-green-400">
              <span className="font-bold mt-0.5">↑</span>{sig}
            </div>
          ))}
          {db.ai.bearishSignals.map((sig, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-red-400">
              <span className="font-bold mt-0.5">↓</span>{sig}
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

/* ── Candidate picker ────────────────────────────────────────── */
function CandidatePicker({
  candidates, identification, onSelect, onReset,
}: {
  candidates: Candidate[]
  identification: Identification
  onSelect: (id: string) => void
  onReset: () => void
}) {
  const [selected, setSelected] = useState<string | null>(null)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)

  const handleSearchInput = async (q: string) => {
    setSearchQuery(q)
    if (q.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/cards?q=${encodeURIComponent(q.trim())}&limit=8`)
      if (!res.ok) throw new Error('search failed')
      const data = await res.json()
      const cards: any[] = data.cards ?? data.data ?? data ?? []
      setSearchResults(cards.map((c: any) => ({
        id: c.id,
        name: c.name,
        number: c.number,
        rarity: c.rarity ?? '',
        imageUrl: c.imageLgUrl ?? c.imageSmUrl ?? null,
        setName: c.set?.name ?? '',
        setId: c.set?.externalId ?? '',
        price: Number(c.prices?.find((p: any) => p.source === 'cardmarket')?.market ?? c.prices?.[0]?.market ?? 0) || null,
      })))
    } catch { /* ignore */ }
    finally { setSearching(false) }
  }

  const aiLabel = [identification.cardName, identification.cardNumber].filter(Boolean).join(' #')

  const displayCandidates = showSearch ? searchResults : candidates

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-4">
      <div>
        <h3 className="text-lg font-bold text-white">Quelle est votre carte ?</h3>
        {aiLabel && <p className="text-xs text-white/45 mt-0.5">IA a lu : {aiLabel}</p>}
      </div>

      {showSearch ? (
        <div className="space-y-3">
          <input
            autoFocus
            type="text"
            value={searchQuery}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Tapez le nom ou numéro de la carte"
            className="w-full px-3 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
          />
          {searching && <p className="text-xs text-white/40">Recherche…</p>}
        </div>
      ) : null}

      {displayCandidates.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {displayCandidates.map(c => (
            <button
              key={c.id}
              onClick={() => { setSelected(c.id); onSelect(c.id) }}
              className="relative flex flex-col rounded-xl overflow-hidden text-left transition-all hover:brightness-110 focus:outline-none"
              style={{
                border: selected === c.id
                  ? '2px solid rgba(255,203,5,0.9)'
                  : '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.04)',
              }}
            >
              {/* Card image */}
              <div className="w-full" style={{ aspectRatio: '3/4', background: 'rgba(0,0,0,0.3)' }}>
                {c.imageUrl
                  /* eslint-disable-next-line @next/next/no-img-element */
                  ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-contain" />
                  : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">No image</div>
                }
              </div>
              {/* Info */}
              <div className="p-2 flex-1">
                <p className="text-xs font-semibold text-white leading-tight line-clamp-2">{c.name}</p>
                <p className="text-[10px] text-white/40 mt-0.5">#{c.number}</p>
                {c.setName && <p className="text-[10px] text-white/30 truncate">{c.setName}</p>}
                {c.price != null && (
                  <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                    style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.25)', color: '#FFCB05' }}>
                    {c.price.toFixed(2)} €
                  </span>
                )}
              </div>
              {/* Checkmark overlay when selected */}
              {selected === c.id && (
                <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(255,203,5,0.9)' }}>
                  <CheckCircle2 className="w-3.5 h-3.5 text-black" />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {!showSearch && displayCandidates.length === 0 && (
        <p className="text-sm text-white/40">Aucun candidat trouvé.</p>
      )}

      <div className="flex flex-col gap-2">
        {!showSearch ? (
          <button
            onClick={() => setShowSearch(true)}
            className="text-xs text-white/40 hover:text-white/65 transition-colors underline underline-offset-2 text-left"
          >
            Aucune de ces cartes ?
          </button>
        ) : (
          <button
            onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]) }}
            className="text-xs text-white/40 hover:text-white/65 transition-colors underline underline-offset-2 text-left"
          >
            Retour aux suggestions
          </button>
        )}
        <button
          onClick={onReset}
          className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/55 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Rescanner
        </button>
      </div>
    </motion.div>
  )
}

/* ── Photo slot ──────────────────────────────────────────────── */
function PhotoSlot({
  index, preview, required, onAdd, onRemove,
}: {
  index: number; preview: string | null; required: boolean
  onAdd: () => void; onRemove: () => void
}) {
  if (preview) {
    return (
      <div className="relative aspect-[3/4] rounded-xl overflow-hidden flex-1"
        style={{ border: '1px solid rgba(59,130,246,0.4)' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
        <button onClick={onRemove}
          className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full flex items-center justify-center z-10"
          style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}>
          <X className="w-3 h-3 text-white" />
        </button>
        <div className="absolute bottom-1.5 left-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: 'rgba(59,130,246,0.8)', color: 'white' }}>
          Photo {index + 1}
        </div>
      </div>
    )
  }
  return (
    <button onClick={onAdd}
      className="aspect-[3/4] rounded-xl flex flex-col items-center justify-center gap-2 flex-1 transition-all hover:brightness-110"
      style={{
        background: required ? 'rgba(255,203,5,0.05)' : 'rgba(255,255,255,0.03)',
        border: required ? '2px dashed rgba(255,203,5,0.30)' : '2px dashed rgba(255,255,255,0.12)',
      }}>
      {required ? (
        <>
          <ImageUp className="w-6 h-6 text-pokemon-yellow/60" />
          <span className="text-[10px] font-semibold text-pokemon-yellow/60">Photo principale</span>
          <span className="text-[9px] text-white/25">Obligatoire</span>
        </>
      ) : (
        <>
          <Plus className="w-5 h-5 text-white/25" />
          <span className="text-[10px] text-white/25">Photo {index + 1}</span>
          <span className="text-[9px] text-white/15">Optionnel</span>
        </>
      )}
    </button>
  )
}

/* ── Main component ──────────────────────────────────────────── */
export function ScanUpload() {
  const t = useT()
  const s = t.scan

  const [state, setState]           = useState<ScanState>('idle')
  const [previews, setPreviews]     = useState<(string | null)[]>([null, null, null])
  const [files, setFiles]           = useState<(File | null)[]>([null, null, null])
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult]         = useState<ScanResult | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [activeSlot, setActiveSlot] = useState(0)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [scanIdentification, setScanIdentification] = useState<Identification | null>(null)

  const fileRefs = [
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null),
    useRef<HTMLInputElement>(null), // camera
  ]

  const filledCount = files.filter(Boolean).length
  const hasFiles = filledCount > 0
  const isPreviewState = hasFiles && state === 'idle'

  const processFile = useCallback((file: File, slot: number) => {
    if (!file.type.startsWith('image/')) return
    setFiles(f => { const n = [...f]; n[slot] = file; return n })
    setPreviews(p => { const n = [...p]; n[slot] = URL.createObjectURL(file); return n })
    setState('idle')
  }, [])

  const addToSlot = (slot: number) => {
    setActiveSlot(slot)
    fileRefs[slot].current?.click()
  }

  const removeSlot = (slot: number) => {
    setFiles(f => { const n = [...f]; n[slot] = null; return n })
    setPreviews(p => { const n = [...p]; n[slot] = null; return n })
    if (fileRefs[slot].current) fileRefs[slot].current!.value = ''
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    const f = e.dataTransfer.files[0]; if (f) processFile(f, 0)
  }, [processFile])

  const startScan = async () => {
    const activeFiles = files.filter(Boolean) as File[]
    if (!activeFiles.length) return
    setState('scanning'); setErrorMsg('')
    try {
      const form = new FormData()
      activeFiles.forEach((f, i) => form.append(i === 0 ? 'image' : `image${i + 1}`, f))
      const res  = await fetch('/api/ai/scan', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Scan failed')

      const apiCandidates: Candidate[] = data.candidates ?? []
      setScanIdentification(data.identification ?? null)
      setCandidates(apiCandidates)

      if (apiCandidates.length >= 1) {
        setState('candidates')
      } else {
        setState('error')
        setErrorMsg('Carte non reconnue. Essayez avec une photo plus nette.')
      }
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Unknown error')
      setState('error')
    }
  }

  const selectCandidate = async (cardId: string) => {
    try {
      const res = await fetch(`/api/cards/${cardId}`)
      if (!res.ok) throw new Error('Card not found')
      const card = await res.json()

      // Build identification from scan result or fallback to card data
      const ident: Identification = scanIdentification ?? {
        cardName: card.name,
        cardNumber: card.number,
        setName: card.set?.name ?? '',
        setId: card.set?.externalId ?? '',
        language: 'FR',
        confidence: 100,
      }

      // Build dbMatch from card detail
      const cmPrice = card.prices?.find((p: any) => p.source === 'cardmarket') ?? card.prices?.[0] ?? null
      const price = Number(cmPrice?.market ?? 0)
      const md = card.marketData ?? null
      const ai = card.aiAnalysis ?? null

      const roi1y  = Number(md?.priceChange1y ?? 0)
      const roi90d = Number(ai?.predictedRoi90d ?? 0) * 4
      const rate   = roi1y !== 0 ? roi1y : roi90d !== 0 ? roi90d : 8
      const proj = price > 0 ? {
        y1: { value: Math.round(price * Math.pow(1 + rate / 100, 1)  * 100) / 100 },
        y3: { value: Math.round(price * Math.pow(1 + rate / 100, 3)  * 100) / 100 },
        y5: { value: Math.round(price * Math.pow(1 + rate / 100, 5)  * 100) / 100 },
        y10:{ value: Math.round(price * Math.pow(1 + rate / 100, 10) * 100) / 100 },
      } : null

      const pred365 = ai?.predictions?.find((p: any) => p.horizonDays === 365)

      const dbMatch: DbMatch = {
        id: card.id,
        name: card.name,
        number: card.number,
        rarity: card.rarity ?? '',
        imageUrl: card.imageLgUrl ?? card.imageSmUrl ?? null,
        set: { name: card.set?.name ?? '', externalId: card.set?.externalId ?? '', releaseDate: card.set?.releaseDate ?? null },
        price: price > 0 ? {
          market: price,
          low: Number(cmPrice?.low ?? 0),
          high: Number(cmPrice?.high ?? 0),
          currency: cmPrice?.currency ?? 'EUR',
        } : null,
        market: md ? {
          investmentScore: md.investmentScore ?? 0,
          rarityScore: md.rarityScore ?? 0,
          liquidityScore: md.liquidityScore ?? 0,
          trendDirection: md.trendDirection ?? '',
          change7d: Number(md.priceChange7d ?? 0),
          change30d: Number(md.priceChange30d ?? 0),
          change1y: Number(md.priceChange1y ?? 0),
          allTimeHigh: Number(md.allTimeHigh ?? 0),
          volatility: Number(md.volatility30d ?? 0),
        } : null,
        ai: ai ? {
          investmentScore: ai.investmentScore ?? 0,
          trendDirection: ai.trendDirection ?? '',
          bullishSignals: (ai.bullishSignals ?? []).slice(0, 3),
          bearishSignals: (ai.bearishSignals ?? []).slice(0, 2),
          keyInsight: ai.keyInsight ?? null,
          pred1y: pred365 ? {
            value: Number(pred365.predictedPrice),
            low: Number(pred365.lowerBound),
            high: Number(pred365.upperBound),
          } : null,
        } : null,
        projections: proj,
        annualGrowthRate: rate,
      }

      setResult({ identification: ident, dbMatch })
      setState('result')
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Failed to load card')
      setState('error')
    }
  }

  const reset = () => {
    setState('idle')
    setPreviews([null, null, null])
    setFiles([null, null, null])
    setResult(null); setErrorMsg(''); setCandidates([]); setScanIdentification(null)
    fileRefs.forEach(r => { if (r.current) r.current.value = '' })
  }

  const activePreviews = previews.filter(Boolean) as string[]

  return (
    <div className="w-full max-w-md mx-auto space-y-4">
      {/* Hidden file inputs */}
      {[0, 1, 2].map(i => (
        <input key={i} ref={fileRefs[i]} type="file" accept="image/*" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, i) }} />
      ))}
      <input ref={fileRefs[3]} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f, 0) }} />

      <AnimatePresence mode="wait">

        {/* IDLE / PREVIEW — not scanning, not result */}
        {(state === 'idle' || state === 'error') && (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">

            {/* Photo tips */}
            <PhotoTips compact={hasFiles} />

            {hasFiles ? (
              /* Multi-photo preview */
              <div className="space-y-3">
                <p className="text-xs text-white/40 font-medium">
                  {filledCount} photo{filledCount > 1 ? 's' : ''} ajoutée{filledCount > 1 ? 's' : ''} — plus vous en ajoutez, meilleure est l'identification
                </p>
                <div className="flex gap-2">
                  {[0, 1, 2].map(i => (
                    <PhotoSlot key={i} index={i} preview={previews[i]}
                      required={i === 0} onAdd={() => addToSlot(i)} onRemove={() => removeSlot(i)} />
                  ))}
                </div>
                <div className="flex gap-3 mt-2">
                  <button className="btn-primary flex-1 justify-center py-3 text-base rounded-xl font-bold" onClick={startScan}>
                    <Zap className="w-5 h-5" />
                    Analyser {filledCount > 1 ? `${filledCount} photos` : 'la carte'}
                  </button>
                  <button className="btn-ghost px-4 py-3 rounded-xl" onClick={reset}>
                    <RotateCcw className="w-4 h-4" />
                  </button>
                </div>
                <button onClick={() => fileRefs[3].current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 text-xs text-white/35 hover:text-white/55 transition-colors">
                  <Camera className="w-3.5 h-3.5" />
                  Prendre une photo directement
                </button>
              </div>
            ) : (
              /* Drop zone */
              <div
                className={`relative flex flex-col items-center justify-center min-h-52 p-6 cursor-pointer rounded-2xl transition-all ${isDragging ? 'drag-over' : ''}`}
                style={{ background: 'rgba(255,203,5,0.03)', border: '2px dashed rgba(255,203,5,0.25)' }}
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileRefs[0].current?.click()}
              >
                {['top-3 left-3 border-t-2 border-l-2', 'top-3 right-3 border-t-2 border-r-2',
                  'bottom-3 left-3 border-b-2 border-l-2', 'bottom-3 right-3 border-b-2 border-r-2'].map((cls, i) => (
                  <div key={i} className={`absolute w-5 h-5 border-pokemon-yellow/40 rounded-sm ${cls}`} />
                ))}
                <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }} className="mb-4">
                  <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
                    style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.25)' }}>
                    <ImageUp className="w-6 h-6 text-pokemon-yellow" />
                  </div>
                </motion.div>
                <p className="text-base font-bold text-white mb-1">Déposez une photo ici</p>
                <p className="text-xs text-white/40 text-center mb-4">ou utilisez les boutons ci-dessous</p>
                <div className="flex gap-2">
                  <button className="btn-primary px-4 py-2.5 text-sm rounded-xl"
                    onClick={e => { e.stopPropagation(); fileRefs[0].current?.click() }}>
                    <Upload className="w-4 h-4" />{s.upload}
                  </button>
                  <button className="btn-ghost px-4 py-2.5 text-sm rounded-xl"
                    onClick={e => { e.stopPropagation(); fileRefs[3].current?.click() }}>
                    <Camera className="w-4 h-4" />{s.camera}
                  </button>
                </div>
                <p className="text-[10px] text-white/25 mt-3">JPG, PNG, HEIC jusqu'à 10 MB</p>
              </div>
            )}

            {/* Error message */}
            {state === 'error' && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="glass-card p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{s.scanFailed}</p>
                  <p className="text-xs text-white/50">{errorMsg || s.scanFailedDesc}</p>
                  <p className="text-xs text-white/35 mt-1">
                    💡 Essayez avec une meilleure photo : bonne lumière, carte à plat, numéro visible
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* SCANNING */}
        {state === 'scanning' && activePreviews.length > 0 && (
          <motion.div key="scanning" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="relative rounded-2xl overflow-hidden" style={{ border: '2px solid rgba(59,130,246,0.7)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={activePreviews[0]} alt="Scanning" className="w-full object-contain max-h-80" />
              <ScanBeamOverlay count={filledCount} />
            </div>
            {activePreviews.length > 1 && (
              <div className="flex gap-2 mt-2">
                {activePreviews.slice(1).map((p, i) => (
                  <div key={i} className="w-16 h-20 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ border: '1px solid rgba(59,130,246,0.3)', opacity: 0.6 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="w-full h-full object-cover" />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 glass-card px-4 py-3 flex items-center gap-3">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, ease: 'linear', repeat: Infinity }}
                className="w-5 h-5 rounded-full border-2 border-pokemon-yellow border-t-transparent flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-white">{s.analyzing}</p>
                <p className="text-xs text-white/50">
                  {filledCount > 1 ? `Analyse de ${filledCount} photos pour une identification optimale…` : s.analyzingDetail}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* CANDIDATES */}
        {state === 'candidates' && scanIdentification && (
          <motion.div key="candidates" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CandidatePicker
              candidates={candidates}
              identification={scanIdentification}
              onSelect={selectCandidate}
              onReset={reset}
            />
          </motion.div>
        )}

        {/* RESULT */}
        {state === 'result' && result && activePreviews.length > 0 && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ResultPanel result={result} previews={activePreviews} onReset={reset} s={s} />
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
