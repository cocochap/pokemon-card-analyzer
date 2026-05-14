'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Archive, Lock, Search, ScanLine, TrendingUp, Package, Zap } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useUserTier } from '@/lib/useUserTier'

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

function getSetCode(slug: string): string | null {
  if (slug.includes('sv8a')) return 'sv8a'
  if (slug.includes('celebrations') || slug.includes('cel25')) return 'cel25'
  if (slug.includes('swsh125')) return 'swsh12pt5'
  if (slug.includes('swsh12') && !slug.includes('swsh125')) return 'swsh12'
  if (slug.includes('swsh11')) return 'swsh11'
  if (slug.includes('swsh10')) return 'swsh10'
  if (slug.includes('swsh7')) return 'swsh7'
  if (slug.includes('swsh4')) return 'swsh4'
  if (slug.includes('swsh1') && !slug.match(/swsh1[0-9]/)) return 'swsh1'
  if (slug.includes('sv75') || slug.includes('etincelles')) return 'sv8'
  if (slug.includes('sv7') && !slug.includes('sv75')) return 'sv7'
  if (slug.includes('sv65') || slug.includes('destins-paldea')) return 'sv6pt5'
  if (slug.includes('sv6') && !slug.includes('sv65')) return 'sv6'
  if (slug.includes('sv5')) return 'sv5'
  if (slug.includes('sv45') || slug.includes('destinees')) return 'sv4pt5'
  if (slug.includes('sv4') && !slug.includes('sv45')) return 'sv4'
  if (slug.includes('sv35') || slug.includes('-151-') || slug.endsWith('-151')) return 'sv3pt5'
  if (slug.includes('sv3') && !slug.includes('sv35')) return 'sv3'
  if (slug.includes('sv2')) return 'sv2'
  if (slug.includes('sv1') && !slug.match(/sv1[0-9]/)) return 'sv1'
  if (slug.includes('xy12') || slug.includes('evolutions-xy')) return 'xy12'
  if (slug.includes('base-set') || (slug.includes('base') && slug.includes('vintage'))) return 'base1'
  if (slug.includes('jungle')) return 'base2'
  if (slug.includes('fossile')) return 'base3'
  if (slug.includes('neo-genesis')) return 'neo1'
  if (slug.includes('pokemon-go')) return 'pgo'
  if (slug.includes('vmax-climax') || slug.includes('shiny-treasure') || slug.includes('paldean-fates')) return 'sv4pt5'
  return null
}

function getSeriesBg(series?: string): string {
  if (series?.includes('Écarlate')) return 'linear-gradient(135deg,rgba(124,58,237,0.28) 0%,rgba(49,27,146,0.40) 100%)'
  if (series?.includes('Épée')) return 'linear-gradient(135deg,rgba(14,165,233,0.25) 0%,rgba(30,64,175,0.38) 100%)'
  if (series === 'XY') return 'linear-gradient(135deg,rgba(239,68,68,0.22) 0%,rgba(245,158,11,0.28) 100%)'
  if (series === 'Base Set' || series === 'Neo') return 'linear-gradient(135deg,rgba(245,158,11,0.32) 0%,rgba(120,60,5,0.30) 100%)'
  if (series === 'Japonais') return 'linear-gradient(135deg,rgba(239,68,68,0.22) 0%,rgba(30,27,75,0.45) 100%)'
  return 'linear-gradient(135deg,rgba(167,139,250,0.18) 0%,rgba(99,102,241,0.25) 100%)'
}

