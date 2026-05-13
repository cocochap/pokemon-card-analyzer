'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useT } from '@/lib/i18n/LanguageContext'

export function WatchlistButton({ cardId }: { cardId: string }) {
  const t = useT()
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const qc = useQueryClient()

  const { data, isLoading: checking } = useQuery({
    queryKey: ['watchlist-status', cardId],
    queryFn: () => fetch(`/api/watchlist/${cardId}`).then(r => r.json()),
    enabled: !!isSignedIn,
    staleTime: 60_000,
  })

  const isWatchlisted = data?.isWatchlisted ?? false

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      if (isWatchlisted) {
        await fetch(`/api/watchlist/${cardId}`, { method: 'DELETE' })
      } else {
        await fetch('/api/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cardId }),
        })
      }
    },
    onSuccess: () => {
      qc.setQueryData(['watchlist-status', cardId], { isWatchlisted: !isWatchlisted })
      qc.invalidateQueries({ queryKey: ['watchlist'] })
    },
  })

  const handleClick = () => {
    if (!isSignedIn) {
      openSignIn()
      return
    }
    mutate()
  }

  const loading = checking || isPending

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all"
      style={isWatchlisted
        ? { borderColor: 'rgba(255,203,5,0.4)', color: '#FFCB05', background: 'rgba(255,203,5,0.08)' }
        : { borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin" />
        : isWatchlisted
          ? <BookmarkCheck className="w-4 h-4" />
          : <Bookmark className="w-4 h-4" />
      }
      {isWatchlisted ? 'Dans la watchlist' : t.common.addToWatchlist}
    </button>
  )
}
