'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Layers, Search } from 'lucide-react'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'

export default function SetsPage() {
  const t = useT()
  const { locale } = useLanguage()
  const [search, setSearch] = useState('')

  const { data: sets = [], isLoading } = useQuery<any[]>({
    queryKey: ['sets'],
    queryFn: async () => {
      const res = await fetch('/api/sets')
      return res.json()
    },
    staleTime: 300_000,
  })

  const filtered = sets.filter((s: any) =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || s.externalId?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8 max-w-[1600px]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-1">⚡ {t.sets.title}</h1>
          <p className="text-muted-foreground">{sets.length} {t.sets.available}</p>
        </div>

        {/* Search */}
        <div className="relative mb-6 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={locale === 'fr' ? 'Rechercher une extension...' : 'Search sets...'}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors placeholder:text-gray-400 text-gray-900 shadow-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {isLoading
            ? Array.from({ length: 16 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-2xl" />
              ))
            : filtered.map((set: any) => (
                <Link
                  key={set.id}
                  href={`/sets/${set.id}`}
                  className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  {/* Logo */}
                  <div className="w-20 h-12 shrink-0 flex items-center justify-center">
                    {set.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={set.logoUrl}
                        alt={set.name}
                        className="w-full h-full object-contain"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : set.symbolUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={set.symbolUrl}
                        alt={set.name}
                        className="w-8 h-8 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <Layers className="w-8 h-8 text-gray-300" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                      {set.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {set._count?.cards ?? set.totalCards} {t.sets.cards}
                    </p>
                    {set.releaseDate && (
                      <p className="text-xs text-gray-400">
                        {new Date(set.releaseDate).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', { year: 'numeric', month: 'short' })}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
        </div>

        {!isLoading && filtered.length === 0 && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-muted-foreground">{locale === 'fr' ? 'Aucune extension trouvée' : 'No sets found'}</p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  )
}
