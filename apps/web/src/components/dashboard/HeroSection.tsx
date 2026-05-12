'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Camera, CheckCircle2, Play, Shield, Sparkles, Star, TrendingUp, Zap } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 24 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const, delay },
})

/* ─── Floating overlays ──────────────────────────────────────── */

function PriceOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 1.0, duration: 0.4 }}
      className="absolute -right-3 sm:-right-8 top-10 z-20 bg-white rounded-2xl p-3.5 w-44 shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-gray-100"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Identifiée</span>
      </div>
      <div className="text-xl font-bold text-gray-900 mb-0.5">€ 280</div>
      <div className="flex items-center gap-1">
        <TrendingUp className="w-3 h-3 text-green-600" />
        <span className="text-xs font-bold text-green-600">+18.4%</span>
        <span className="text-xs text-gray-400">30 jours</span>
      </div>
    </motion.div>
  )
}

function RarityOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 1.3, duration: 0.4 }}
      className="absolute -left-3 sm:-left-8 bottom-24 z-20 bg-white rounded-2xl p-3.5 w-40 shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-gray-100"
    >
      <div className="flex items-center gap-1.5 mb-2">
        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Rareté</span>
      </div>
      <div className="text-xs font-semibold text-gray-700 mb-2">Rare Holographique</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full" style={{ width: '88%' }} />
        </div>
        <span className="text-xs font-bold text-gray-800">88</span>
      </div>
    </motion.div>
  )
}

function PSAOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 1.6, duration: 0.4 }}
      className="absolute left-1/2 -translate-x-1/2 -bottom-5 z-20 bg-white rounded-2xl px-4 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.10)] border border-gray-100 whitespace-nowrap"
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center shadow-sm">
          <span className="text-white text-sm font-bold">9</span>
        </div>
        <div>
          <div className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider">Estimation PSA</div>
          <div className="text-xs font-bold text-gray-900">PSA 9 probable</div>
        </div>
        <div className="flex items-center gap-0.5 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-full">
          <Sparkles className="w-2.5 h-2.5 text-blue-600" />
          <span className="text-[10px] font-bold text-blue-700">94%</span>
        </div>
      </div>
    </motion.div>
  )
}

/* ─── Phone mockup ───────────────────────────────────────────── */

