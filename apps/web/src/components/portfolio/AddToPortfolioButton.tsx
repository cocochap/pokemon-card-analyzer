'use client'

import { useT } from '@/lib/i18n/LanguageContext'

export function AddToPortfolioButton({ cardId }: { cardId: string }) {
  const t = useT()
  return (
    <button className="w-full px-4 py-2.5 rounded-xl bg-pokemon-yellow text-background font-bold text-sm hover:bg-yellow-300 transition-all hover:scale-105 shadow-glow">
      + {t.common.addToPortfolio}
    </button>
  )
}
