'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const CHARIZARD_URL = 'https://images.pokemontcg.io/base1/4.png'

export function SplashScreen() {
  const [phase, setPhase] = useState<'hidden' | 'intro' | 'zoom' | 'done'>('hidden')
  const cardRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionStorage.getItem('splash_seen')) return
    sessionStorage.setItem('splash_seen', '1')
    setPhase('intro')

    // Start zoom after intro
    const t1 = setTimeout(() => {
      setPhase('zoom')

      // Calcul pour que la carte remplisse l'écran
      if (cardRef.current) {
        const rect = cardRef.current.getBoundingClientRect()
        const scaleX = window.innerWidth / rect.width
        const scaleY = window.innerHeight / rect.height
        const scale = Math.max(scaleX, scaleY) * 1.1

        const centerX = window.innerWidth / 2 - (rect.left + rect.width / 2)
        const centerY = window.innerHeight / 2 - (rect.top + rect.height / 2)

        cardRef.current.style.transition = 'transform 0.85s cubic-bezier(0.4, 0, 0.1, 1)'
        cardRef.current.style.transform = `translate(${centerX}px, ${centerY}px) scale(${scale})`
        cardRef.current.style.borderRadius = '0'
      }

      // Fade out overlay
      setTimeout(() => {
        if (overlayRef.current) {
          overlayRef.current.style.transition = 'opacity 0.5s ease'
          overlayRef.current.style.opacity = '0'
        }
        setTimeout(() => setPhase('done'), 520)
      }, 750)
    }, 2400)

    return () => clearTimeout(t1)
  }, []) // eslint-disable-line

  if (phase === 'hidden' || phase === 'done') return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#060918' }}
    >
      {/* Ambient glow behind card */}
      <motion.div
        className="absolute pointer-events-none"
        style={{
          width: 400, height: 400,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,80,30,0.18) 0%, rgba(255,150,0,0.10) 40%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1, scale: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,203,5,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,203,5,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }} />

      {/* Logo top */}
      <motion.div
        className="absolute top-10 left-1/2 -translate-x-1/2 text-center"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <p className="text-xs font-bold tracking-[0.5em] uppercase"
          style={{ color: 'rgba(255,255,255,0.2)' }}>
          PokeScard
        </p>
      </motion.div>

      {/* THE CARD — this is what zooms */}
      <motion.div
        ref={cardRef}
        initial={{ opacity: 0, y: 30, rotateY: -12, scale: 0.85 }}
        animate={{ opacity: 1, y: 0, rotateY: 0, scale: 1 }}
        transition={{ duration: 0.75, ease: [0.23, 1, 0.32, 1] }}
        className="relative"
        style={{
          width: 220,
          borderRadius: 16,
          transformOrigin: 'center center',
          willChange: 'transform',
          boxShadow: '0 0 0 1px rgba(255,203,5,0.3), 0 40px 100px rgba(0,0,0,0.8), 0 0 80px rgba(255,80,30,0.2)',
          overflow: 'hidden',
        }}
      >
        {/* Holographic sheen */}
        <motion.div
          className="absolute inset-0 z-10 pointer-events-none"
          animate={{
            background: [
              'linear-gradient(110deg, transparent 30%, rgba(255,200,100,0.15) 48%, rgba(255,100,50,0.10) 54%, transparent 68%)',
              'linear-gradient(140deg, transparent 30%, rgba(255,100,50,0.15) 48%, rgba(200,100,255,0.10) 54%, transparent 68%)',
              'linear-gradient(80deg,  transparent 30%, rgba(200,100,255,0.15) 48%, rgba(255,200,100,0.10) 54%, transparent 68%)',
              'linear-gradient(110deg, transparent 30%, rgba(255,200,100,0.15) 48%, rgba(255,100,50,0.10) 54%, transparent 68%)',
            ],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
        />

        {/* Card image — real Charizard */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={CHARIZARD_URL}
          alt="Dracaufeu"
          style={{ display: 'block', width: '100%', height: 'auto' }}
          draggable={false}
        />

        {/* Bottom price overlay */}
        <motion.div
          className="absolute bottom-0 left-0 right-0 px-3 py-2.5 z-20"
          style={{
            background: 'linear-gradient(to top, rgba(6,9,24,0.97) 0%, rgba(6,9,24,0.6) 70%, transparent 100%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'zoom' ? 0 : 1 }}
          transition={{ delay: 0.7, duration: 0.4 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white text-xs font-bold leading-tight">Dracaufeu</p>
              <p className="text-white/35 text-[9px]">Base Set · #4 · Rare Holo</p>
            </div>
            <div className="text-right">
              <p className="text-pokemon-yellow text-sm font-bold">€ 280</p>
              <p className="text-green-400 text-[9px] font-semibold">+18.4% ↑</p>
            </div>
          </div>
        </motion.div>

        {/* Scan beam */}
        <motion.div
          className="absolute left-0 right-0 z-30 pointer-events-none"
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.9), white, rgba(255,203,5,0.9), transparent)',
            boxShadow: '0 0 12px rgba(255,203,5,0.8)',
          }}
          initial={{ top: '0%', opacity: 0 }}
          animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.5, duration: 0.9, ease: 'easeInOut' }}
        />
      </motion.div>

      {/* Floating price badge */}
      <motion.div
        className="absolute"
        style={{ top: '50%', right: 'calc(50% - 160px)', transform: 'translateY(-80px)' }}
        initial={{ opacity: 0, x: 20, scale: 0.9 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1, x: 0, scale: 1 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        <div className="rounded-xl px-3 py-2"
          style={{ background: 'rgba(6,9,24,0.9)', border: '1px solid rgba(255,203,5,0.3)', backdropFilter: 'blur(12px)' }}>
          <p className="text-[9px] text-white/40 mb-0.5">Score invest.</p>
          <p className="text-base font-bold text-pokemon-yellow">92/100</p>
        </div>
      </motion.div>

      {/* Floating rarity badge */}
      <motion.div
        className="absolute"
        style={{ top: '50%', left: 'calc(50% - 160px)', transform: 'translateY(30px)' }}
        initial={{ opacity: 0, x: -20, scale: 0.9 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1, x: 0, scale: 1 }}
        transition={{ delay: 1.1, duration: 0.4 }}
      >
        <div className="rounded-xl px-3 py-2"
          style={{ background: 'rgba(6,9,24,0.9)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(12px)' }}>
          <p className="text-[9px] text-white/40 mb-0.5">Rareté</p>
          <p className="text-xs font-bold text-white/80">★ Rare Holo</p>
        </div>
      </motion.div>

      {/* Tagline bottom */}
      <motion.p
        className="absolute bottom-10 text-xs tracking-[0.4em] uppercase font-medium"
        style={{ color: 'rgba(255,255,255,0.2)' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1 }}
        transition={{ delay: 1.3, duration: 0.4 }}
      >
        Analyse · Investissement · TCG
      </motion.p>
    </div>
  )
}