function ProductCard({ product, isPremium }: { product: any; isPremium: boolean }) {
  const marketPrice = product.currentMarketPrice ?? product.retailPrice ?? 0
  const retailPrice = product.retailPrice ?? 0
  const roi = retailPrice > 0 && marketPrice ? Math.round(((marketPrice - retailPrice) / retailPrice) * 100) : null
  const score = Math.round(product.investmentScore ?? 0)
  const scoreColor = score >= 85 ? '#22C55E' : score >= 70 ? '#FFCB05' : '#F59E0B'

  const setCode = getSetCode(product.slug ?? '')
  const logoUrl = product.imageUrl ?? (setCode ? `https://images.pokemontcg.io/${setCode}/logo.png` : null)

  return (
    <Link href={`/sealed/${product.slug}`}>
      <motion.div
        whileHover={{ y: -3, transition: { duration: 0.15 } }}
        className="glass-card overflow-hidden h-full flex flex-col cursor-pointer"
        style={score >= 85 ? { border: '1px solid rgba(255,203,5,0.22)' } : {}}>

        {/* Image area */}
        <div className="relative w-full aspect-[16/9] flex items-center justify-center overflow-hidden"
          style={{ background: getSeriesBg(product.series) }}>
          {logoUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={logoUrl} alt={product.setName ?? product.name}
              className="h-14 object-contain drop-shadow-lg opacity-90"
              onError={(e) => { e.currentTarget.style.display = 'none' }}
            />
          ) : (
            <span className="text-4xl opacity-50">{TYPE_LABELS[product.type]?.split(' ')[0] ?? '📦'}</span>
          )}
          {product.isDiscontinued && (
            <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: 'rgba(239,68,68,0.85)', color: 'white' }}>
              Discontinué
            </div>
          )}
          {product.language && product.language !== 'FR' && (
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full text-[9px] font-bold"
              style={{ background: 'rgba(167,139,250,0.85)', color: 'white' }}>
              {product.language}
            </div>
          )}
        </div>

        {/* Info area */}
        <div className="p-3 flex flex-col gap-2.5 flex-1">
          <div>
            <p className="text-[9px] text-white/30 mb-0.5">{TYPE_LABELS[product.type]?.split(' ').slice(1).join(' ') ?? product.type}</p>
            <p className="font-semibold text-white text-sm leading-tight line-clamp-2">
              {product.nameFr ?? product.name}
            </p>
            {product.setName && <p className="text-[9px] text-white/30 mt-0.5">{product.setName}</p>}
          </div>

          {/* Score bar */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-white/30">Score invest.</span>
              <span className="text-[10px] font-bold font-mono" style={{ color: scoreColor }}>{score}/100</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full" style={{ width: `${score}%`, background: scoreColor }} />
            </div>
          </div>

          {/* Prices */}
          <div className="grid grid-cols-3 gap-1 mt-auto">
            <div className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
              <p className="text-[7px] text-white/25 mb-0.5">Retail</p>
              <p className="text-[9px] font-bold font-mono text-white/50">€{retailPrice}</p>
            </div>
            <div className="rounded-lg p-1.5 text-center" style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.12)' }}>
              <p className="text-[7px] text-white/25 mb-0.5">Marché</p>
              <p className="text-[9px] font-bold font-mono text-pokemon-yellow">€{Math.round(marketPrice)}</p>
            </div>
            <div className="rounded-lg p-1.5 text-center relative"
              style={{
                background: roi && roi > 0 ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.03)',
                border: roi && roi > 0 ? '1px solid rgba(34,197,94,0.15)' : 'none',
              }}>
              <p className="text-[7px] text-white/25 mb-0.5">ROI</p>
              {isPremium ? (
                <p className="text-[9px] font-bold font-mono" style={{ color: roi && roi > 0 ? '#22C55E' : 'rgba(255,255,255,0.35)' }}>
                  {roi !== null ? `+${roi}%` : '—'}
                </p>
              ) : (
                <Lock className="w-3 h-3 mx-auto text-white/25" />
              )}
            </div>
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
  const { isPremium } = useUserTier()

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

        {/* Premium banner for FREE users */}
        {!isPremium && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-center gap-3 px-5 py-3 rounded-2xl mb-6"
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.20)' }}>
            <Lock className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <p className="text-sm text-white/60 flex-1">
              Le ROI, l'analyse expert et l'ajout en collection sont réservés aux membres <span className="text-violet-400 font-semibold">Premium</span>.
            </p>
            <Link href="/pricing"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold flex-shrink-0 hover:brightness-110"
              style={{ background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.30)', color: '#A78BFA' }}>
              <Zap className="w-3 h-3" /> Passer Premium
            </Link>
          </motion.div>
        )}

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
            {Array(18).fill(null).map((_, i) => <div key={i} className="skeleton h-52 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((p: any, i: number) => (
              <motion.div key={p.id ?? p.slug}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.35) }}>
                <ProductCard product={p} isPremium={isPremium} />
              </motion.div>
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
