'use client'

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle, ArrowDownRight, ArrowUpRight,
  Copy, ExternalLink, ImageUp, Link2, Loader2, MessageSquare,
  RefreshCcw, ShoppingBag, Sparkles, TrendingDown, TrendingUp, X, Zap,
} from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { clsx } from 'clsx'
import { formatCurrency } from '@/lib/formatters'

type DealState = 'idle' | 'loading' | 'result' | 'error'

interface DealResult {
  ai: {
    cardName: string; englishName: string; cardNumber: string
    setName: string; condition: string; listingPrice: number
    currency: string; listingTitle: string
  }
  card: {
    id: string; name: string; number: string; rarity: string
    imageUrl: string | null; set: { name: string; externalId: string; logoUrl: string | null }
    marketPrice: number; marketLow: number; marketHigh: number
    change7d: number; change30d: number; trendDirection: string
    investmentScore: number; allTimeHigh: number
  } | null
  deal: {
    score: number; label: string; emoji: string
    savingsEur: number; savingsPct: number
    adjustedMarket: number; suggestedPrice: number | null
    conditionMultiplier: number
  } | null
  noMarketPrice: boolean
  listingUrl: string | null
  listingPlatform: string | null
  listingImageUrl: string | null
}

// ── Card photo (DB image > listing image > placeholder) ──────────────────────
function CardPhoto({ result, size = 150 }: { result: DealResult; size?: number }) {
  const imgSrc = result.card?.imageUrl ?? result.listingImageUrl
  const isListing = !result.card?.imageUrl && !!result.listingImageUrl
  const h = Math.round(size * 1.4)
  if (!imgSrc) return (
    <div className="rounded-xl flex items-center justify-center shrink-0"
      style={{ width: size, height: h, background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.12)' }}>
      <ShoppingBag className="w-8 h-8 text-white/15" />
    </div>
  )
  return (
    <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200 }}
      className="relative shrink-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={imgSrc} alt={result.card?.name ?? result.ai.cardName}
        className="rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
        style={{ width: size, height: h, objectFit: isListing ? 'contain' : 'cover',
          border: '1px solid rgba(255,255,255,0.12)', background: '#0a0e1a' }} />
      {isListing && (
        <span className="absolute bottom-1.5 left-1/2 -translate-x-1/2 text-[9px] px-1.5 py-0.5 rounded-full whitespace-nowrap"
          style={{ background: 'rgba(0,0,0,0.75)', color: 'rgba(255,255,255,0.45)' }}>
          photo annonce
        </span>
      )}
    </motion.div>
  )
}

// ── Deal score ring ───────────────────────────────────────────────────────────
function DealScoreRing({ score, label, emoji }: { score: number; label: string; emoji: string }) {
  const r = 54; const circ = 2 * Math.PI * r
  const color =
    score >= 82 ? '#22C55E' :
    score >= 66 ? '#86EFAC' :
    score >= 48 ? '#FFCB05' :
    score >= 30 ? '#F97316' : '#EF4444'
  const bgColor =
    score >= 82 ? 'rgba(34,197,94,0.08)' :
    score >= 66 ? 'rgba(134,239,172,0.08)' :
    score >= 48 ? 'rgba(255,203,5,0.08)' :
    score >= 30 ? 'rgba(249,115,22,0.08)' : 'rgba(239,68,68,0.08)'

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative w-36 h-36" style={{ background: bgColor, borderRadius: '50%' }}>
        <svg className="w-full h-full -rotate-90" viewBox="0 0 130 130">
          <circle cx="65" cy="65" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          <motion.circle
            cx="65" cy="65" r={r} fill="none"
            stroke={color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: circ - (score / 100) * circ }}
            transition={{ duration: 1.4, ease: 'easeOut', delay: 0.2 }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
          <motion.span
            className="text-3xl font-black font-mono"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: 'spring' }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-white/40 font-mono">/100</span>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="text-center"
      >
        <div className="text-xl">{emoji}</div>
        <div className="text-sm font-bold mt-1" style={{ color }}>{label}</div>
      </motion.div>
    </div>
  )
}

