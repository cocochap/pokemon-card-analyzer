export function FeaturedCard() {
  return (
    <div className="rounded-xl border border-border bg-card p-6 flex flex-col items-center justify-center gap-4">
      <h3 className="text-lg font-semibold self-start">Card of the Week</h3>
      <div className="aspect-[2/3] w-48 bg-muted rounded-lg animate-pulse" />
      <div className="w-full space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-muted rounded animate-pulse" />
      </div>
    </div>
  )
}
