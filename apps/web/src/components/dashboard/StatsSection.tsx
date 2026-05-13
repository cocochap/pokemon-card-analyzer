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

  return <span ref={ref}>{prefix}{count.toLocaleString('fr-FR')}{suffix}</span>
}

const stats = [
  { icon: Database,   color: '#FFCB05', label: 'Cartes en base de données',    value: 22000, suffix: '+',  display: '22 000+', desc: 'Base Set aux dernières extensions SV' },
  { icon: Sparkles,   color: '#A78BFA', label: "Précision d'identification",   value: 94,    suffix: '%',  display: '94%',     desc: "Taux d'identification correct" },
  { icon: Zap,        color: '#22C55E', label: 'Vitesse de scan',              value: 2,     suffix: 's',  display: '< 2s',    desc: 'De la photo au résultat complet' },
  { icon: RefreshCw,  color: '#60A5FA', label: 'Mise à jour des prix',         value: 0,     suffix: '',   display: '1/j',     desc: 'Prix Cardmarket actualisés chaque matin' },
] as const

export function StatsSection() {
  return (
    <section className="py-20 md:py-24">
      <div className="relative rounded-3xl overflow-hidden p-8 md:p-14"
        style={{
          background: 'linear-gradient(135deg, rgba(255,203,5,0.06) 0%, rgba(15,23,42,0.95) 50%, rgba(6,9,24,0.98) 100%)',
          border: '1px solid rgba(255,203,5,0.15)',
          boxShadow: '0 0 60px rgba(255,203,5,0.05)',
        }}>

        {/* Gold shimmer */}
        <div className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,203,5,0.5), transparent)' }} />

        {/* Ambient glows */}
        <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-3xl pointer-events-none"
          style={{ background: 'rgba(255,203,5,0.04)' }} />
        <div className="absolute -bottom-10 -left-10 w-56 h-56 rounded-full blur-2xl pointer-events-none"
          style={{ background: 'rgba(167,139,250,0.06)' }} />

        {/* Header */}
        <div className="text-center mb-12">
          <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-sm font-semibold mb-4"
            style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.20)', color: '#FFCB05' }}>
            <Sparkles className="w-3.5 h-3.5" />
            Nos chiffres
          </motion.div>
          <motion.h2 initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.08 }} className="text-3xl md:text-4xl font-bold text-white mb-3">
            La plateforme de référence
          </motion.h2>
          <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
            transition={{ delay: 0.14 }} className="text-white/40 text-lg">
            Pour les collectionneurs Pokémon TCG sérieux.
          </motion.p>
        </div>

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
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-4"
                style={{ background: `${stat.color}15`, border: `1px solid ${stat.color}30` }}>
                <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
              </div>
              <div className="text-3xl md:text-4xl font-bold text-white mb-1 tabular-nums"
                style={{ color: stat.color }}>
                {stat.display}
              </div>
              <div className="text-sm font-semibold text-white/60 mb-1">{stat.label}</div>
              <div className="text-xs text-white/30">{stat.desc}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