// ── Price bar ─────────────────────────────────────────────────────────────────
function PriceBar({ listing, market, low, high }: { listing: number; market: number; low: number; high: number }) {
  const min = Math.min(low * 0.8, listing * 0.8)
  const max = Math.max(high * 1.2, listing * 1.2, market * 1.2)
  const toPos = (v: number) => Math.max(2, Math.min(98, ((v - min) / (max - min)) * 100))

  const listingPos = toPos(listing)
  const marketPos = toPos(market)
  const lowPos = toPos(low || market * 0.8)
  const highPos = toPos(high || market * 1.2)

  return (
    <div className="space-y-3">
      <div className="relative h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        {/* Market range */}
        <motion.div
          className="absolute h-full rounded-full"
          style={{ left: `${lowPos}%`, width: `${highPos - lowPos}%`, background: 'rgba(255,203,5,0.15)' }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.3, duration: 0.8 }}
        />
        {/* Market price indicator */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-pokemon-yellow/80 z-10" style={{ left: `${marketPos}%` }} />
        {/* Listing price indicator */}
        <motion.div
          className="absolute top-0 bottom-0 w-1 rounded-full z-20"
          style={{ left: `${listingPos}%`, background: listing <= market ? '#22C55E' : '#EF4444' }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/40">
        <span>Bas marché {formatCurrency(low || market * 0.8)}</span>
        <span>Haut marché {formatCurrency(high || market * 1.2)}</span>
      </div>
    </div>
  )
}

// ── Negotiate button / message ────────────────────────────────────────────────
function NegotiateSection({ result }: { result: DealResult }) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/deal/negotiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardName: result.card?.name ?? result.ai.cardName,
          listingPrice: result.ai.listingPrice,
          marketPrice: result.card?.marketPrice ?? 0,
          condition: result.ai.condition,
          listingTitle: result.ai.listingTitle,
          dealScore: result.deal?.score ?? 50,
        }),
      })
      const data = await res.json()
      if (data.ok) setMessage(data.message)
    } finally { setLoading(false) }
  }

  const copy = () => {
    if (!message) return
    navigator.clipboard.writeText(message)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      {!message ? (
        <button
          onClick={generate}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all"
          style={{ background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.25)', color: '#A78BFA' }}
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Génération en cours…</>
            : <><MessageSquare className="w-4 h-4" /> Générer un message de négociation</>}
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-4 space-y-3"
          style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.20)' }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
              <Sparkles className="w-3.5 h-3.5" />
              Message IA prêt à envoyer
            </div>
            <button onClick={() => setMessage(null)} className="text-white/30 hover:text-white/60 transition-colors">
              <RefreshCcw className="w-3.5 h-3.5" />
            </button>
          </div>
          <p className="text-sm text-white/80 leading-relaxed italic">"{message}"</p>
          <button
            onClick={copy}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
              copied
                ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                : 'bg-white/8 text-white/70 border border-white/10 hover:bg-white/12'
            )}
          >
            <Copy className="w-4 h-4" />
            {copied ? 'Copié !' : 'Copier le message'}
          </button>
        </motion.div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
