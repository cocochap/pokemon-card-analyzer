import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export default function CardsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <h1 className="text-3xl font-bold mb-2">Cards</h1>
        <p className="text-muted-foreground mb-8">Browse and search all Pokémon TCG cards</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-card border border-border rounded-xl animate-pulse" />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
