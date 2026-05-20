'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Check, Sparkles, Zap, Crown } from 'lucide-react'
import { SignInButton, useUser } from '@clerk/nextjs'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

const PLANS = [
  {
    key: 'free',
    label: 'Gratuit',
    price: '0€',
    sub: 'Pour découvrir PokeScard',
    color: 'rgba(255,255,255,0.04)',
    border: 'rgba(255,255,255,0.10)',
    badge: null,
    features: [
      { text: '3 scans IA / mois', ok: true },
      { text: '20 000+ cartes FR', ok: true },
      { text: 'Prix Cardmarket actuels', ok: true },
      { text: 'Historique 30 jours', ok: true },
      { text: 'Portfolio jusqu\'à 10 cartes', ok: true },
      { text: 'Alertes de prix', ok: false },
      { text: 'Score investissement', ok: false },
      { text: 'AI Insights', ok: false },
      { text: 'Analyse IA par carte', ok: false },
      { text: 'Export CSV', ok: false },
    ],
  },
  {
    key: 'pro',
    label: 'Premium',
    price: '7€',
    sub: 'Pour le collectionneur sérieux',
    color: 'rgba(255,203,5,0.06)',
    border: 'rgba(255,203,5,0.35)',
    badge: '⭐ Populaire',
    badgeStyle: { background: 'rgba(255,203,5,0.15)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.3)' },
    features: [
      { text: '30 scans IA / mois', ok: true },
      { text: '20 000+ cartes FR', ok: true },
      { text: 'Prix Cardmarket actuels', ok: true },
      { text: 'Historique 1 an', ok: true },
      { text: 'Portfolio illimité', ok: true },
      { text: '10 alertes de prix', ok: true },
      { text: 'Score investissement sur chaque carte', ok: true },
      { text: 'AI Insights : Carte du mois + Momentum + Hype', ok: true },
      { text: 'Analyse IA par carte', ok: false },
      { text: 'Export CSV', ok: false },
    ],
  },
  {
    key: 'elite',
    label: 'Elite',
    price: '15€',
    sub: 'Pour l\'investisseur avancé',
    color: 'rgba(167,139,250,0.06)',
    border: 'rgba(167,139,250,0.35)',
    badge: '👑 Complet',
    badgeStyle: { background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' },
    features: [
      { text: 'Scans IA illimités', ok: true },
      { text: '20 000+ cartes FR', ok: true },
      { text: 'Prix Cardmarket actuels', ok: true },
      { text: 'Historique complet', ok: true },
      { text: 'Portfolio illimité', ok: true },
      { text: 'Alertes illimitées', ok: true },
      { text: 'Score investissement sur chaque carte', ok: true },
      { text: 'AI Insights complet (toutes catégories)', ok: true },
      { text: 'Analyse IA détaillée par carte', ok: true },
      { text: 'Export CSV de la collection', ok: true },
    ],
  },
]

function PlanButton({ planKey, currentTier, isSignedIn, promoCode }: {
  planKey: string
  currentTier: string
  isSignedIn: boolean
  promoCode?: string
}) {
  const [loading, setLoading] = useState(false)

  const isCurrentPlan =
    (planKey === 'free' && currentTier === 'FREE') ||
    (planKey === 'pro' && (currentTier === 'PRO' || currentTier === 'STARTER')) ||
    (planKey === 'elite' && currentTier === 'ELITE')

  const isUpgrade =
    (planKey === 'elite' && (currentTier === 'PRO' || currentTier === 'STARTER')) ||
    (planKey === 'pro' && currentTier === 'FREE') ||
    (planKey === 'elite' && currentTier === 'FREE')

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey, promoCode }),
      })
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch { /* not json */ }
      if (data.url) {
        window.location.href = data.url
      } else {
        alert(`Erreur ${res.status}: ${data.error ?? text.slice(0, 200) ?? 'Réponse vide'}`)
        setLoading(false)
      }
    } catch (e: any) {
      alert(`Erreur réseau : ${e.message}`)
      setLoading(false)
    }
  }

  const handlePortal = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { setLoading(false) }
  }

  if (planKey === 'free') {
    return (
      <button disabled className="w-full py-3 rounded-xl text-sm font-semibold cursor-default"
        style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.3)' }}>
        {currentTier === 'FREE' ? 'Plan actuel' : 'Inclus'}
      </button>
    )
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="redirect" forceRedirectUrl={promoCode ? `/pricing?promo=${promoCode}` : '/pricing'}>
        <button className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110"
          style={planKey === 'elite'
            ? { background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' }
            : { background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18' }}>
          Commencer — {planKey === 'elite' ? '15€' : '7€'} / mois
        </button>
      </SignInButton>
    )
  }

  if (isCurrentPlan) {
    return (
      <button onClick={handlePortal} disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}>
        {loading ? 'Chargement...' : 'Gérer l\'abonnement'}
      </button>
    )
  }

  if (isUpgrade) {
    return (
      <button onClick={handleCheckout} disabled={loading}
        className="w-full py-3 rounded-xl text-sm font-bold transition-all hover:brightness-110 disabled:opacity-50"
        style={planKey === 'elite'
          ? { background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff', boxShadow: '0 0 20px rgba(167,139,250,0.25)' }
          : { background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18', boxShadow: '0 0 20px rgba(255,203,5,0.25)' }}>
        {loading ? 'Redirection...' : `Passer ${planKey === 'elite' ? 'Elite' : 'Premium'} — ${planKey === 'elite' ? '15€' : '7€'} / mois`}
      </button>
    )
  }

  return null
}

function PricingContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')
  const successPlan = searchParams.get('plan')
  const promoCode = searchParams.get('promo')?.toUpperCase() || undefined
  const { isSignedIn } = useUser()

  const { data: userInfo } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => fetch('/api/user/me').then(r => r.ok ? r.json() : null),
    enabled: !!isSignedIn,
    staleTime: 60_000,
  })

  const currentTier = userInfo?.tier ?? 'FREE'

  return (
    <main className="container mx-auto px-4 py-12 max-w-5xl">
      {/* Banners */}
      {success && (
        <div className="mb-8 p-4 rounded-2xl text-center"
          style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
          <p className="font-semibold text-green-400">
            🎉 Bienvenue en {successPlan === 'elite' ? 'Elite' : 'Premium'} ! Ton abonnement est actif.
          </p>
        </div>
      )}
      {canceled && (
        <div className="mb-8 p-4 rounded-2xl text-center"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)' }}>
          <p className="text-white/50">Paiement annulé. Tu peux réessayer à tout moment.</p>
        </div>
      )}
      {promoCode && !success && (
        <div className="mb-8 p-4 rounded-2xl text-center"
          style={{ background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.25)' }}>
          <p className="font-semibold text-pokemon-yellow">
            🎁 Code <span className="font-mono">{promoCode}</span> appliqué — -10% sur ton premier mois !
          </p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-4"
          style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.20)', color: '#FFCB05' }}>
          <Sparkles className="w-4 h-4" /> Simple et transparent
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Choisissez votre plan</h1>
        <p className="text-white/45 text-lg">Commencez gratuitement, upgradez quand vous êtes prêt</p>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {PLANS.map(plan => {
          const isCurrentPlan =
            (plan.key === 'free' && currentTier === 'FREE') ||
            (plan.key === 'pro' && (currentTier === 'PRO' || currentTier === 'STARTER')) ||
            (plan.key === 'elite' && currentTier === 'ELITE')

          return (
            <div key={plan.key} className="relative rounded-3xl p-7 flex flex-col"
              style={{
                background: plan.color,
                border: `1px solid ${isCurrentPlan ? plan.border : 'rgba(255,255,255,0.08)'}`,
                boxShadow: isCurrentPlan ? `0 0 30px ${plan.color}` : 'none',
              }}>
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="text-xs font-bold px-3 py-1 rounded-full"
                    style={plan.badgeStyle as any}>
                    {plan.badge}
                  </span>
                </div>
              )}

              {/* Plan header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  {plan.key === 'free' && <Zap className="w-4 h-4 text-white/40" />}
                  {plan.key === 'pro' && <Sparkles className="w-4 h-4 text-pokemon-yellow" />}
                  {plan.key === 'elite' && <Crown className="w-4 h-4 text-purple-400" />}
                  <p className="text-sm font-bold uppercase tracking-wider"
                    style={{ color: plan.key === 'free' ? 'rgba(255,255,255,0.4)' : plan.key === 'pro' ? '#FFCB05' : '#A78BFA' }}>
                    {plan.label}
                  </p>
                </div>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.key !== 'free' && <span className="text-white/40 text-sm">/ mois</span>}
                </div>
                <p className="text-white/40 text-sm">{plan.sub}</p>
              </div>

              {/* Features */}
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    {f.ok
                      ? <Check className="w-4 h-4 shrink-0 mt-0.5"
                          style={{ color: plan.key === 'free' ? 'rgba(255,255,255,0.3)' : plan.key === 'pro' ? '#FFCB05' : '#A78BFA' }} />
                      : <span className="w-4 h-4 shrink-0 mt-0.5 flex items-center justify-center text-white/20 text-xs">✗</span>
                    }
                    <span style={{ color: f.ok ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.25)' }}>
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <PlanButton planKey={plan.key} currentTier={currentTier} isSignedIn={!!isSignedIn} promoCode={plan.key !== 'free' ? promoCode : undefined} />
            </div>
          )
        })}
      </div>

      {/* Guarantee */}
      <p className="text-center text-white/25 text-sm mt-10">
        Résiliation à tout moment · Paiement sécurisé par Stripe · Sans engagement
      </p>
    </main>
  )
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Suspense fallback={<div className="h-96 flex items-center justify-center"><div className="skeleton h-8 w-48 rounded-xl" /></div>}>
        <PricingContent />
      </Suspense>
      <Footer />
    </div>
  )
}
