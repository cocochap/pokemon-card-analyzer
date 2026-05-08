'use client'
export function AddToPortfolioButton({ cardId }: { cardId: string }) {
  return (
    <button className="w-full px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
      + Add to Portfolio
    </button>
  )
}
