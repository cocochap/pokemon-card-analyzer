'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { Search, Filter } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { api } from '@/lib/api'

export default function CardsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['cards', search, page],
    queryFn: () => api.cards.search(search, { page: String(page), limit: '24' } as any),
    staleTime: 30_000,
  })

  const cards = (data as any)?.items ?? []
  const total = (data as any)?.total ?? 0
  const pages = (data as any)?.pages ?? 1

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Cards</h1>
          <p className="text-muted-foreground">{total.toLocaleString()} cards in database</p>
        </div>

        {/* Search */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search cards by name..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              className="w-full pl-10 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm focus:outline-none focus:border-pokemon-yellow/50 transition-colors"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-3">
          {isLoading
            ? Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="aspect-[2/3] bg-card border border-border rounded-xl animate-pulse" />
              ))
            : cards.map((card: any) => (
                <Link key={card.id} href={`/cards/${card.id}`} className="group relative aspect-[2/3] rounded-xl overflow-hidden border border-white/10 hover:border-pokemon-yellow/50 transition-all duration-300 hover:scale-105 hover:shadow-glow">
                  {card.imageSmUrl ? (
                    <Image
                      src={card.imageSmUrl}
                      alt={card.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 16vw, 12.5vw"
                    />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground p-2 text-center">
                      {card.name}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 p-2 w-full">
                      <p className="text-white text-xs font-medium truncate">{card.name}</p>
                      <p className="text-pokemon-yellow text-xs">{card.rarity?.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                </Link>
              ))}
        </div>

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-4 py-2 rounded-lg bg-card border border-border text-sm disabled:opacity-40 hover:border-pokemon-yellow/50 transition-colors">
              Previous
            </button>
            <span className="text-sm text-muted-foreground">Page {page} of {pages}</span>
            <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
              className="px-4 py-2 rounded-lg bg-card border border-border text-sm disabled:opacity-40 hover:border-pokemon-yellow/50 transition-colors">
              Next
            </button>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
