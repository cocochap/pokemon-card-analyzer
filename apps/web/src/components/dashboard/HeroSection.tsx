'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, BarChart2, Brain, Shield, TrendingUp, Zap } from 'lucide-react'
import { useT } from '@/lib/i18n/LanguageContext'

// Pokéball SVG decorative element
function Pokeball({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none">
      <circle cx="50" cy="50" r="48" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
      <path d="M2 50 Q50 50 98 50" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
      <circle cx="50" cy="50" r="14" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
      <path d="M2 50 A48 48 0 0 1 98 50" fill="rgba(204,0,0,0.12)" />
    </svg>
  )
}

export function HeroSection() {
  const t = useT()

  const stats = [
    { label: t.dashboard.stats.cards, value: '345+', emoji: '🃏' },
    { label: t.dashboard.stats.dataPoints, value: '31K+', emoji: '📊' },
    { label: t.dashboard.stats.investors, value: '42K+', emoji: '👥' },
    { label: t.dashboard.stats.aiAccuracy, value: '84%', emoji: '🤖' },
  ]

  const features = [
    { icon: BarChart2, label: 'Live prices' },
    { icon: Brain, label: 'IA prédictive' },
    { icon: TrendingUp, label: 'Tendances' },
    { icon: Shield, label: 'Portfolio' },
  ]

  return (
    <section className="py-10 text-center relative overflow-hidden">
      {/* Pokéball decorative elements */}
      <div className="absolute -top-16 -right-16 w-64 h-64 opacity-10 pointer-events-none">
        <Pokeball className="w-full h-full animate-spin-slow" />
      </div>
      <div className="absolute -bottom-8 -left-8 w-40 h-40 opacity-8 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
        <Pokeball className="w-full h-full animate-spin-slow" />
      </div>

      {/* Background energy glow */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-pokemon-yellow/4 rounded-full blur-3xl" />
        <div className="absolute top-0 right-1/4 w-64 h-64 bg-pokemon-blue/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-pokemon-red/4 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-pokemon-yellow/10 border border-pokemon-yellow/30 rounded-full text-pokemon-yellow text-sm font-semibold mb-6">
          <span className="text-base">⚡</span>
          <span>{t.dashboard.hero.badge}</span>
          <span className="text-base">⚡</span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 leading-tight">
          {t.dashboard.hero.title}{' '}
          <span className="gradient-text">{t.dashboard.hero.titleHighlight}</span>
          <br />
          <span className="text-white/90">{t.dashboard.hero.titleEnd}</span>
        </h1>

        <p className="text-muted-foreground text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          {t.dashboard.hero.subtitle}
        </p>

        {/* CTAs */}
        <div className="flex flex-wrap items-center justify-center gap-4 mb-10">
          <Link
            href="/cards"
            className="group flex items-center gap-2 px-7 py-3.5 bg-pokemon-yellow text-background font-bold rounded-2xl hover:bg-yellow-300 transition-all duration-200 shadow-glow hover:scale-105 hover:shadow-[0_0_30px_rgba(255,203,5,0.7)]"
          >
            <span className="text-lg">⚡</span>
            {t.dashboard.hero.cta}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
          <Link
            href="/cards"
            className="flex items-center gap-2 px-6 py-3.5 bg-white/5 border border-white/15 text-foreground font-medium rounded-2xl hover:bg-white/10 hover:border-white/25 transition-all duration-200"
          >
            🃏 {t.dashboard.hero.browse}
          </Link>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
          {features.map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-sm text-muted-foreground hover:text-foreground hover:border-pokemon-yellow/20 transition-all"
            >
              <Icon className="w-4 h-4 text-pokemon-yellow" />
              {label}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Stats bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto"
      >
        {stats.map(({ label, value, emoji }) => (
          <div
            key={label}
            className="glass-card py-4 px-4 hover:border-pokemon-yellow/20 transition-all group"
          >
            <div className="text-2xl mb-1">{emoji}</div>
            <div className="text-xl font-bold text-pokemon-yellow font-mono">{value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
          </div>
        ))}
      </motion.div>
    </section>
  )
}
