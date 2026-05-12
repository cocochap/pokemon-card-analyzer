import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { HeroSection } from '@/components/dashboard/HeroSection'
import { HowItWorks } from '@/components/dashboard/HowItWorks'
import { StatsSection } from '@/components/dashboard/StatsSection'
import { FeaturesSection } from '@/components/dashboard/FeaturesSection'
import { CtaBanner } from '@/components/dashboard/CtaBanner'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Scard — Scanner vos cartes Pokémon avec l\'IA',
  description: 'Identifiez instantanément n\'importe quelle carte Pokémon, estimez sa valeur Cardmarket, son potentiel PSA et suivez votre collection. 22 000+ cartes, 94% de précision.',
  openGraph: {
    title: 'Scard — Scanner vos cartes Pokémon avec l\'IA',
    description: 'Identification IA, prix Cardmarket en temps réel, pré-grading PSA et gestion de collection.',
    type: 'website',
  },
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 max-w-6xl">
        <HeroSection />
        <HowItWorks />
        <StatsSection />
        <FeaturesSection />
        <CtaBanner />
      </main>

      <Footer />
    </div>
  )
}
