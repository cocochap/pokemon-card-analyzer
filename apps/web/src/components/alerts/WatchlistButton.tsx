'use client'
export function WatchlistButton({ cardId }: { cardId: string }) {
  return (
    <button className="w-full px-4 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors">
      + Watchlist
    </button>
  )
}
