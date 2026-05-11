'use client'

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import Link from 'next/link'
import { Layers } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'

export default function SetsPage() {
  const t = useT()
  const { locale } = useLanguage()
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
          <h1 className="text-3xl font-bold mb-1">⚡ {t.sets.title}</h1>
          <p className="text-muted-foreground">{sets.length} {t.sets.available}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {isLoading
            ? Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-28 rounded-2xl" />
              ))
            : sets.map((set: any) => (
                <Link
                  key={set.id}
                  href={`/sets/${set.id}`}
                  className="flex items-center gap-4 p-5 glass-card hover:border-pokemon-yellow/30 transition-all hover:bg-white/[0.07] group rounded-2xl"
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
                      {set._count?.cards ?? set.totalCards} {t.sets.cards}
                    </p>
                    {set.releaseDate && (
                      <p className="text-xs text-muted-foreground/60">
                        {new Date(set.releaseDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short' })}
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
