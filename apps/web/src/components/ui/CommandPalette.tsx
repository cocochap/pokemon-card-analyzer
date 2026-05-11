'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, ArrowRight, Loader2 } from 'lucide-react'
import Image from 'next/image'
import { useDebounce } from '@/hooks/useDebounce'
import { api } from '@/lib/api'
import { RarityBadge } from './RarityBadge'
import { useLanguage, useT } from '@/lib/i18n/LanguageContext'
import { getCardName } from '@/lib/i18n/cardLocale'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { locale } = useLanguage()
  const t = useT()
  const [query, setQuery] = useState('')
  const router = useRouter()
  const debouncedQuery = useDebounce(query, 250)

  const { data, isLoading } = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => api.cards.search(debouncedQuery, { limit: '8' }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  })

  const handleSelect = useCallback(
    (id: string) => {
      router.push(`/cards/${id}`)
      onClose()
      setQuery('')
    },
    [router, onClose],
  )

  useEffect(() => {
    if (!open) setQuery('')
  }, [open])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            className="fixed top-[15vh] left-1/2 -translate-x-1/2 z-50 w-full max-w-xl"
          >
            <div className="glass-card shadow-glass-lg overflow-hidden border-white/20">
              {/* Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                {isLoading
                  ? <Loader2 className="w-5 h-5 text-muted-foreground animate-spin shrink-0" />
                  : <Search className="w-5 h-5 text-muted-foreground shrink-0" />
                }
                <input
                  autoFocus
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search cards, sets, Pokémon..."
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-sm"
                />
                <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded text-muted-foreground">ESC</kbd>
              </div>

              {/* Results */}
              {query.length >= 2 && (
                <div className="max-h-80 overflow-y-auto">
                  {data?.items?.length === 0 && !isLoading ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      {t.common.noCardsFound} "{query}"
                    </div>
                  ) : (
                    <ul>
                      {(data?.items ?? []).map((card: any) => (
                        <li key={card.id}>
                          <button
                            onClick={() => handleSelect(card.id)}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
                          >
                            <div className="w-8 h-11 rounded overflow-hidden bg-white/5 shrink-0">
                              {card.imageSmUrl && (
                                <Image
                                  src={card.imageSmUrl}
                                  alt={card.name}
                                  width={32}
                                  height={44}
                                  className="w-full h-full object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{getCardName(card, locale)}</div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <RarityBadge rarity={card.rarity} size="xs" />
                                <span className="text-xs text-muted-foreground truncate">
                                  {card.set?.name} · #{card.number}
                                </span>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {query.length < 2 && (
                <div className="px-4 py-6 text-center text-muted-foreground text-sm">
                  {t.common.searchHint}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
