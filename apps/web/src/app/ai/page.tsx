'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { InvestmentPickCard } from '@/components/ai/InvestmentPickCard'
import { FeaturedPickHero } from '@/components/ai/FeaturedPickHero'
import { AiLockedState } from '@/components/ai/AiLockedState'
import { Sparkles, TrendingUp, Gem, Clock, Trophy, Zap } from 'lucide-react'
import { SealedPicksSection } from '@/components/sealed/SealedPicksSection'

async function fetchPicks(period: string) {
  const res = await fetch(`/api/ai/picks?period=${period}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.error ?? 'Erreur'), err)
  }
  return res.json()
}

export default function AiPage() {
  const { isSignedIn } = useAuth()
  const period = new Date().toISOString().slice(0, 7)

  const { data, isLoading, error } = useQuery({
    queryKey: ['investment-picks', period],
    queryFn: () => fetchPicks(period),
    retry: false,
    enabled: !!isSignedIn,
  })

  const picks = data?.picks ?? []
  const isElite = data?.isElite ?? false

  const featured = picks.find((p: any) => p.pickType === 'monthly_featured')
  const recentHype = picks.filter((p: any) => p.pickType === 'recent_hype').slice(0, 5)
  const momentum = picks.filter((p: any) => p.pickType === 'momentum').slice(0, 5)
  const undervalued = picks.filter((p: any) => p.pickType === 'undervalued').slice(0, 5)
  const longTerm = picks.filter((p: any) => p.pickType === 'long_term').slice(0, 5)

  const isLocked = !isSignedIn || (error as any)?.requiresAuth || (error as any)?.requiresPremium
  // PRO users see partial picks; undervalued + long_term are ELITE only
  const eliteLocked = isSignedIn && !isLocked && !isElite

  const monthLabel = new Date(period + '-01').toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">

        {/* Header */}
        <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(255,203,5,0.15)', border: '1px solid rgba(255,203,5,0.3)' }}>
                <Sparkles className="w-5 h-5 text-pokemon-yellow" />
              </div>
              <h1 className="text-3xl font-bold">AI Insights</h1>
              <span className="px-2 py-0.5 text-xs font-bold rounded-full"
                style={{ background: 'rgba(255,203,5,0.15)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.3)' }}>
                PREMIUM
              </span>
            </div>
            <p className="text-muted-foreground max-w-xl">
              Analyses d'investissement générées par IA — picks du mois, momentum, cartes sous-évaluées et opportunités long terme.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Clock className="w-3.5 h-3.5" />
            Mis à jour pour {monthLabel}
          </div>
        </div>

        {/* Locked state */}
        {isLocked && !isLoading && (
          <AiLockedState reason={(error as any)?.requiresPremium ? 'premium' : 'auth'} />
        )}

        {/* Loading skeleton */}
        {isLoading && (
          <div className="space-y-8">
            <div className="h-72 rounded-2xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="h-64 rounded-xl animate-pulse" style={{ background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        {!isLocked && !isLoading && picks.length === 0 && (
          <div className="text-center py-24 text-muted-foreground">
            <Sparkles className="w-10 h-10 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium mb-1">Analyses en cours de génération</p>
            <p className="text-sm">Les picks pour {monthLabel} seront disponibles très bientôt.</p>
          </div>
        )}

        {!isLocked && !isLoading && picks.length > 0 && (
          <div className="space-y-12">

            {/* Carte du mois */}
            {featured && (
              <section>
                <SectionHeader
                  icon={<Trophy className="w-5 h-5 text-pokemon-yellow" />}
                  title="Carte du mois"
                  subtitle={`Le meilleur investissement Pokémon TCG pour ${monthLabel}`}
                  badge="N°1"
                />
                <FeaturedPickHero pick={featured} />
              </section>
            )}

            {/* Hype récente */}
            {recentHype.length > 0 && (
              <section>
                <SectionHeader
                  icon={<Zap className="w-5 h-5 text-orange-400" />}
                  title="Hype récente"
                  subtitle="Cartes SV & SWSH — raretés SIR, Hyper Rare, Secret Rare en pleine croissance"
                  badge={`${recentHype.length} picks`}
                />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {recentHype.map((pick: any) => (
                    <InvestmentPickCard key={pick.id} pick={pick} accent="green" />
                  ))}
                </div>
              </section>
            )}

            {/* Momentum */}
            {momentum.length > 0 && (
              <section>
                <SectionHeader
                  icon={<TrendingUp className="w-5 h-5 text-green-400" />}
                  title="Top Momentum"
                  subtitle="Cartes en forte accélération haussière — opportunités court terme"
                  badge={`${momentum.length} picks`}
                />
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {momentum.map((pick: any) => (
                    <InvestmentPickCard key={pick.id} pick={pick} />
                  ))}
                </div>
              </section>
            )}

            {/* Undervalued — ELITE only */}
            {(undervalued.length > 0 || eliteLocked) && (
              <section>
                <SectionHeader
                  icon={<Gem className="w-5 h-5 text-blue-400" />}
                  title="Gemmes sous-évaluées"
                  subtitle="Cartes rares en dessous de leur valeur historique — fort potentiel de revalorisation"
                  badge="Elite"
                  badgePurple
                />
                {eliteLocked ? (
                  <EliteTeaser label="Gemmes sous-évaluées" />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {undervalued.map((pick: any) => (
                      <InvestmentPickCard key={pick.id} pick={pick} accent="blue" />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Long term — ELITE only */}
            {(longTerm.length > 0 || eliteLocked) && (
              <section>
                <SectionHeader
                  icon={<Sparkles className="w-5 h-5 text-purple-400" />}
                  title="Long terme"
                  subtitle="Cartes aux fondamentaux solides — horizon 6 à 18 mois"
                  badge="Elite"
                  badgePurple
                />
                {eliteLocked ? (
                  <EliteTeaser label="Long terme" />
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {longTerm.map((pick: any) => (
                      <InvestmentPickCard key={pick.id} pick={pick} accent="purple" />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Sealed products — Elite */}
            <section>
              <SealedPicksSection />
            </section>

            {/* Disclaimer */}
            <p className="text-xs text-muted-foreground/50 text-center pb-4">
              Ces analyses sont générées par intelligence artificielle à partir des données de marché disponibles.
              Elles ne constituent pas un conseil financier. Investissez en connaissance de cause.
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}

function SectionHeader({
  icon, title, subtitle, badge, badgePurple
}: {
  icon: React.ReactNode
  title: string
  subtitle: string
  badge?: string
  badgePurple?: boolean
}) {
  return (
    <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          {icon}
          <h2 className="text-xl font-bold">{title}</h2>
          {badge && (
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={badgePurple
                ? { background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.3)' }
                : { background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}>
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  )
}

function EliteTeaser({ label }: { label: string }) {
  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Blurred fake cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 blur-sm opacity-40 pointer-events-none select-none">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden aspect-[3/4]"
            style={{ background: 'rgba(167,139,250,0.08)', border: '1px solid rgba(167,139,250,0.2)' }}>
            <div className="w-full h-3/4 bg-white/5 flex items-center justify-center text-3xl">🃏</div>
            <div className="p-2 space-y-1">
              <div className="h-3 bg-white/10 rounded w-3/4" />
              <div className="h-2 bg-white/8 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center px-6 py-5 rounded-2xl"
          style={{ background: 'rgba(6,9,24,0.90)', border: '1px solid rgba(167,139,250,0.3)', backdropFilter: 'blur(12px)' }}>
          <div className="text-2xl mb-2">👑</div>
          <p className="font-bold text-white mb-1">Réservé Elite</p>
          <p className="text-sm text-white/50 mb-3">Les picks "{label}" nécessitent l'abonnement Elite</p>
          <a href="/pricing"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:brightness-110"
            style={{ background: 'linear-gradient(135deg,#7C3AED,#A78BFA)', color: '#fff' }}>
            Passer Elite — 15€/mois
          </a>
        </div>
      </div>
    </div>
  )
}
