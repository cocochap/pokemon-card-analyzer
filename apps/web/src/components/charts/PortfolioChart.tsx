export function PortfolioChart({ data }: { data?: any[] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <h3 className="text-lg font-semibold mb-4">Portfolio Performance</h3>
      <div className="h-64 bg-muted rounded-lg animate-pulse" />
    </div>
  )
}
