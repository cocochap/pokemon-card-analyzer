export function CardInvestmentScore({ cardId }: { cardId: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 mt-4">
      <h3 className="text-lg font-semibold mb-4">Investment Score</h3>
      <div className="h-32 bg-muted rounded-lg animate-pulse" />
    </div>
  )
}
