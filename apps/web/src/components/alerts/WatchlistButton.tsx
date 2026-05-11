'use client'

import { useT } from '@/lib/i18n/LanguageContext'

export function WatchlistButton({ cardId }: { cardId: string }) {
  const t = useT()
  return (
    <button className="w-full px-4 py-2.5 rounded-xl border border-white/15 text-sm font-medium hover:bg-white/5 hover:border-pokemon-yellow/30 transition-colors">
      {t.common.addToWatchlist}
    </button>
  )
}
