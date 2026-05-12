'use client'

import { motion } from 'framer-motion'
import Link from 'next/link'
import { ArrowRight, Camera, Sparkles } from 'lucide-react'

export function CtaBanner() {
  return (
    <section className="py-16 md:py-20">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-40px' }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-gray-950 px-8 py-14 md:px-16 text-center"
      >
        {/* Background decoration */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.08)_0%,transparent_70%)]" />
        </div>

        {/* Pokeball decoration */}
        <div className="absolute -right-16 -top-16 w-64 h-64 border-[32px] border-white/[0.03] rounded-full" />
        <div className="absolute -left-12 -bottom-12 w-48 h-48 border-[24px] border-white/[0.03] rounded-full" />

        <div className="relative">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/10 border border-white/15 rounded-full text-sm font-semibold text-white/80 mb-6"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            Gratuit, sans inscription
          </motion.div>

          <h2 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
            Prêt à scanner votre
            <br />
            <span className="gradient-text-electric">première carte ?</span>
          </h2>

          <p className="text-gray-400 text-lg mb-10 max-w-md mx-auto">
            Commencez maintenant, sans compte. Uploadez une photo et découvrez instantanément la valeur de vos cartes Pokémon.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/scan"
              className="inline-flex items-center gap-2.5 px-8 py-4 bg-white text-gray-900 font-bold rounded-xl text-base transition-all duration-200 hover:bg-gray-100 hover:scale-[1.02] shadow-lg"
            >
              <Camera className="w-5 h-5" />
              Scanner une carte
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/cards"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white/8 border border-white/15 text-white font-semibold rounded-xl text-base transition-all duration-200 hover:bg-white/12"
            >
              Explorer les cartes
            </Link>
          </div>

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 mt-10 text-sm text-gray-500">
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
