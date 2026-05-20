import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable'
import { Trophy } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Classement Collections — PokéScard',
  description: 'Top 100 des plus grandes collections Pokémon TCG par valeur CardMarket. Classement mis à jour chaque jour.',
  alternates: { canonical: '/leaderboard' },
}

export default function LeaderboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl mx-auto px-4 py-10">

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            style={{ background: 'rgba(255,203,5,0.1)', border: '1px solid rgba(255,203,5,0.2)', color: '#FFCB05' }}>
            <Trophy className="w-3.5 h-3.5" />
            Classement global
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Top Collections
          </h1>
          <p className="text-sm text-white/50 max-w-md mx-auto">
            Valeur totale selon les prix CardMarket. Mis à jour chaque nuit.
            Seules les cartes présentes depuis plus de 7 jours sont comptabilisées.
          </p>
        </div>

        <LeaderboardTable />

      </main>
      <Footer />
    </div>
  )
}
