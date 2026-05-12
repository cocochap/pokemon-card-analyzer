'use client'

import { motion } from 'framer-motion'
import { Camera, Sparkles, TrendingUp } from 'lucide-react'

const steps = [
  {
    num: '01',
    icon: Camera,
    color: 'blue',
    gradient: 'from-blue-500 to-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    title: 'Photographiez votre carte',
    desc: 'Uploadez une photo depuis votre galerie ou prenez-la directement avec votre caméra. Même en basse lumière.',
  },
  {
    num: '02',
    icon: Sparkles,
    color: 'purple',
    gradient: 'from-violet-500 to-purple-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    title: "L'IA identifie en secondes",
    desc: 'Notre modèle analyse 22 000+ cartes et identifie la vôtre avec 94% de précision en moins de 2 secondes.',
  },
  {
    num: '03',
    icon: TrendingUp,
    color: 'amber',
    gradient: 'from-amber-500 to-orange-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'Prix & analyse complète',
    desc: "Valeur Cardmarket en temps réel, estimation PSA, historique de prix et score d'investissement.",
  },
] as const

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28">
      {/* Divider line */}
      <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-20 md:mb-28" />

      {/* Header */}
      <div className="text-center mb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="inline-flex mb-4"
        >
          <span className="section-label">Simple & rapide</span>
        </motion.div>
        <motion.h2
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
        >
          Comment ça marche
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.14 }}
          className="text-gray-500 text-lg max-w-md mx-auto"
        >
          En 3 étapes simples, découvrez tout ce que vaut votre carte Pokémon.
        </motion.p>
      </div>

      {/* Steps */}
      <div className="grid md:grid-cols-3 gap-8 relative">
        {/* Connecting line (desktop) */}
        <div className="hidden md:block absolute top-10 left-[calc(16.67%+2rem)] right-[calc(16.67%+2rem)] h-px bg-gradient-to-r from-blue-200 via-violet-200 to-amber-200" />

        {steps.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ delay: i * 0.14, duration: 0.5 }}
            className="flex flex-col items-center text-center"
          >
            {/* Icon with number */}
            <div className="relative mb-6">
              <div className={`w-20 h-20 rounded-3xl bg-gradient-to-br ${step.gradient} flex items-center justify-center shadow-lg`}>
                <step.icon className="w-9 h-9 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-white border-2 border-gray-200 shadow-sm flex items-center justify-center">
                <span className="text-[10px] font-bold text-gray-500">{step.num}</span>
              </div>
            </div>

            <h3 className="text-lg font-bold text-gray-900 mb-3">{step.title}</h3>
            <p className="text-gray-500 text-sm leading-relaxed max-w-[240px]">{step.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
