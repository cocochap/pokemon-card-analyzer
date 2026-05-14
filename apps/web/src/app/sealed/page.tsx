'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Archive, Search, ScanLine, TrendingUp, Package } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

const TYPE_LABELS: Record<string, string> = {
  BOOSTER_BOX: '📦 Display', ETB: '🎁 ETB', COFFRET: '🎴 Coffret',
  COLLECTION: '⭐ Collection', TIN: '🥫 Tin', BUNDLE: '🎯 Bundle', BLISTER: '📋 Blister',
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

function ProductCard({ product }: { product: any }) {
  const marketPrice = product.currentMarketPrice ?? product.retailPrice ?? 0
  const retailPrice = product.retailPrice ?? 0
  const roi = retailPrice > 0 && marketPrice ? Math.round(((marketPrice - retailPrice) / retailPrice) * 100) : null
  const score = Math.round(product.investmentScore ?? 0)
  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#FFCB05' : '#F59E0B'

  return (
    <Link href={`/sealed/${product.slug}`}>
      <motion.div
        whileHover={{ y: -2, transition: { duration: 0.15 } }}
        className="glass-card p-4 h-full flex flex-col gap-3 cursor-pointer"
        style={score >= 85 ? { border: '1px solid rgba(255,203,5,0.2)' } : {}}>

        {/* Header */}
        <div className="flex items-start gap-2.5">
          <div className="text-2xl flex-shrink-0">{TYPE_LABELS[product.type]?.split(' ')[0] ?? '📦'}</div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
              {product.isDiscontinued && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.10)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.20)' }}>
                  Discontinué
                </span>
              )}
              <span className="text-[9px] text-white/35">{TYPE_LABELS[product.type]?.split(' ').slice(1).join(' ') ?? product.type}</span>
            </div>
            <p className="font-semibold text-white text-sm leading-tight line-clamp-2">
              {product.nameFr ?? product.name}
            </p>
            {product.setName && <p className="text-[10px] text-white/35 mt-0.5">{product.setName}</p>}
          </div>
        </div>

        {/* Score bar */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-white/35">Score invest.</span>
            <span className="text-[10px] font-bold font-mono" style={{ color: scoreColor }}>{score}/100</span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, background: scoreColor }} />
          </div>
        </div>

        {/* Prices */}
        <div className="grid grid-cols-3 gap-1.5 mt-auto">
          <div className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <p className="text-[8px] text-white/25 mb-0.5">Retail</p>
            <p className="text-[10px] font-bold font-mono text-white/55">€{retailPrice}</p>
          </div>
          <div className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.12)' }}>
            <p className="text-[8px] text-white/25 mb-0.5">Marché</p>
            <p className="text-[10px] font-bold font-mono text-pokemon-yellow">€{Math.round(marketPrice)}</p>
          </div>
          <div className="rounded-lg p-1.5 text-center"
            style={{ background: roi && roi > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)', border: roi && roi > 0 ? '1px solid rgba(34,197,94,0.15)' : 'none' }}>
            <p className="text-[8px] text-white/25 mb-0.5">ROI</p>
            <p className="text-[10px] font-bold font-mono" style={{ color: roi && roi > 0 ? '#22C55E' : 'rgba(255,255,255,0.35)' }}>
              {roi !== null ? `+${roi}%` : '—'}
            </p>
          </div>
        </div>
      </motion.div>
    </Link>
  )
}

export default function SealedPage() {
  const [typeFilter, setTypeFilter] = useState('all')
  const [discontinued, setDiscontinued] = useState<'all' | 'true' | 'false'>('all')
  const [search, setSearch] = useState('')

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['sealed-browse', typeFilter, discontinued],
    queryFn: () => {
      const p = new URLSearchParams({ sort: 'score' })
      if (typeFilter !== 'all') p.set('type', typeFilter)
      if (discontinued !== 'all') p.set('discontinued', discontinued)
      return fetch(`/api/sealed?${p}`).then(r => r.json())
    },
    staleTime: 60_000,
  })

  const filtered = search
    ? products.filter((p: any) =>
        (p.nameFr ?? p.name).toLowerCase().includes(search.toLowerCase()) ||
        p.setName?.toLowerCase().includes(search.toLowerCase()))
    : products

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-10 max-w-[1600px]">

        {/* Hero */}
        <div className="text-center mb-10">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5"
            style={{ background: 'rgba(167,139,250,0.10)', border: '1px solid rgba(167,139,250,0.25)', color: '#A78BFA' }}>
            <Archive className="w-4 h-4" />
            Coffrets Scellés Pokémon TCG
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 }}
            className="text-3xl md:text-5xl font-bold tracking-tight mb-3 text-white">
            Investir dans les{' '}
            <span style={{ background: 'linear-gradient(135deg,#A78BFA,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              coffrets scellés
            </span>
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.12 }}
            className="text-white/50 text-lg max-w-xl mx-auto mb-6">
            Prix marché en temps réel, ROI vs retail, analyses expert — {(products as any[]).length} coffrets analysés
          </motion.p>

          {/* Quick actions */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.18 }}
            className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/sealed/scan"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#A78BFA,#8B5CF6)', color: '#fff' }}>
              <ScanLine className="w-4 h-4" />
              Scanner un coffret
            </Link>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Rechercher un coffret…"
                className="pl-9 pr-4 py-2.5 rounded-xl text-sm text-white outline-none w-64"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }} />
            </div>
          </motion.div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: 'Coffrets analysés', value: (products as any[]).length, icon: Package, color: '#A78BFA' },
            { label: 'Coffrets discontinués', value: (products as any[]).filter((p: any) => p.isDiscontinued).length, icon: Archive, color: '#EF4444' },
            { label: 'ROI moyen (discontinués)', value: Math.round((products as any[]).filter((p: any) => p.isDiscontinued && p.currentMarketPrice && p.retailPrice).reduce((s: number, p: any) => s + ((p.currentMarketPrice - p.retailPrice) / p.retailPrice * 100), 0) / Math.max(1, (products as any[]).filter((p: any) => p.isDiscontinued && p.currentMarketPrice && p.retailPrice).length)) + '%', icon: TrendingUp, color: '#22C55E' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="glass-card p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
                <Icon className="w-4 h-4" style={{ color }} />
              </div>
              <div>
                <p className="text-xl font-bold font-mono" style={{ color }}>{value}</p>
                <p className="text-xs text-white/40">{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4">
          {FILTERS.map(f => (
            <button key={f.key} onClick={() => setTypeFilter(f.key)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={typeFilter === f.key
                ? { background: 'rgba(167,139,250,0.12)', border: '1px solid rgba(167,139,250,0.3)', color: '#A78BFA' }
                : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.45)' }}>
              {f.label}
            </button>
          ))}
          <div className="flex gap-1.5 ml-auto">
            {([['all', 'Tous'], ['true', 'Discontinués'], ['false', 'Disponibles']] as const).map(([val, label]) => (
              <button key={val} onClick={() => setDiscontinued(val)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
                style={discontinued === val
                  ? { background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#EF4444' }
                  : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)' }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {Array(18).fill(null).map((_, i) => <div key={i} className="skeleton h-48 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((p: any, i: number) => (
              <motion.div key={p.id ?? p.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.4) }}>
                <ProductCard product={p} />
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
