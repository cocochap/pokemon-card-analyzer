import { Metadata } from 'next'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { DealAnalyzer } from '@/components/deal/DealAnalyzer'
import { ShoppingBag, Sparkles, MessageSquare, TrendingDown } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Deal Vinted — PokéScard',
  description: 'Analyse instantanée d\'annonces Vinted, eBay ou LeBonCoin. Score de deal, comparaison au prix marché et message de négociation généré par IA.',
  alternates: { canonical: '/deal' },
}

const FEATURES = [
  { icon: ShoppingBag, title: 'Analyse en 10 secondes', desc: 'Upload un screenshot d\'annonce, l\'IA identifie la carte et lit le prix automatiquement.' },
  { icon: TrendingDown, title: 'Score de deal précis', desc: 'Comparaison avec le prix CardMarket ajusté selon l\'état de la carte.' },
  { icon: MessageSquare, title: 'Message IA prêt', desc: 'Génère un message de négociation naturel et poli en 1 clic.' },
  { icon: Sparkles, title: 'Fonctionne partout', desc: 'Vinted, eBay, LeBonCoin, Facebook Marketplace, Instagram...' },
]

export default function DealPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container max-w-3xl mx-auto px-4 py-10">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider mb-4"
            style={{ background: 'rgba(255,203,5,0.1)', border: '1px solid rgba(255,203,5,0.2)', color: '#FFCB05' }}>
            <Sparkles className="w-3.5 h-3.5" />
            Nouveau
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">
            Deal Vinted
          </h1>
          <p className="text-base text-white/55 max-w-md mx-auto">
            Screenshot une annonce, on analyse si c'est une bonne affaire et on génère ton message de négo.
          </p>
        </div>

        {/* Feature pills */}
        <div className="grid grid-cols-2 gap-3 mb-10">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="glass-card p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: 'rgba(255,203,5,0.08)' }}>
                <Icon className="w-4 h-4 text-pokemon-yellow" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white/80">{title}</p>
                <p className="text-xs text-white/40 mt-0.5 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Analyzer */}
        <DealAnalyzer />

      </main>
      <Footer />
    </div>
  )
}
