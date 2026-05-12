import { Suspense } from 'react'
import { MarketTicker } from '@/components/market/MarketTicker'
import { HeroSection } from '@/components/dashboard/HeroSection'
import { MarketOverview } from '@/components/dashboard/MarketOverview'
import { TrendingCards } from '@/components/dashboard/TrendingCards'
import { TopMovers } from '@/components/dashboard/TopMovers'
import { FeaturedCard } from '@/components/dashboard/FeaturedCard'
import { MarketIndexChart } from '@/components/charts/MarketIndexChart'
import { OpportunitySection } from '@/components/dashboard/OpportunitySection'
import { AiInsightsPanel } from '@/components/dashboard/AiInsightsPanel'
import { RecentSales } from '@/components/market/RecentSales'
import { SocialProof } from '@/components/dashboard/SocialProof'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { DashboardSkeleton } from '@/components/ui/Skeletons'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <MarketTicker />

      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Hero */}
        <HeroSection />

        {/* Market Overview KPIs */}
        <Suspense fallback={<DashboardSkeleton />}>
          <section className="mt-12">
            <MarketOverview />
          </section>
        </Suspense>

        {/* Main Grid */}
        <div className="mt-10 grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <Suspense fallback={<div className="skeleton h-80 w-full" />}>
              <MarketIndexChart />
            </Suspense>
          </div>
          <Suspense fallback={<div className="skeleton h-80 w-full" />}>
            <FeaturedCard />
          </Suspense>
        </div>

        {/* Top Movers */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Suspense fallback={<div className="skeleton h-96 w-full" />}>
            <TopMovers direction="up" />
          </Suspense>
          <Suspense fallback={<div className="skeleton h-96 w-full" />}>
            <TopMovers direction="down" />
          </Suspense>
        </div>

        {/* Trending Cards */}
        <section className="mt-8">
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <TrendingCards />
          </Suspense>
        </section>

        {/* AI Insights + Recent Sales */}
        <div className="mt-8 grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <Suspense fallback={<div className="skeleton h-96 w-full" />}>
              <AiInsightsPanel />
            </Suspense>
          </div>
          <Suspense fallback={<div className="skeleton h-96 w-full" />}>
            <RecentSales />
          </Suspense>
        </div>

        {/* Buy Opportunities */}
        <section className="mt-8">
          <Suspense fallback={<div className="skeleton h-64 w-full" />}>
            <OpportunitySection />
          </Suspense>
        </section>

        {/* Social Proof */}
        <SocialProof />
      </main>

      <Footer />
    </div>
  )
}
