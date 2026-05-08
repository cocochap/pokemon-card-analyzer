export function TrendingCards() {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Trending Cards</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="aspect-[2/3] bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    </div>
  )
}
