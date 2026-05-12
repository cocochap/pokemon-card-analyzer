'use client'

import { motion } from 'framer-motion'
import { Camera, Shield, Sparkles, TrendingUp, Zap } from 'lucide-react'
import { ScanUpload } from './ScanUpload'
import { useT } from '@/lib/i18n/LanguageContext'

const features = [
  {
    icon: Shield,
    gradient: 'from-blue-500 to-blue-700',
    title: '94% de précision',
    desc: "Identification confirmée sur 22 000+ cartes, toutes extensions confondues.",
  },
  {
    icon: Zap,
    gradient: 'from-violet-500 to-purple-700',
    title: 'Résultat en < 2 secondes',
    desc: "Notre IA analyse et identifie votre carte instantanément.",
  },
  {
    icon: TrendingUp,
    gradient: 'from-green-500 to-emerald-700',
    title: 'Prix Cardmarket live',
    desc: "Valeur de marché quotidiennement mise à jour depuis Cardmarket.",
  },
]

const tips = [
  "Bonne luminosité, carte à plat",
  "Photo nette, pas floue",
  "Toute la carte visible",
  "Éviter les reflets holographiques",
]

export function ScanPageContent() {
  const t = useT()
  const s = t.scan

  return (
    <main className="container mx-auto px-4 max-w-5xl py-10">

      {/* Page header */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5 bg-blue-50 border border-blue-200 text-blue-700"
        >
          <Camera className="w-4 h-4" />
          {s.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="text-4xl md:text-5xl font-bold tracking-tight mb-4 leading-tight text-gray-900"
        >
          {s.pageTitle}{' '}
          <span className="gradient-text-electric">{s.pageTitleHighlight}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          className="text-gray-500 text-lg max-w-xl mx-auto"
        >
          {s.pageSubtitle}
        </motion.p>
      </div>

      {/* Main layout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="grid lg:grid-cols-[1fr_360px] gap-8 items-start mb-16"
      >
        {/* Left: Scan upload */}
        <ScanUpload />

        {/* Right: Sidebar */}
        <div className="space-y-4 lg:sticky lg:top-24">
          {/* Feature cards */}
          {features.map(({ icon: Icon, gradient, title, desc }) => (
            <div key={title} className="glass-card p-4 flex items-start gap-3.5">
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center flex-shrink-0 shadow-sm`}>
                <Icon className="w-4.5 h-4.5 text-white" style={{ width: '18px', height: '18px' }} />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm mb-0.5">{title}</p>
                <p className="text-xs text-gray-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}

          {/* Tips */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-amber-600" />
              <p className="font-semibold text-amber-800 text-sm">Meilleurs résultats</p>
            </div>
            <ul className="space-y-1.5">
              {tips.map(tip => (
                <li key={tip} className="flex items-center gap-2 text-xs text-amber-700">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </motion.div>

    </main>
  )
}