function PhoneMockup() {
  return (
    <div className="relative w-full max-w-[260px] sm:max-w-[280px] mx-auto select-none">
      {/* Ambient glow */}
      <div
        className="absolute inset-0 -z-10 blur-[70px] opacity-60"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(59,130,246,0.18) 0%, rgba(245,158,11,0.12) 60%, transparent 80%)' }}
      />

      <PriceOverlay />
      <RarityOverlay />
      <PSAOverlay />

      {/* Floating phone */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 5.5, ease: 'easeInOut', repeat: Infinity }}
      >
        {/* Phone bezel */}
        <div className="bg-[#111827] rounded-[2.75rem] p-[3px] shadow-[0_40px_80px_rgba(0,0,0,0.22),0_0_0_1px_rgba(255,255,255,0.06)]">
          {/* Screen */}
          <div className="bg-[#1a2435] rounded-[2.5rem] overflow-hidden" style={{ minHeight: '520px' }}>

            {/* Status bar */}
            <div className="relative flex items-center justify-between px-6 pt-4 pb-1">
              <span className="text-white/70 text-[10px] font-semibold">9:41</span>
              {/* Dynamic island */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-[#111827] rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#1F2937]" />
              </div>
              {/* Battery */}
              <div className="w-5 h-3 border border-white/40 rounded-[3px] p-px">
                <div className="w-3 h-full bg-green-400 rounded-[2px]" />
              </div>
            </div>

            {/* App header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center shadow-md">
                  <Camera className="w-4 h-4 text-white" />
                </div>
                <span className="text-white text-sm font-bold">Scanner IA</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                <span className="text-blue-300 text-[9px] font-bold tracking-wider">LIVE</span>
              </div>
            </div>

            {/* Card scan viewfinder */}
            <div className="mx-4 relative rounded-2xl overflow-hidden bg-[#0d1624]" style={{ aspectRatio: '3/4' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.pokemontcg.io/base1/4.png"
                alt="Carte Pokémon scannée"
                className="w-full h-full object-contain p-2"
              />

              {/* Corner scanning marks */}
              {[
                'top-2.5 left-2.5 border-t-2 border-l-2',
                'top-2.5 right-2.5 border-t-2 border-r-2',
                'bottom-2.5 left-2.5 border-b-2 border-l-2',
                'bottom-2.5 right-2.5 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 border-blue-400/90 rounded-sm ${cls}`} />
              ))}

              {/* Scan beam */}
              <div className="scan-beam" />

              {/* Scanning badge */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                <div className="bg-blue-600/90 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  <span className="text-white text-[9px] font-bold tracking-widest">ANALYSE EN COURS</span>
                </div>
              </div>
            </div>

            {/* Result preview */}
            <div className="mx-4 mt-3 bg-[#0d1624] rounded-xl p-3">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-white text-xs font-bold">Dracaufeu</div>
                  <div className="text-gray-400 text-[10px]">Base Set · #4 · Rare Holo</div>
                </div>
                <div className="bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-lg">
                  <span className="text-amber-400 text-xs font-bold">€ 280</span>
                </div>
              </div>
              {/* Confidence bar */}
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-blue-900/50 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '94%' }}
                    transition={{ delay: 0.6, duration: 1.5, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] text-blue-400 font-bold">94%</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

/* ─── Trust pill ─────────────────────────────────────────────── */

function TrustPill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-white border border-gray-200 text-sm text-gray-700 font-medium shadow-sm">
      <span className="text-blue-600">{icon}</span>
      {label}
    </div>
  )
}

/* ─── Hero section ───────────────────────────────────────────── */

export function HeroSection() {
  return (
    <section className="relative pt-14 pb-20 md:pt-20 md:pb-28 overflow-visible">
      {/* Background decorations */}
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-20 right-0 w-[700px] h-[600px] bg-gradient-to-bl from-blue-50 via-blue-50/50 to-transparent rounded-full" />
        <div className="absolute bottom-0 -left-20 w-[500px] h-[400px] bg-gradient-to-tr from-amber-50/70 to-transparent rounded-full" />
      </div>

      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

        {/* LEFT: Copy */}
        <div className="text-center lg:text-left order-2 lg:order-1">

          {/* Badge */}
          <motion.div {...fadeUp(0)} className="inline-flex mb-6">
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-full text-sm font-semibold text-blue-700">
              <Sparkles className="w-3.5 h-3.5" />
              Reconnaissance IA de cartes Pokémon
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            {...fadeUp(0.08)}
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-5 text-gray-900"
          >
            Scannez vos cartes{' '}
            <br className="hidden sm:block" />
            <span className="gradient-text-electric">Pokémon</span> avec l'IA
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            {...fadeUp(0.16)}
            className="text-gray-500 text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0"
          >
            Identifiez n'importe quelle carte, estimez sa note PSA, suivez sa valeur Cardmarket et découvrez son potentiel d'investissement en quelques secondes.
          </motion.p>

          {/* CTAs */}
          <motion.div
            {...fadeUp(0.22)}
            className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-8"
          >
            <Link href="/scan" className="btn-primary px-7 py-3.5 text-base rounded-xl font-bold">
              <Camera className="w-5 h-5" />
              Scanner une carte
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/cards" className="btn-ghost px-7 py-3.5 text-base rounded-xl font-semibold">
              <Play className="w-4 h-4 fill-gray-500" />
              Explorer les cartes
            </Link>
          </motion.div>

          {/* Trust pills */}
          <motion.div
            {...fadeUp(0.30)}
            className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-8"
          >
            <TrustPill icon={<CheckCircle2 className="w-3.5 h-3.5" />} label="22 000+ cartes" />
            <TrustPill icon={<Zap className="w-3.5 h-3.5" />} label="94% précision IA" />
            <TrustPill icon={<Shield className="w-3.5 h-3.5" />} label="Prix Cardmarket" />
          </motion.div>

          {/* Mini stats */}
          <motion.div
            {...fadeUp(0.38)}
            className="grid grid-cols-3 gap-3"
          >
            {[
              { value: '22K+', label: 'Cartes en base' },
              { value: '94%',  label: 'Précision IA' },
              { value: '< 2s', label: 'Vitesse de scan' },
            ].map(({ value, label }) => (
              <div
                key={label}
                className="bg-white border border-gray-200 rounded-xl p-3 text-center shadow-sm"
              >
                <div className="text-xl font-bold text-blue-600 mb-0.5">{value}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* RIGHT: Phone mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.65, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="order-1 lg:order-2 flex justify-center items-center py-12"
        >
          <PhoneMockup />
        </motion.div>
      </div>
    </section>
  )
}
