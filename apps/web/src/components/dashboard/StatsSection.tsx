'use client'

import { motion, useInView } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Database, RefreshCw, Sparkles, Zap } from 'lucide-react'

function AnimatedCounter({ target, suffix = '', prefix = '' }: { target: number; suffix?: string; prefix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })

  useEffect(() => {
    if (!inView) return
    const duration = 1800
    const startTime = Date.now()
    const tick = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))
      if (progress < 1) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, [inView, target])

  return (
    <span ref={ref}>
      {prefix}{count.toLocaleString('fr-FR')}{suffix}
    </span>
  )
}

const stats = [
  {
    icon: Database,
    gradient: 'from-blue-500 to-blue-700',
    label: 'Cartes en base de données',
    value: 22000,
    suffix: '+',
    display: '22 000+',
    desc: 'Toutes extensions, Base Set aux dernières SV',
  },
  {
    icon: Sparkles,
    gradient: 'from-violet-500 to-purple-700',
    label: "Précision d'identification",
    value: 94,
    suffix: '%',
    display: '94%',
    desc: "Taux d'identification correct sur nos tests",
  },
  {
    icon: Zap,
    gradient: 'from-amber-500 to-orange-600',
    label: 'Vitesse de scan',
    value: 2,
    suffix: 's',
    prefix: '<',
    display: '< 2s',
    desc: 'De la photo au résultat complet',
  },
  {
    icon: RefreshCw,
    gradient: 'from-green-500 to-emerald-700',
    label: 'Mise à jour des prix',
    value: 0,
    suffix: '',
    display: '1/j',
    desc: 'Prix Cardmarket actualisés chaque matin',
  },
]

export function StatsSection() {
  return (
    <section className="py-20 md:py-24">
      {/* Background */}
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-blue-800" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-amber-400/20 rounded-full blur-2xl" />
        </div>

        <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl p-8 md:p-14 overflow-hidden relative">
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-72 h-72 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-10 -left-10 w-56 h-56 bg-amber-400/15 rounded-full blur-2xl pointer-events-none" />

          {/* Header */}
          <div className="text-center mb-12">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white/15 border border-white/20 rounded-full text-sm font-semibold text-white/90 mb-4"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Nos chiffres
            </motion.div>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.08 }}
              className="text-3xl md:text-4xl font-bold text-white mb-3"
            >
              La plateforme de référence
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.14 }}
              className="text-blue-200 text-lg"
            >
              Pour les collectionneurs Pokémon TCG sérieux.
            </motion.p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-30px' }}
                transition={{ delay: i * 0.10, duration: 0.5 }}
                className="text-center"
              >
                {/* Icon */}
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mx-auto mb-4 shadow-lg`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>

                {/* Value */}
                <div className="text-3xl md:text-4xl font-bold text-white mb-1 tabular-nums">
                  {stat.display}
                </div>

                {/* Label */}
                <div className="text-sm font-semibold text-white/80 mb-1">{stat.label}</div>
                <div className="text-xs text-blue-300">{stat.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
