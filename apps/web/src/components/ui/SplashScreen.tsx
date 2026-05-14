'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence, useAnimate } from 'framer-motion'

type Phase = 'intro' | 'zoom' | 'done'

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.cos((i / 18) * Math.PI * 2) * (55 + (i % 3) * 18),
  y: Math.sin((i / 18) * Math.PI * 2) * (55 + (i % 3) * 18),
  size: 2 + (i % 3),
  delay: (i / 18) * 0.5,
}))

export function SplashScreen() {
  const [phase, setPhase] = useState<Phase | null>(null)
  const [cardScope, animateCard] = useAnimate()
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (sessionStorage.getItem('splash_seen')) return
    sessionStorage.setItem('splash_seen', '1')
    setPhase('intro')

    // After intro → zoom phase
    const t1 = setTimeout(async () => {
      setPhase('zoom')

      // Zoom the card to fill the whole screen
      if (cardScope.current) {
        await animateCard(cardScope.current, {
          scale: 22,
          opacity: 1,
        }, {
          duration: 0.9,
          ease: [0.4, 0, 0.1, 1],
        })
      }

      // Fade the whole overlay out
      if (overlayRef.current) {
        overlayRef.current.style.transition = 'opacity 0.4s ease'
        overlayRef.current.style.opacity = '0'
      }

      setTimeout(() => setPhase('done'), 450)
    }, 2200)

    return () => clearTimeout(t1)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'done' || phase === null) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: '#060918' }}
    >
      {/* Background grid */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,203,5,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,203,5,0.04) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

      {/* Radial glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(255,203,5,0.07) 0%, transparent 70%)' }} />

      {/* Logo — fades out during zoom */}
      <motion.div
        className="mb-10 text-center"
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1, y: 0 }}
        transition={{ duration: phase === 'zoom' ? 0.25 : 0.5 }}
      >
        <p className="text-xs font-bold tracking-[0.4em] uppercase mb-1"
          style={{ color: 'rgba(255,255,255,0.25)' }}>
          Bienvenue sur
        </p>
        <h1 className="text-4xl font-bold tracking-tight"
          style={{
            background: 'linear-gradient(135deg, #FFCB05, #F59E0B)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 0 24px rgba(255,203,5,0.4))',
          }}>
          PokeScard
        </h1>
      </motion.div>

      {/* Card — this is what zooms */}
      <div className="relative" style={{ perspective: '900px' }}>
        {/* Zoom target wrapper */}
        <div ref={cardScope} style={{ display: 'inline-block' }}>
          <motion.div
            initial={{ rotateY: -90, rotateX: 15, scale: 0.75, opacity: 0 }}
            animate={{ rotateY: 0, rotateX: phase === 'zoom' ? 0 : 7, scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.85, ease: [0.23, 1, 0.32, 1] }}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {/* Card body */}
            <div className="relative w-44 h-60 rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #0d1f3c 0%, #060918 50%, #0d1f3c 100%)',
                border: '1px solid rgba(255,203,5,0.35)',
                boxShadow: '0 0 60px rgba(255,203,5,0.18), 0 30px 80px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.08)',
              }}>

              {/* Holographic sheen */}
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{
                  background: [
                    'linear-gradient(105deg, transparent 30%, rgba(255,203,5,0.14) 50%, rgba(167,139,250,0.09) 55%, transparent 70%)',
                    'linear-gradient(145deg, transparent 30%, rgba(167,139,250,0.14) 50%, rgba(59,130,246,0.09) 55%, transparent 70%)',
                    'linear-gradient(75deg,  transparent 30%, rgba(59,130,246,0.14) 50%, rgba(255,203,5,0.09) 55%, transparent 70%)',
                    'linear-gradient(105deg, transparent 30%, rgba(255,203,5,0.14) 50%, rgba(167,139,250,0.09) 55%, transparent 70%)',
                  ],
                }}
                transition={{ duration: 2.8, repeat: Infinity, ease: 'linear' }}
              />

              {/* Inner content */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
                {/* Pokéball */}
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.85, duration: 0.5, type: 'spring', stiffness: 260 }}
                  className="w-16 h-16 rounded-full relative overflow-hidden"
                  style={{ border: '2px solid rgba(255,203,5,0.55)', boxShadow: '0 0 24px rgba(255,203,5,0.35)' }}>
                  <div className="absolute inset-0 bg-gradient-to-b from-red-600 to-red-700" style={{ clipPath: 'inset(0 0 50% 0)' }} />
                  <div className="absolute inset-0 bg-gradient-to-b from-gray-800 to-gray-900" style={{ clipPath: 'inset(50% 0 0 0)' }} />
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full h-px bg-white/40" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <motion.div
                      className="w-5 h-5 rounded-full bg-white/90"
                      style={{ boxShadow: '0 0 0 2px #333, 0 0 8px rgba(255,255,255,0.5)' }}
                      animate={{ boxShadow: ['0 0 0 2px #333, 0 0 8px rgba(255,255,255,0.5)', '0 0 0 2px #333, 0 0 18px rgba(255,203,5,0.8)', '0 0 0 2px #333, 0 0 8px rgba(255,255,255,0.5)'] }}
                      transition={{ delay: 1.4, duration: 1.0, repeat: Infinity }}
                    />
                  </div>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.05, duration: 0.35 }}
                  className="text-center">
                  <p className="text-xs font-bold tracking-widest uppercase mb-0.5"
                    style={{ color: 'rgba(255,203,5,0.9)', textShadow: '0 0 12px rgba(255,203,5,0.5)' }}>
                    PokeScard
                  </p>
                  <p className="text-[9px] text-white/30 tracking-wider uppercase">TCG Intelligence</p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.25, duration: 0.35 }}
                  className="w-full space-y-1.5 mt-1">
                  {[
                    { label: 'HP', value: '22 547', color: '#FFCB05' },
                    { label: 'ATK', value: '+14.2%', color: '#22C55E' },
                    { label: 'DEF', value: 'IA', color: '#A78BFA' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="flex items-center justify-between px-1">
                      <span className="text-[9px] text-white/30 font-mono">{label}</span>
                      <span className="text-[9px] font-bold font-mono" style={{ color }}>{value}</span>
                    </div>
                  ))}
                </motion.div>
              </div>

              <div className="absolute top-2 right-3 text-[9px] font-mono text-white/20">#001</div>
              <div className="absolute bottom-0 left-0 right-0 h-10"
                style={{ background: 'linear-gradient(to top, rgba(255,203,5,0.05), transparent)' }} />
            </div>
          </motion.div>
        </div>

        {/* Particles — fade out during zoom */}
        <motion.div animate={{ opacity: phase === 'zoom' ? 0 : 1 }} transition={{ duration: 0.2 }}>
          {PARTICLES.map(p => (
            <motion.div
              key={p.id}
              className="absolute rounded-full pointer-events-none"
              style={{
                width: p.size, height: p.size,
                top: '50%', left: '50%',
                background: p.id % 3 === 0 ? '#FFCB05' : p.id % 3 === 1 ? '#A78BFA' : '#fff',
                boxShadow: `0 0 ${p.size * 2}px ${p.id % 3 === 0 ? '#FFCB05' : p.id % 3 === 1 ? '#A78BFA' : '#fff'}`,
              }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 0.9, 0], scale: [0, 1, 0] }}
              transition={{ delay: 0.9 + p.delay, duration: 1.0, ease: 'easeOut' }}
            />
          ))}
        </motion.div>

        {/* Scan beam */}
        <motion.div
          className="absolute left-0 right-0 pointer-events-none"
          style={{
            height: 2,
            background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.9), rgba(255,255,255,1), rgba(255,203,5,0.9), transparent)',
            boxShadow: '0 0 16px rgba(255,203,5,0.8), 0 0 40px rgba(255,203,5,0.4)',
            borderRadius: 2,
          }}
          initial={{ top: '0%', opacity: 0 }}
          animate={{ top: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
          transition={{ delay: 0.55, duration: 0.9, ease: 'easeInOut' }}
        />
      </div>

      {/* Tagline — fades out during zoom */}
      <motion.div
        className="mt-10 text-center"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1, y: 0 }}
        transition={{ delay: phase === 'zoom' ? 0 : 1.4, duration: phase === 'zoom' ? 0.2 : 0.4 }}
      >
        <p className="text-sm text-white/40 tracking-widest uppercase font-medium">
          Analyse · Investissement · TCG
        </p>
      </motion.div>

      {/* Progress bar */}
      <motion.div
        className="absolute bottom-10 left-1/2 -translate-x-1/2 w-32 h-px rounded-full overflow-hidden"
        style={{ background: 'rgba(255,255,255,0.07)' }}
        animate={{ opacity: phase === 'zoom' ? 0 : 1 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #FFCB05, #F59E0B)' }}
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ delay: 1.1, duration: 1.0, ease: 'easeInOut' }}
        />
      </motion.div>
    </div>
  )
}
