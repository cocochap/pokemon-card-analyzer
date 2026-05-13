'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Camera, CheckCircle2, Sparkles, TrendingUp, Zap, Lock } from 'lucide-react'
import Link from 'next/link'
import { ScanUpload } from './ScanUpload'
import { useT } from '@/lib/i18n/LanguageContext'
import { useUserTier } from '@/lib/useUserTier'
import { useAuth } from '@clerk/nextjs'

const tips = [
  'Bonne luminosité, carte à plat',
  'Photo nette, pas floue',
  'Toute la carte visible',
  'Éviter les reflets holographiques',
]

function ScanCounter() {
  const { isSignedIn } = useAuth()
  const { isPremium, isElite } = useUserTier()

  const { data } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => fetch('/api/user/me').then(r => r.ok ? r.json() : null),
    enabled: !!isSignedIn,
    staleTime: 30_000,
  })

  if (!isSignedIn) return null

  const used = data?.scanUsage ?? 0
  const limit = isElite ? Infinity : isPremium ? 30 : 3
  const remaining = limit === Infinity ? Infinity : limit - used
  const isLow = remaining !== Infinity && remaining <= 1

  if (limit === Infinity) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{ background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.25)', color: '#22C55E' }}>
        <CheckCircle2 className="w-3.5 h-3.5" />
        Scans illimités
      </div>
    )
  }

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
      style={{
        background: isLow ? 'rgba(239,68,68,0.10)' : 'rgba(255,203,5,0.10)',
        border: `1px solid ${isLow ? 'rgba(239,68,68,0.25)' : 'rgba(255,203,5,0.25)'}`,
        color: isLow ? '#EF4444' : '#FFCB05',
      }}>
      <Camera className="w-3.5 h-3.5" />
      {remaining > 0
        ? `${remaining} scan${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''} ce mois`
        : 'Limite mensuelle atteinte'}
      {!isPremium && (
        <Link href="/pricing" className="underline underline-offset-2 ml-1 hover:opacity-80">
          Upgrader →
        </Link>
      )}
    </div>
  )
}

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
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5"
          style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.25)', color: '#FFCB05' }}
        >
          <Camera className="w-4 h-4" />
          {s.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.07 }}
          className="text-3xl md:text-5xl font-bold tracking-tight mb-4 leading-tight text-white"
        >
          {s.pageTitle}{' '}
          <span style={{ background: 'linear-gradient(135deg,#FFCB05,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            {s.pageTitleHighlight}
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.13 }}
          className="text-white/50 text-lg max-w-xl mx-auto mb-4"
        >
          {s.pageSubtitle}
        </motion.p>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <ScanCounter />
        </motion.div>
      </div>

      {/* Main layout */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18 }}
        className="grid lg:grid-cols-[1fr_310px] gap-8 items-start mb-16"
      >
        <ScanUpload />

        <div className="space-y-4 lg:sticky lg:top-24">
          {[
            { icon: CheckCircle2, color: '#FFCB05', bg: 'rgba(255,203,5,0.10)', border: 'rgba(255,203,5,0.20)', title: '94% de précision', desc: 'Identification sur 22 000+ cartes, toutes extensions confondues.' },
            { icon: Zap,          color: '#A78BFA', bg: 'rgba(167,139,250,0.10)', border: 'rgba(167,139,250,0.20)', title: 'Résultat en < 2s', desc: 'Notre IA analyse et identifie votre carte instantanément.' },
            { icon: TrendingUp,   color: '#22C55E', bg: 'rgba(34,197,94,0.10)',  border: 'rgba(34,197,94,0.20)',  title: 'Prix Cardmarket live', desc: 'Valeur de marché actualisée quotidiennement depuis Cardmarket.' },
          ].map(({ icon: Icon, color, bg, border, title, desc }) => (
            <div key={title} className="glass-card p-4 flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: bg, border: `1px solid ${border}` }}>
                <Icon className="w-[18px] h-[18px]" style={{ color }} />
              </div>
              <div>
                <p className="font-semibold text-white text-sm mb-0.5">{title}</p>
                <p className="text-xs text-white/45 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}

          <div className="rounded-2xl p-4"
            style={{ background: 'rgba(255,203,5,0.06)', border: '1px solid rgba(255,203,5,0.15)' }}>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-pokemon-yellow" />
              <p className="font-semibold text-pokemon-yellow text-sm">Meilleurs résultats</p>
            </div>
            <ul className="space-y-1.5">
              {tips.map(tip => (
                <li key={tip} className="flex items-center gap-2 text-xs text-white/55">
                  <div className="w-1.5 h-1.5 rounded-full bg-pokemon-yellow flex-shrink-0" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <Link href="/pricing" className="block rounded-2xl p-4 transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,rgba(255,203,5,0.06),rgba(167,139,250,0.04))', border: '1px solid rgba(255,203,5,0.12)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <Lock className="w-3.5 h-3.5 text-pokemon-yellow" />
              <p className="font-semibold text-pokemon-yellow text-sm">Scans illimités avec Elite</p>
            </div>
            <p className="text-xs text-white/35 leading-relaxed">
              Premium : 30 scans/mois · Elite : illimité
            </p>
          </Link>
        </div>
      </motion.div>
    </main>
  )
}
