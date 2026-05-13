import type { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { ScanPageContent } from '@/components/scan/ScanPageContent'

export const metadata: Metadata = {
  title: 'Scanner une carte — PokeScard',
  description: 'Uploadez ou photographiez n\'importe quelle carte Pokémon et obtenez instantanément l\'identification IA, la prédiction de note PSA et la valeur de marché en temps réel.',
  alternates: {
    languages: {
      'en': '/scan',
      'fr': '/scan',
    },
  },
}

export default function ScanPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <ScanPageContent />
      <Footer />
    </div>
  )
}
