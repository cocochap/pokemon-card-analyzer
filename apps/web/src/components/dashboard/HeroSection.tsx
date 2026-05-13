'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Camera, CheckCircle2, Shield, Sparkles, TrendingUp, Zap } from 'lucide-react'

const fadeUp = (delay = 0) => ({
  initial:    { opacity: 0, y: 24 },
  animate:    { opacity: 1, y: 0 },
  transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const, delay },
})

function PriceOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      transition={{ delay: 1.0, duration: 0.4 }}
      className="absolute -right-3 sm:-right-8 top-10 z-20 rounded-2xl p-3.5 w-44"
      style={{
        background: 'rgba(6,9,24,0.90)',
        border: '1px solid rgba(255,203,5,0.25)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Identifiée</span>
      </div>
      <div className="text-xl font-bold text-pokemon-yellow mb-0.5">€ 280</div>
      <div className="flex items-center gap-1">
        <TrendingUp className="w-3 h-3 text-green-400" />
        <span className="text-xs font-bold text-green-400">+18.4%</span>
        <span className="text-xs text-white/30">30 jours</span>
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
      className="absolute -left-3 sm:-left-8 bottom-24 z-20 rounded-2xl p-3.5 w-40"
      style={{
        background: 'rgba(6,9,24,0.90)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span className="text-amber-400 text-xs">★</span>
        <span className="text-[10px] font-semibold text-white/40 uppercase tracking-widest">Rareté</span>
      </div>
      <div className="text-xs font-semibold text-white/80 mb-2">Rare Holographique</div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
          <div className="h-full rounded-full" style={{ width: '88%', background: 'linear-gradient(90deg,#F59E0B,#FFCB05)' }} />
        </div>
        <span className="text-xs font-bold text-pokemon-yellow">88</span>
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
      className="absolute left-1/2 -translate-x-1/2 -bottom-5 z-20 rounded-2xl px-4 py-2.5 whitespace-nowrap"
      style={{
        background: 'rgba(6,9,24,0.90)',
        border: '1px solid rgba(255,255,255,0.10)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shadow-sm"
          style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)' }}>
          <span className="text-[#0A0E18] text-sm font-bold">9</span>
        </div>
        <div>
          <div className="text-[9px] text-white/30 font-semibold uppercase tracking-wider">Estimation PSA</div>
          <div className="text-xs font-bold text-white/80">PSA 9 probable</div>
        </div>
        <div className="flex items-center gap-0.5 px-2 py-0.5 rounded-full"
          style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.25)' }}>
          <Sparkles className="w-2.5 h-2.5 text-pokemon-yellow" />
          <span className="text-[10px] font-bold text-pokemon-yellow">94%</span>
        </div>
      </div>
    </motion.div>
  )
}

function PhoneMockup() {
  return (
    <div className="relative w-full max-w-[260px] sm:max-w-[280px] mx-auto select-none">
      <div className="absolute inset-0 -z-10 blur-[80px] opacity-50"
        style={{ background: 'radial-gradient(ellipse at 50% 50%, rgba(255,203,5,0.15) 0%, rgba(59,130,246,0.08) 60%, transparent 80%)' }} />

      <PriceOverlay />
      <RarityOverlay />
      <PSAOverlay />

      <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 5.5, ease: 'easeInOut', repeat: Infinity }}>
        <div className="rounded-[2.75rem] p-[3px]"
          style={{
            background: 'linear-gradient(135deg, rgba(255,203,5,0.3), rgba(255,255,255,0.05), rgba(255,203,5,0.15))',
            boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
          <div className="bg-[#080d1a] rounded-[2.5rem] overflow-hidden" style={{ minHeight: '520px' }}>

            {/* Status bar */}
            <div className="relative flex items-center justify-between px-6 pt-4 pb-1">
              <span className="text-white/40 text-[10px] font-semibold">9:41</span>
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-[#111827]" />
              </div>
              <div className="w-5 h-3 border border-white/20 rounded-[3px] p-px">
                <div className="w-3 h-full bg-green-400 rounded-[2px]" />
              </div>
            </div>

            {/* App header */}
            <div className="flex items-center justify-between px-5 pt-2 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)' }}>
                  <Camera className="w-4 h-4 text-[#0A0E18]" />
                </div>
                <span className="text-white text-sm font-bold">Scanner IA</span>
              </div>
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-pokemon-yellow animate-pulse" />
                <span className="text-pokemon-yellow text-[9px] font-bold tracking-wider">LIVE</span>
              </div>
            </div>

            {/* Card scan viewfinder */}
            <div className="mx-4 relative rounded-2xl overflow-hidden" style={{ aspectRatio: '3/4', background: 'rgba(255,255,255,0.03)' }}>
              <img
                src="https://images.pokemontcg.io/base1/4.png"
                alt="Carte Pokémon scannée"
                className="w-full h-full object-contain p-2"
              />
              {[
                'top-2.5 left-2.5 border-t-2 border-l-2',
                'top-2.5 right-2.5 border-t-2 border-r-2',
                'bottom-2.5 left-2.5 border-b-2 border-l-2',
                'bottom-2.5 right-2.5 border-b-2 border-r-2',
              ].map((cls, i) => (
                <div key={i} className={`absolute w-5 h-5 rounded-sm ${cls}`}
                  style={{ borderColor: 'rgba(255,203,5,0.8)' }} />
              ))}
              <div className="scan-beam" />
              <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                <div className="px-3 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: 'rgba(255,203,5,0.15)', border: '1px solid rgba(255,203,5,0.3)', backdropFilter: 'blur(8px)' }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-pokemon-yellow animate-pulse" />
                  <span className="text-pokemon-yellow text-[9px] font-bold tracking-widest">ANALYSE EN COURS</span>
                </div>
              </div>
            </div>

            {/* Result preview */}
            <div className="mx-4 mt-3 rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-white text-xs font-bold">Dracaufeu</div>
                  <div className="text-white/30 text-[10px]">Base Set · #4 · Rare Holo</div>
                </div>
                <div className="px-2 py-0.5 rounded-lg" style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.25)' }}>
                  <span className="text-pokemon-yellow text-xs font-bold">€ 280</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg,#F59E0B,#FFCB05)' }}
                    initial={{ width: '0%' }}
                    animate={{ width: '94%' }}
                    transition={{ delay: 0.6, duration: 1.5, ease: 'easeOut' }}
                  />
                </div>
                <span className="text-[10px] text-pokemon-yellow font-bold">94%</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export function HeroSection() {
  return (
    <section className="relative pt-14 pb-20 md:pt-20 md:pb-28 overflow-visible">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-8 items-center">

        {/* LEFT: Copy */}
        <div className="text-center lg:text-left order-2 lg:order-1">

          {/* Badge */}
          <motion.div {...fadeUp(0)} className="inline-flex mb-6">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.25)', color: '#FFCB05' }}>
              <Sparkles className="w-3.5 h-3.5" />
              Reconnaissance IA de cartes Pokémon
              <span className="w-1.5 h-1.5 rounded-full bg-pokemon-yellow animate-pulse" />
            </div>
          </motion.div>

          {/* Headline */}
          <motion.h1
            {...fadeUp(0.08)}
            className="text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight leading-[1.1] mb-5 text-white"
          >
            Scannez vos cartes{' '}
            <br className="hidden sm:block" />
            <span style={{ background: 'linear-gradient(135deg,#FFCB05,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Pokémon
            </span>{' '}
            avec l'IA
          </motion.h1>

          {/* Subtitle */}
          <motion.p {...fadeUp(0.16)} className="text-white/50 text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
            Identifiez n'importe quelle carte, estimez sa note PSA, suivez sa valeur Cardmarket et découvrez son potentiel d'investissement en quelques secondes.
          </motion.p>

          {/* CTAs */}
          <motion.div {...fadeUp(0.22)} className="flex flex-wrap items-center justify-center lg:justify-start gap-3 mb-8">
            <Link href="/scan"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-base rounded-xl font-bold transition-all hover:brightness-110 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18', boxShadow: '0 0 24px rgba(255,203,5,0.3)' }}>
              <Camera className="w-5 h-5" />
              Scanner une carte
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/cards"
              className="inline-flex items-center gap-2 px-7 py-3.5 text-base rounded-xl font-semibold transition-colors"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
              Explorer les cartes
            </Link>
          </motion.div>

          {/* Trust pills */}
          <motion.div {...fadeUp(0.30)} className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-8">
            {[
              { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: '22 000+ cartes' },
              { icon: <Zap className="w-3.5 h-3.5" />, label: '94% précision IA' },
              { icon: <Shield className="w-3.5 h-3.5" />, label: 'Prix Cardmarket' },
            ].map(({ icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-3.5 py-2 rounded-full text-sm font-medium"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.65)' }}>
                <span className="text-pokemon-yellow">{icon}</span>
                {label}
              </div>
            ))}
          </motion.div>

          {/* Mini stats */}
          <motion.div {...fadeUp(0.38)} className="grid grid-cols-3 gap-3">
            {[
              { value: '22K+', label: 'Cartes en base' },
              { value: '94%',  label: 'Précision IA' },
              { value: '< 2s', label: 'Vitesse de scan' },
            ].map(({ value, label }) => (
              <div key={label} className="rounded-xl p-3 text-center"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="text-xl font-bold text-pokemon-yellow mb-0.5">{value}</div>
                <div className="text-xs text-white/40">{label}</div>
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
