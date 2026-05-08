import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { PortfolioDashboard } from '@/components/portfolio/PortfolioDashboard'

export const metadata: Metadata = {
  title: 'My Portfolio',
  description: 'Track your Pokémon TCG collection value, ROI, and performance analytics.',
}

export default async function PortfolioPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <PortfolioDashboard />
      </main>
    </div>
  )
}
