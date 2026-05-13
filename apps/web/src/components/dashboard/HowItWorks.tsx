'use client'

import { motion } from 'framer-motion'
import { Camera, Sparkles, TrendingUp } from 'lucide-react'

const steps = [
  {
    num: '01',
    icon: Camera,
    color: '#FFCB05',
    bg: 'rgba(255,203,5,0.12)',
    border: 'rgba(255,203,5,0.30)',
    title: 'Photographiez votre carte',
    desc: 'Uploadez une photo depuis votre galerie ou prenez-la avec votre caméra. Même en basse lumière.',
  },
  {
    num: '02',
    icon: Sparkles,
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.30)',
    title: "L'IA identifie en secondes",
    desc: 'Notre modèle analyse 22 000+ cartes et identifie la vôtre avec 94% de précision en moins de 2 secondes.',
  },
  {
    num: '03',
    icon: TrendingUp,
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.30)',
    title: 'Prix & analyse complète',
    desc: "Valeur Cardmarket en temps réel, estimation PSA, historique de prix et score d'investissement.",
  },
] as const

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      <div className="w-full h-px mb-20 md:mb-28"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.15), transparent)' }} />

      <div className="text-center mb-16">
        <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.4 }} className="inline-flex mb-4">
          <span className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.6)' }}>
            Simple & rapide
          </span>
        </motion.div>
        <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="text-3xl md:text-4xl font-bold text-white mb-4">
          Comment ça marche
        </motion.h2>
        <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.14 }}
          className="text-white/45 text-lg max-w-md mx-auto">
          En 3 étapes simples, découvrez tout ce que vaut votre carte Pokémon.
        </motion.p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 relative">
        {/* Connecting line */}
        <div className="hidden md:block absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px"
          style={{ background: 'linear-gradient(90deg, rgba(255,203,5,0.4), rgba(167,139,250,0.4), rgba(34,197,94,0.4))' }} />

        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.14, duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            <div className="relative mb-6">
              <div className="w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{ background: step.bg, border: `1px solid ${step.border}` }}>
                <step.icon className="w-9 h-9" style={{ color: step.color }} />
              </div>
              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full flex items-center justify-center"
                style={{ background: '#060918', border: `1px solid ${step.border}` }}>
                <span className="text-[10px] font-bold" style={{ color: step.color }}>{step.num}</span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-white mb-3">{step.title}</h3>
            <p className="text-white/40 text-sm leading-relaxed max-w-[240px]">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
