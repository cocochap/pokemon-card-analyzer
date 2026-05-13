'use client'

import Link from 'next/link'
import { SignInButton } from '@clerk/nextjs'
import { Lock, Sparkles, TrendingUp, Gem, Trophy, Zap } from 'lucide-react'

const PREVIEW_CARDS = [
  { name: 'Charizard ex', set: 'Écarlate et Violet', score: 91, change: '+34.2%', price: '€89.99' },
  { name: 'Rayquaza VMAX', set: 'Épée et Bouclier', score: 84, change: '+18.7%', price: '€42.50' },
  { name: 'Mewtwo ex', set: 'SV5', score: 79, change: '+11.4%', price: '€28.00' },
]

export function AiLockedState({ reason }: { reason: 'auth' | 'premium' }) {
  return (
    <div className="relative">
      {/* Blurred preview */}
      <div className="pointer-events-none select-none blur-sm opacity-40 space-y-8">
        {/* Fake hero */}
        <div className="rounded-2xl p-8 h-64"
          style={{ background: 'linear-gradient(135deg, rgba(255,203,5,0.06), rgba(6,9,24,0.95))', border: '1px solid rgba(255,203,5,0.2)' }}>
          <div className="flex gap-6 h-full items-center">
            <div className="w-36 h-48 rounded-xl bg-white/10 flex-shrink-0" />
            <div className="space-y-3 flex-1">
              <div className="h-4 w-24 rounded bg-pokemon-yellow/30" />
              <div className="h-8 w-64 rounded bg-white/10" />
              <div className="h-4 w-48 rounded bg-white/10" />
              <div className="grid grid-cols-4 gap-3 mt-4">
                {[1,2,3,4].map(i => <div key={i} className="h-14 rounded-xl bg-white/8" />)}
              </div>
            </div>
          </div>
        </div>

        {/* Fake cards grid */}
        <div>
          <div className="h-6 w-40 rounded bg-white/10 mb-4" />
          <div className="grid grid-cols-3 gap-4">
            {PREVIEW_CARDS.map((c, i) => (
              <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,203,5,0.2)' }}>
                <div className="aspect-[3/4] bg-white/5 flex items-center justify-center text-4xl">🃏</div>
                <div className="p-3 space-y-1">
                  <div className="font-semibold text-sm">{c.name}</div>
                  <div className="text-xs text-white/40">{c.set}</div>
                  <div className="flex justify-between text-sm">
                    <span className="text-pokemon-yellow font-bold">{c.price}</span>
                    <span className="text-green-400">{c.change}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-6 py-8 rounded-2xl max-w-md w-full mx-4"
          style={{
            background: 'rgba(6,9,24,0.92)',
            border: '1px solid rgba(255,203,5,0.3)',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 0 60px rgba(0,0,0,0.8)',
          }}>

          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)' }}>
            {reason === 'premium' ? (
              <Sparkles className="w-8 h-8 text-pokemon-yellow" />
            ) : (
              <Lock className="w-8 h-8 text-pokemon-yellow" />
            )}
          </div>

          <h3 className="text-xl font-bold mb-2">
            {reason === 'premium' ? 'Fonctionnalité Premium' : 'Connexion requise'}
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            {reason === 'premium'
              ? "Les analyses d'investissement IA — picks du mois, gemmes sous-évaluées, opportunités momentum — sont réservées aux abonnés Premium."
              : "Connectez-vous pour accéder aux analyses d'investissement générées par l'IA."}
          </p>

          {/* Feature list */}
          <div className="space-y-2 mb-6 text-left">
            {[
              { icon: <Trophy className="w-4 h-4 text-pokemon-yellow" />, text: 'Carte du mois sélectionnée par IA' },
              { icon: <TrendingUp className="w-4 h-4 text-green-400" />, text: 'Top 5 picks momentum en temps réel' },
              { icon: <Gem className="w-4 h-4 text-blue-400" />, text: 'Gemmes sous-évaluées avec potentiel maximal' },
              { icon: <Sparkles className="w-4 h-4 text-purple-400" />, text: 'Narratives IA + cibles de prix détaillées' },
            ].map(({ icon, text }, i) => (
              <div key={i} className="flex items-center gap-2.5 text-sm text-white/60">
                {icon}
                {text}
              </div>
            ))}
          </div>

          {reason === 'premium' ? (
            <Link href="/pricing"
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18' }}>
              <Zap className="w-4 h-4" />
              Passer à Premium — 7€/mois
            </Link>
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/ai">
              <button className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm transition-all hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18' }}>
                Se connecter
              </button>
            </SignInButton>
          )}
        </div>
      </div>
    </div>
  )
}