export function DealAnalyzer() {
  const [state, setState] = useState<DealState>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<DealResult | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [url, setUrl] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const fileRef2 = useRef<File | null>(null)

  const processFile = useCallback((file: File) => {
    fileRef2.current = file
    const reader = new FileReader()
    reader.onload = e => setPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setState('idle')
    setResult(null)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type.startsWith('image/')) processFile(file)
  }, [processFile])

  const canAnalyze = !!url.trim() || !!fileRef2.current

  const analyze = async () => {
    if (!canAnalyze) return
    setState('loading'); setErrorMsg('')
    try {
      const form = new FormData()
      if (fileRef2.current) form.append('image', fileRef2.current)
      if (url.trim()) form.append('url', url.trim())
      const res = await fetch('/api/ai/deal', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'Analyse échouée')
      setResult(data)
      setState('result')
    } catch (e: any) {
      setErrorMsg(e.message ?? 'Erreur inconnue')
      setState('error')
    }
  }

  const reset = () => {
    setState('idle'); setPreview(null); setResult(null)
    setErrorMsg(''); fileRef2.current = null; setUrl('')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Upload zone */}
      {(state === 'idle' || state === 'error') && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          {/* URL — input principal */}
          <div className="space-y-2 mb-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Link2 className="w-4 h-4 text-pokemon-yellow/60" />
              </div>
              <input
                type="url"
                value={url}
                onChange={e => { setUrl(e.target.value); setResult(null); setErrorMsg('') }}
                onKeyDown={e => { if (e.key === 'Enter' && canAnalyze) analyze() }}
                placeholder="Colle le lien Vinted / eBay / LeBonCoin…"
                className="w-full pl-9 pr-4 py-3.5 rounded-xl text-sm text-white/90 placeholder-white/30 focus:outline-none transition-colors"
                style={{ background: 'rgba(255,255,255,0.06)', border: `1px solid ${url ? 'rgba(255,203,5,0.5)' : 'rgba(255,255,255,0.12)'}` }}
                autoFocus
              />
            </div>
            <p className="text-[11px] text-white/30 text-center">
              ou glisse un screenshot ci-dessous
            </p>
          </div>

          {/* Drop zone — secondaire */}
          <div
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            className="relative cursor-pointer rounded-2xl border-2 border-dashed transition-all hover:border-white/30"
            style={{ borderColor: preview ? 'rgba(255,203,5,0.4)' : 'rgba(255,255,255,0.10)', background: 'rgba(255,255,255,0.02)' }}
          >
            {preview ? (
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Screenshot" className="w-full max-h-60 object-contain rounded-2xl" />
                <button
                  onClick={e => { e.stopPropagation(); setPreview(null); fileRef2.current = null }}
                  className="absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.7)', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 py-6 px-8">
                <ImageUp className="w-5 h-5 text-white/25" />
                <p className="text-xs text-white/30">Screenshot de l'annonce (optionnel)</p>
              </div>
            )}
            <input
              ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
            />
          </div>

          {state === 'error' && (
            <div className="mt-3 p-3 rounded-xl flex items-start gap-2"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-300">{errorMsg || 'Analyse échouée. Réessaie avec un lien ou screenshot plus net.'}</p>
            </div>
          )}

          {canAnalyze && (
            <motion.button
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              onClick={analyze}
              className="w-full mt-3 py-3.5 rounded-xl font-bold text-base text-black transition-all hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, #FFCB05, #F59E0B)' }}
            >
              <Sparkles className="w-5 h-5" />
              Analyser ce deal
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Loading */}
      {state === 'loading' && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="glass-card p-12 flex flex-col items-center gap-6"
        >
          {preview && (
            <div className="relative w-full max-h-40 overflow-hidden rounded-xl opacity-40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview} alt="" className="w-full object-contain max-h-40" />
              <motion.div
                className="absolute left-0 right-0 h-1"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.9), transparent)', boxShadow: '0 0 20px rgba(255,203,5,0.8)' }}
                animate={{ top: ['0%', '100%'] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
              />
            </div>
          )}
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-pokemon-yellow animate-spin" />
            <div className="text-center">
              <p className="text-sm font-semibold text-white/80">Analyse en cours…</p>
              <p className="text-xs text-white/40 mt-1">Identification de la carte · Lecture du prix · Calcul du deal</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Result */}
      {state === 'result' && result && (
        <AnimatePresence>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

            {/* Card identified */}
            <div className="glass-card p-4">
              <div className="flex items-start gap-4">
                {/* Card image — large */}
                <CardPhoto result={result} size={150} />

                {/* Card info */}
                <div className="min-w-0 flex-1 space-y-2 pt-1">
                  <div>
                    <p className="text-xs text-white/40 uppercase tracking-wider font-semibold mb-1">Carte identifiée</p>
                    <h3 className="font-bold text-xl leading-tight">{result.card?.name ?? result.ai.englishName ?? result.ai.cardName}</h3>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {result.card?.set.logoUrl && (
                      <Image src={result.card.set.logoUrl} alt="" width={16} height={16} className="h-4 w-auto" />
                    )}
                    <span className="text-sm text-white/55">{result.card?.set.name ?? result.ai.setName}</span>
                    {result.ai.cardNumber && (
                      <span className="text-sm text-white/35 font-mono">#{result.ai.cardNumber}</span>
                    )}
                  </div>

                  {result.ai.condition && (
                    <span className="inline-block text-xs px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.1)' }}>
                      {result.ai.condition}
                    </span>
                  )}

                  <div className="flex flex-col gap-1.5 pt-1">
                    {result.card && (
                      <Link href={`/cards/${result.card.id}`}
                        className="flex items-center gap-1.5 text-xs font-semibold text-pokemon-yellow/80 hover:text-pokemon-yellow transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" />
                        Voir l'analyse complète
                      </Link>
                    )}
                    {result.listingUrl && (
                      <a href={result.listingUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs font-semibold text-blue-400/80 hover:text-blue-400 transition-colors">
                        <Link2 className="w-3.5 h-3.5" />
                        Voir l'annonce {result.listingPlatform ?? ''}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Deal score + price comparison */}
            {result.deal ? (
              <div className="glass-card p-5 space-y-5">
                <p className="text-xs text-white/40 uppercase tracking-wider font-semibold">Analyse du deal</p>

                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                  {/* Score ring */}
                  <DealScoreRing
                    score={result.deal.score}
                    label={result.deal.label}
                    emoji={result.deal.emoji}
                  />

                  {/* Price details */}
                  <div className="flex-1 space-y-4 min-w-0">
                    {/* Prix listing */}
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/50">Prix annonce</span>
                      <span className="text-xl font-black font-mono">{formatCurrency(result.ai.listingPrice)}</span>
                    </div>

                    {/* Prix marché */}
                    {result.card && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-white/50">Prix CardMarket</span>
                        <div className="text-right">
                          <div className="text-base font-bold font-mono text-pokemon-yellow">
                            {formatCurrency(result.card.marketPrice)}
                          </div>
                          {result.deal.conditionMultiplier < 0.99 && (
                            <div className="text-xs text-white/35">
                              ajusté état : {formatCurrency(result.deal.adjustedMarket)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Écart */}
                    <div className={clsx(
                      'flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold',
                      result.deal.savingsEur >= 0
                        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                        : 'bg-red-500/10 text-red-400 border border-red-500/20'
                    )}>
                      {result.deal.savingsEur >= 0
                        ? <><ArrowDownRight className="w-4 h-4" /> Économie de {formatCurrency(Math.abs(result.deal.savingsEur))} ({Math.abs(result.deal.savingsPct).toFixed(1)}% sous le marché)</>
                        : <><ArrowUpRight className="w-4 h-4" /> {formatCurrency(Math.abs(result.deal.savingsEur))} au-dessus du marché ({Math.abs(result.deal.savingsPct).toFixed(1)}%)</>
                      }
                    </div>

                    {/* Prix suggéré */}
                    {result.deal.suggestedPrice && (
                      <div className="text-xs text-white/45 flex items-center gap-1.5">
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        Prix de négociation suggéré : <span className="text-white/70 font-semibold">{formatCurrency(result.deal.suggestedPrice)}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Price bar */}
                {result.card && result.card.marketLow > 0 && (
                  <PriceBar
                    listing={result.ai.listingPrice}
                    market={result.card.marketPrice}
                    low={result.card.marketLow}
                    high={result.card.marketHigh}
                  />
                )}

                {/* Market trend */}
                {result.card && (result.card.change7d !== 0 || result.card.change30d !== 0) && (
                  <div className="grid grid-cols-2 gap-2">
                    {[{ label: '7j', val: result.card.change7d }, { label: '30j', val: result.card.change30d }].map(({ label, val }) => (
                      <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl"
                        style={{ background: 'rgba(255,255,255,0.04)' }}>
                        <span className="text-xs text-white/40">{label}</span>
                        <span className={clsx('flex items-center gap-0.5 text-xs font-bold', val >= 0 ? 'text-green-400' : 'text-red-400')}>
                          {val >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {val > 0 ? '+' : ''}{val.toFixed(1)}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : result.noMarketPrice ? (
              <div className="glass-card p-4 flex items-start gap-3">
                <AlertTriangle className="w-4 h-4 text-pokemon-yellow shrink-0 mt-0.5" />
                <p className="text-sm text-white/60">
                  Prix marché introuvable pour cette carte. Le deal ne peut pas être calculé, mais tu peux quand même générer un message de négociation.
                </p>
              </div>
            ) : (
              <div className="glass-card p-4">
                <p className="text-sm text-white/50">Prix annonce non détecté dans le screenshot. Essaie avec une photo qui montre clairement le prix de l'annonce.</p>
              </div>
            )}

            {/* Negotiation */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-400" />
                <p className="text-sm font-semibold">Message de négociation</p>
              </div>
              <NegotiateSection result={result} />
            </div>

            {/* Actions */}
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold border border-white/10 text-white/60 hover:text-white/80 transition-colors"
            >
              <RefreshCcw className="w-4 h-4" />
              Analyser une autre annonce
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}
