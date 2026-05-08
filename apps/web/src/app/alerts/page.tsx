import type { Metadata } from 'next'
import { auth } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { AlertsDashboard } from '@/components/alerts/AlertsDashboard'

export const metadata: Metadata = {
  title: 'Price Alerts',
  description: 'Manage your Pokémon card price alerts and get notified when conditions are met.',
}

export default async function AlertsPage() {
  const { userId } = await auth()
  if (!userId) redirect('/sign-in')

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <AlertsDashboard />
      </main>
    </div>
  )
}
