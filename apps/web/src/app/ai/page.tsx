import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Sparkles } from 'lucide-react'

export default function AiPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="flex items-center gap-3 mb-2">
          <Sparkles className="w-8 h-8 text-pokemon-yellow" />
          <h1 className="text-3xl font-bold">AI Insights</h1>
          <span className="px-2 py-0.5 text-xs font-bold rounded bg-pokemon-yellow/20 text-pokemon-yellow border border-pokemon-yellow/30">PRO</span>
        </div>
        <p className="text-muted-foreground mb-8">AI-powered market analysis and investment predictions</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-48 bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
