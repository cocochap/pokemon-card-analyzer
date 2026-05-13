'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Camera, Zap } from 'lucide-react'

export function CtaBanner() {
  return (
    <section className="py-16 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl px-8 py-14 md:px-16 text-center"
        style={{
          background: 'linear-gradient(135deg, rgba(255,203,5,0.08) 0%, rgba(15,23,42,0.98) 40%, rgba(6,9,24,1) 100%)',
          border: '1px solid rgba(255,203,5,0.20)',
          boxShadow: '0 0 60px rgba(255,203,5,0.06)',
        }}
      >
        {/* Gold top shimmer */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.6), transparent)' }} />

        {/* Decorative circles */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full border-[32px]"
          style={{ borderColor: 'rgba(255,203,5,0.04)' }} />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 rounded-full border-[24px]"
          style={{ borderColor: 'rgba(255,203,5,0.04)' }} />

        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at center, rgba(255,203,5,0.04) 0%, transparent 70%)' }} />

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold mb-6"
            style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.20)', color: '#FFCB05' }}
          >
            <Zap className="w-3.5 h-3.5" />
            Gratuit, sans inscription
          </motion.div>

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Prêt à scanner votre
            <br />
            <span style={{ background: 'linear-gradient(135deg,#FFCB05,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              première carte ?
            </span>
          </h2>

          <p className="text-white/45 text-lg mb-10 max-w-md mx-auto">
            Commencez maintenant, sans compte. Uploadez une photo et découvrez instantanément la valeur de vos cartes Pokémon.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link href="/scan"
              className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl text-base font-bold transition-all duration-200 hover:brightness-110 hover:scale-[1.02]"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18', boxShadow: '0 0 32px rgba(255,203,5,0.3)' }}>
              <Camera className="w-5 h-5" />
              Scanner une carte
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/cards"
              className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold transition-all duration-200"
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.75)' }}>
              Explorer les cartes
            </Link>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-white/30">
            <span>✓ Gratuit</span>
            <span>✓ Sans inscription</span>
            <span>✓ 22 000+ cartes</span>
            <span>✓ Prix Cardmarket</span>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
