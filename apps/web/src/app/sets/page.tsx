'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { Layers } from 'lucide-react'

export default function SetsPage() {
  const { data: sets = [], isLoading } = useQuery<any[]>({
    queryKey: ['sets'],
    queryFn: async () => {
      const res = await fetch('/api/sets')
      return res.json()
    },
    staleTime: 300_000,
  })

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-1">Sets</h1>
          <p className="text-muted-foreground">{sets.length} sets available</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-28 bg-card border border-border rounded-xl animate-pulse" />
              ))
            : sets.map((set: any) => (
                <Link
                  key={set.id}
                  href={`/cards?set=${set.id}`}
                  className="flex items-center gap-4 p-5 bg-card border border-border rounded-xl hover:border-pokemon-yellow/40 transition-all hover:bg-white/5 group"
                >
                  {set.logoUrl ? (
                    <div className="relative w-20 h-12 shrink-0">
                      <Image src={set.logoUrl} alt={set.name} fill className="object-contain" unoptimized />
                    </div>
                  ) : (
                    <div className="w-20 h-12 shrink-0 flex items-center justify-center">
                      <Layers className="w-8 h-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate group-hover:text-pokemon-yellow transition-colors">
                      {set.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {set._count?.cards ?? set.totalCards} cards
                    </p>
                    {set.releaseDate && (
                      <p className="text-xs text-muted-foreground/60">
                        {new Date(set.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}
