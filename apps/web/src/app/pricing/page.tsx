'use client'

import { useState, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Check, Sparkles, Lock, Zap, BarChart2, Bell, Download, Scan, TrendingUp } from 'lucide-react'
import { SignInButton, useUser } from '@clerk/nextjs'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { clsx } from 'clsx'

const FREE_FEATURES = [
  { text: 'Catalogue de 20 000+ cartes FR' },
  { text: 'Prix Cardmarket en temps réel' },
  { text: 'Historique 90 jours' },
  { text: '3 alertes de prix' },
  { text: '5 scans IA / mois' },
  { text: 'Portfolio jusqu\'à 50 cartes' },
]

const PREMIUM_FEATURES = [
  { text: 'Historique étendu 1 an', soon: false },
  { text: 'Alertes illimitées', soon: false },
  { text: 'Scans IA illimités', soon: false },
  { text: 'Portfolio illimité + P&L détaillé', soon: false },
  { text: 'Export CSV de la collection', soon: false },
  { text: 'Rapport hebdo personnalisé', soon: false },
  { text: 'Détection de faux', soon: true },
  { text: 'Signaux de momentum', soon: true },
]

function CheckoutButton({ isPremium, isSignedIn }: { isPremium: boolean; isSignedIn: boolean }) {
  const [loading, setLoading] = useState(false)

  const handleCheckout = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/checkout', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { setLoading(false) }
  }

  const handlePortal = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch { setLoading(false) }
  }

  if (!isSignedIn) {
    return (
      <SignInButton mode="redirect" forceRedirectUrl="/pricing">
        <button className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm hover:opacity-90 transition-opacity">
          S'inscrire et passer Premium
        </button>
      </SignInButton>
    )
  }

  if (isPremium) {
    return (
      <button
        onClick={handlePortal}
        disabled={loading}
        className="w-full py-3 rounded-xl bg-amber-100 text-amber-800 font-semibold text-sm hover:bg-amber-200 transition-colors disabled:opacity-50"
      >
        {loading ? 'Chargement...' : 'Gérer l\'abonnement'}
      </button>
    )
  }

  return (
    <button
      onClick={handleCheckout}
      disabled={loading}
      className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 text-white font-bold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
    >
      {loading ? 'Redirection vers Stripe...' : 'Passer Premium — 7€ / mois'}
    </button>
  )
}

function PricingContent() {
  const searchParams = useSearchParams()
  const success = searchParams.get('success')
  const canceled = searchParams.get('canceled')
  const { isSignedIn } = useUser()

  const { data: userInfo } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => fetch('/api/user/me').then(r => r.ok ? r.json() : null),
    enabled: !!isSignedIn,
    staleTime: 60_000,
  })

  const isPremium = userInfo?.tier === 'PRO' || userInfo?.tier === 'ELITE'

  return (
    <main className="container mx-auto px-4 py-12 max-w-4xl">
      {/* Banners */}
      {success && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-2xl text-center">
          <p className="font-semibold text-green-800">🎉 Bienvenue en Premium ! Ton abonnement est actif.</p>
        </div>
      )}
      {canceled && (
        <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded-2xl text-center">
          <p className="text-gray-600">Paiement annulé. Tu peux réessayer à tout moment.</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-100 text-amber-700 rounded-full text-sm font-medium mb-4">
          <Sparkles className="w-4 h-4" /> Simple et transparent
        </div>
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Choisissez votre plan</h1>
        <p className="text-gray-500 text-lg">Commencez gratuitement, upgradez quand vous êtes prêt</p>
      </div>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* Free */}
        <div className="bg-white border border-gray-200 rounded-3xl p-7 flex flex-col">
          <div className="mb-6">
            <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Gratuit</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold text-gray-900">0€</span>
              <span className="text-gray-400 text-sm">/ mois</span>
            </div>
            <p className="text-gray-400 text-sm mt-1">Pour découvrir la plateforme</p>
          </div>
          <ul className="space-y-3 flex-1 mb-6">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className="flex items-center gap-3 text-sm text-gray-600">
                <Check className="w-4 h-4 text-gray-300 shrink-0" />
                {f.text}
              </li>
            ))}
          </ul>
          <button disabled className="w-full py-3 rounded-xl bg-gray-100 text-gray-400 font-semibold text-sm cursor-default">
            Plan actuel
          </button>
        </div>

        {/* Premium */}
        <div className={clsx(
          'rounded-3xl p-7 flex flex-col relative overflow-hidden',
          isPremium
            ? 'bg-gradient-to-b from-amber-50 to-orange-50 border-2 border-amber-300'
            : 'bg-gray-900 text-white',
        )}>
          {isPremium ? (
            <div className="absolute top-5 right-5 bg-amber-400 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
              <Check className="w-3 h-3" /> Actif
            </div>
          ) : (
            <div className="absolute top-5 right-5 bg-amber-400 text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full">
              ⭐ Populaire
            </div>
          )}

          <div className="mb-6">
            <p className={clsx('text-sm font-semibold uppercase tracking-wider mb-2', isPremium ? 'text-amber-600' : 'text-amber-400')}>
              Premium
            </p>
            <div className="flex items-baseline gap-1">
              <span className={clsx('text-4xl font-bold', isPremium ? 'text-gray-900' : 'text-white')}>7€</span>
              <span className={clsx('text-sm', isPremium ? 'text-gray-400' : 'text-gray-400')}>/ mois</span>
            </div>
            <p className={clsx('text-sm mt-1', isPremium ? 'text-gray-500' : 'text-gray-400')}>
              Tout ce qu'il faut pour investir sérieusement
            </p>
          </div>

          <ul className="space-y-3 flex-1 mb-6">
            {FREE_FEATURES.map((f, i) => (
              <li key={i} className={clsx('flex items-center gap-3 text-sm', isPremium ? 'text-gray-400' : 'text-gray-500')}>
                <Check className={clsx('w-4 h-4 shrink-0', isPremium ? 'text-gray-300' : 'text-gray-700')} />
                {f.text}
              </li>
            ))}
            <li className={clsx('border-t my-2', isPremium ? 'border-amber-200' : 'border-gray-700')} />
            {PREMIUM_FEATURES.map((f, i) => (
              <li key={i} className={clsx('flex items-center gap-3 text-sm', isPremium ? 'text-gray-700 font-medium' : 'text-white font-medium')}>
                <Check className="w-4 h-4 text-amber-400 shrink-0" />
                {f.text}
                {f.soon && (
                  <span className={clsx('text-xs ml-auto', isPremium ? 'text-gray-400' : 'text-gray-500')}>bientôt</span>
                )}
              </li>
            ))}
          </ul>

          <CheckoutButton isPremium={isPremium} isSignedIn={!!isSignedIn} />
        </div>
      </div>

      {/* Guarantee */}
      <p className="text-center text-gray-400 text-sm mt-10">
        Résiliation à tout moment · Paiement sécurisé par Stripe · Aucun engagement
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
