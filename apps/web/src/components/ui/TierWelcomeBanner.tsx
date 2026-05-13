'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { X, Crown, Star, Zap } from 'lucide-react'
import { useUserTier } from '@/lib/useUserTier'

export function TierWelcomeBanner() {
  const { tier, isPremium, isElite } = useUserTier()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (!isPremium) return
    const key = `tier-banner-${tier}`
    const already = sessionStorage.getItem(key)
    if (!already) {
      setVisible(true)
    }
  }, [tier, isPremium])

  const dismiss = () => {
    sessionStorage.setItem(`tier-banner-${tier}`, '1')
    setDismissed(true)
    setTimeout(() => setVisible(false), 300)
  }

  if (!visible || !isPremium) return null

  if (isElite) {
    return (
      <div
        className={`transition-all duration-300 ${dismissed ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(167,139,250,0.08))',
          borderBottom: '1px solid rgba(167,139,250,0.20)',
        }}>
        <div className="container mx-auto px-4 max-w-[1600px] py-2.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-sm">
            <Crown className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <span style={{ color: '#A78BFA' }} className="font-semibold">Mode Elite actif</span>
            <span className="text-white/40 hidden sm:inline">— Toutes les fonctionnalités débloquées : AI Insights complet, analyse par carte, export CSV</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/ai" className="text-xs font-semibold px-3 py-1 rounded-full transition-all hover:brightness-110"
              style={{ background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }}>
              Voir les picks IA
            </Link>
            <button onClick={dismiss} className="text-white/30 hover:text-white/60 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`transition-all duration-300 ${dismissed ? 'opacity-0 -translate-y-2' : 'opacity-100 translate-y-0'}`}
      style={{
        background: 'linear-gradient(135deg, rgba(255,203,5,0.08), rgba(245,158,11,0.04))',
        borderBottom: '1px solid rgba(255,203,5,0.15)',
      }}>
      <div className="container mx-auto px-4 max-w-[1600px] py-2.5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 text-sm">
          <Star className="w-4 h-4 text-pokemon-yellow flex-shrink-0" />
          <span className="text-pokemon-yellow font-semibold">Mode Premium actif</span>
          <span className="text-white/40 hidden sm:inline">— AI Insights, historique 1 an, portfolio illimité</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/ai" className="text-xs font-semibold px-3 py-1 rounded-full transition-all hover:brightness-110"
            style={{ background: 'rgba(255,203,5,0.12)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.25)' }}>
            Voir les picks IA
          </Link>
          <Link href="/pricing" className="text-xs text-white/30 hover:text-purple-400 transition-colors hidden sm:block">
            Passer Elite →
          </Link>
          <button onClick={dismiss} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
