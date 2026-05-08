import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { CardHero } from '@/components/cards/CardHero'
import { CardPriceChart } from '@/components/charts/CardPriceChart'
import { CardPriceTable } from '@/components/cards/CardPriceTable'
import { CardAiAnalysis } from '@/components/cards/CardAiAnalysis'
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
import { CardSkeleton } from '@/components/ui/Skeletons'
import { api } from '@/lib/api'

interface CardPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { id } = await params
  try {
    const card: any = await api.cards.getById(id)
    return {
      title: `${card.name} — ${card.set.name}`,
      description: `Track ${card.name} prices, market trends, and AI predictions. Current price: ${card.marketData?.currentPrice ?? 'N/A'}`,
      openGraph: {
        images: [{ url: card.imageLgUrl ?? '', width: 600, height: 825 }],
      },
    }
  } catch {
    return { title: 'Card Not Found' }
  }
}

export default async function CardDetailPage({ params }: CardPageProps) {
  const { id } = await params

  let card: any
  try {
    card = await api.cards.getById(id)
  } catch {
    notFound()
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Card Hero Section */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Left — Card Image & Quick Actions */}
          <div className="xl:col-span-2">
            <Suspense fallback={<div className="skeleton aspect-[5/7] w-full max-w-sm mx-auto" />}>
              <CardHero card={card} />
            </Suspense>

            {/* Action Buttons */}
            <div className="mt-4 flex flex-col gap-3">
              <AddToPortfolioButton cardId={card.id} />
              <div className="grid grid-cols-2 gap-3">
                <WatchlistButton cardId={card.id} />
                <SetAlertButton cardId={card.id} />
              </div>
            </div>

            {/* Investment Score */}
            <Suspense fallback={<div className="skeleton h-48 w-full mt-4" />}>
              <CardInvestmentScore cardId={card.id} />
            </Suspense>

            {/* PSA Population */}
            <Suspense fallback={<div className="skeleton h-48 w-full mt-4" />}>
              <CardPsaPopulation cardId={card.id} />
            </Suspense>
          </div>

          {/* Right — Main Data */}
          <div className="xl:col-span-3 space-y-6">
            {/* Market Stats Header */}
            <Suspense fallback={<div className="skeleton h-32 w-full" />}>
              <CardMarketStats card={card} />
            </Suspense>

            {/* Price Chart */}
            <Suspense fallback={<div className="skeleton h-80 w-full" />}>
              <CardPriceChart cardId={card.id} />
            </Suspense>

            {/* AI Analysis */}
            <Suspense fallback={<div className="skeleton h-64 w-full" />}>
              <CardAiAnalysis cardId={card.id} />
            </Suspense>
          </div>
        </div>

        {/* Bottom sections */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <CardPriceTable cardId={card.id} />
          </Suspense>
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <CardGradedPrices cardId={card.id} />
          </Suspense>
        </div>

        {/* Recent Sales */}
        <div className="mt-6">
          <Suspense fallback={<div className="skeleton h-80 w-full" />}>
            <CardRecentSales cardId={card.id} />
          </Suspense>
        </div>

        {/* Similar Cards */}
        <div className="mt-8">
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <SimilarCards cardId={card.id} setId={card.setId} />
          </Suspense>
        </div>
      </main>
    </div>
  )
}
