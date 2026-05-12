'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Camera, CheckCircle2, Play, Sparkles, Star, TrendingUp, Zap } from 'lucide-react'
import { useT } from '@/lib/i18n/LanguageContext'

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 28 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.55, ease: 'easeOut', delay },
})

const fadeIn = (delay = 0) => ({
  initial:    { opacity: 0 },
  animate:    { opacity: 1 },
  transition: { duration: 0.5, delay },
})

function AnalysisOverlay({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <div className="absolute -right-4 top-8 w-48 glass-card p-3 border border-electric-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-2 h-2 rounded-full bg-electric-400 animate-pulse" />
        <span className="text-xs font-semibold text-electric-300">{t.card.aiAnalysis}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{t.scan.psaGrade}</span>
          <span className="text-xs font-bold text-gold-400">PSA 9</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{t.ai.confidence}</span>
          <span className="text-xs font-bold text-green-400">94%</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{t.scan.marketValue}</span>
          <span className="text-xs font-bold text-white">€ 280</span>
        </div>
        <div className="mt-2 pt-2 border-t border-white/[0.06]">
          <div className="flex items-center gap-1 text-green-400">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs font-medium">+18.4% {t.market.change30d}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function RarityOverlay({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <div className="absolute -left-4 bottom-16 w-44 glass-card p-3 border border-gold-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <div className="flex items-center gap-2 mb-2">
        <Star className="w-3 h-3 text-gold-400 fill-gold-400" />
        <span className="text-xs font-semibold text-gold-300">{t.card.rarity} Score</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded-full" style={{ width: '88%' }} />
        </div>
        <span className="text-xs font-bold text-gold-400">88/100</span>
      </div>
      <p className="text-xs text-muted-foreground mt-1.5">{t.rarity.RARE_HOLO} · Base Set</p>
    </div>
  )
}

function CardMockup({ t }: { t: ReturnType<typeof useT> }) {
  return (
    <div className="relative w-full max-w-sm mx-auto select-none">
      <div className="absolute inset-0 -z-10 blur-[60px]">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-electric-600/30" />
        <div className="absolute top-8 right-8 w-32 h-32 rounded-full bg-gold-500/20" />
      </div>

      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, ease: 'easeInOut', repeat: Infinity }}
        className="relative mx-auto w-52"
        style={{ filter: 'drop-shadow(0 40px 80px rgba(0,0,0,0.8)) drop-shadow(0 0 40px rgba(59,130,246,0.25))' }}
      >
        <div
          className="rounded-2xl overflow-hidden border-2 relative"
          style={{ borderColor: 'rgba(245,158,11,0.6)', boxShadow: '0 0 0 1px rgba(255,255,255,0.08), 0 0 30px rgba(245,158,11,0.3)' }}
        >
          <div className="absolute inset-0 z-10 holo-shimmer opacity-60 pointer-events-none rounded-2xl" />
          {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2',
            'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((cls, i) => (
            <div key={i} className={`absolute w-4 h-4 z-20 rounded-sm border-electric-400/80 ${cls}`} />
          ))}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://images.pokemontcg.io/base1/4.png" alt="Charizard card" className="w-full block" style={{ aspectRatio: '2.5/3.5' }} />
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, duration: 0.5 }}>
        <AnalysisOverlay t={t} />
      </motion.div>
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1.1, duration: 0.5 }}>
        <RarityOverlay t={t} />
      </motion.div>
    </div>
  )
}

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium"
      style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.18)', color: 'rgba(147,197,253,1)' }}>
      {icon}
      {label}
    </div>
  )
}

export function HeroSection() {
  const t = useT()
  const h = t.hero

  return (
    <section className="relative py-10 md:py-16 overflow-hidden">
      <div className="absolute inset-0 -z-10 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-electric-700/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[300px] bg-gold-600/8 rounded-full blur-[80px]" />
      </div>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

        {/* LEFT: Copy */}
        <div className="text-center lg:text-left order-2 lg:order-1">

          <motion.div {...fadeUp(0)} className="inline-flex items-center gap-2 mb-6">
            <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold"
              style={{ background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.08) 100%)', border: '1px solid rgba(59,130,246,0.3)', color: '#93C5FD' }}>
              <Sparkles className="w-3.5 h-3.5" />
              {h.badge}
              <span className="w-1.5 h-1.5 rounded-full bg-electric-400 animate-pulse" />
            </div>
          </motion.div>

          <motion.h1 {...fadeUp(0.08)} className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.08] mb-5">
            <span className="text-white">{h.title}</span>
            <br />
            <span className="gradient-text-electric">{h.titleHighlight}</span>
          </motion.h1>

          <motion.p {...fadeUp(0.16)} className="text-muted-foreground text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            {h.subtitle}
          </motion.p>

          <motion.div {...fadeUp(0.22)} className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-8">
            <Link href="/scan" className="btn-primary px-6 py-3 text-base rounded-xl font-bold">
              <Camera className="w-5 h-5" />
              {h.cta}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button className="btn-ghost px-6 py-3 text-base rounded-xl font-medium">
              <Play className="w-4 h-4 fill-current" />
              {h.demo}
            </button>
          </motion.div>

          <motion.div {...fadeUp(0.30)} className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-8">
            <TrustPill icon={<CheckCircle2 className="w-3.5 h-3.5" />} label={h.trust1} />
            <TrustPill icon={<Zap className="w-3.5 h-3.5" />} label={h.trust2} />
            <TrustPill icon={<TrendingUp className="w-3.5 h-3.5" />} label={h.trust3} />
          </motion.div>

          <motion.div {...fadeUp(0.38)} className="grid grid-cols-3 gap-3">
            {[
              { value: h.stat1Value, label: h.stat1Label },
              { value: h.stat2Value, label: h.stat2Label },
              { value: h.stat3Value, label: h.stat3Label },
            ].map(({ value, label }) => (
              <div key={label} className="glass-card px-3 py-3 text-center">
                <div className="text-xl font-bold font-mono mb-0.5" style={{ color: '#60A5FA' }}>{value}</div>
                <div className="text-xs text-muted-foreground">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT: Card mockup */}
        <motion.div {...fadeIn(0.2)} className="order-1 lg:order-2 flex justify-center items-center">
          <CardMockup t={t} />
        </motion.div>
      </div>
    </section>
  )
}
