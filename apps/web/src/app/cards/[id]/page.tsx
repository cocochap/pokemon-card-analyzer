import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CardHero } from '@/components/cards/CardHero'
import { CardPriceChart } from '@/components/charts/CardPriceChart'
import { CardPriceTable } from '@/components/cards/CardPriceTable'
import { CardAiAnalysis } from '@/components/cards/CardAiAnalysis'
import { CardEliteAnalysis } from '@/components/cards/CardEliteAnalysis'
import { CardMarketStats } from '@/components/cards/CardMarketStats'
import { CardGradedPrices } from '@/components/cards/CardGradedPrices'
import { CardRecentSales } from '@/components/cards/CardRecentSales'
import { CardInvestmentScore } from '@/components/cards/CardInvestmentScore'
import { CardPsaPopulation } from '@/components/cards/CardPsaPopulation'
import { SimilarCards } from '@/components/cards/SimilarCards'
import { AddToPortfolioButton } from '@/components/portfolio/AddToPortfolioButton'
import { WatchlistButton } from '@/components/alerts/WatchlistButton'
import { SetAlertButton } from '@/components/alerts/SetAlertButton'
import { Navbar } from '@/components/layout/Navbar'
import { getCardById } from '@/lib/db/getCard'

interface CardPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { id } = await params
  try {
    const card = await getCardById(id)
    if (!card) return { title: 'Carte introuvable' }
    return {
      title: `${card.name} — ${card.set.name}`,
      description: `Prix, tendances et prédictions IA pour ${card.name}. Prix actuel : ${(card.marketData as any)?.currentPrice ?? 'N/A'}€`,
      openGraph: {
        images: [{ url: card.imageLgUrl ?? '', width: 600, height: 825 }],
      },
    }
  } catch {
    return { title: 'Carte introuvable' }
  }
}

export default async function CardDetailPage({ params }: CardPageProps) {
  const { id } = await params
  const card = await getCardById(id)
  if (!card) notFound()

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Hero + données principales */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">

          {/* Colonne gauche — image + actions + scores */}
          <div className="xl:col-span-2 space-y-4">
            <CardHero card={card as any} />

            <div className="flex flex-col gap-3">
              <AddToPortfolioButton cardId={card!.id} />
              <div className="grid grid-cols-2 gap-3">
                <WatchlistButton cardId={card!.id} />
                <SetAlertButton cardId={card!.id} />
              </div>
            </div>

            <Suspense fallback={<div className="skeleton h-52 w-full rounded-2xl" />}>
              <CardInvestmentScore cardId={card!.id} />
            </Suspense>

            <Suspense fallback={<div className="skeleton h-44 w-full rounded-2xl" />}>
              <CardPsaPopulation cardId={card!.id} />
            </Suspense>

            <CardEliteAnalysis cardId={card!.id} />
          </div>

          {/* Colonne droite — stats, chart, IA */}
          <div className="xl:col-span-3 space-y-6">
            <Suspense fallback={<div className="skeleton h-40 w-full rounded-2xl" />}>
              <CardMarketStats card={card as any} />
            </Suspense>

            <Suspense fallback={<div className="skeleton h-80 w-full rounded-2xl" />}>
              <CardPriceChart cardId={card!.id} />
            </Suspense>

            <Suspense fallback={<div className="skeleton h-72 w-full rounded-2xl" />}>
              <CardAiAnalysis cardId={card!.id} />
            </Suspense>
          </div>
        </div>

        {/* Historique prix + Graded prices */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<div className="skeleton h-72 w-full rounded-2xl" />}>
            <CardPriceTable cardId={card!.id} />
          </Suspense>
          <Suspense fallback={<div className="skeleton h-72 w-full rounded-2xl" />}>
            <CardGradedPrices cardId={card!.id} />
          </Suspense>
        </div>

        {/* Ventes récentes */}
        <div className="mt-6">
          <Suspense fallback={<div className="skeleton h-80 w-full rounded-2xl" />}>
            <CardRecentSales cardId={card!.id} />
          </Suspense>
        </div>

        {/* Cartes similaires */}
        <div className="mt-8">
          <Suspense fallback={<div className="skeleton h-64 w-full rounded-2xl" />}>
            <SimilarCards cardId={card!.id} setId={card!.setId} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
