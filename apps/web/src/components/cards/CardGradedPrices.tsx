'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { Award } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { useT } from '@/lib/i18n/LanguageContext'

const GRADE_COLORS: Record<number, string> = {
  10: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
  9:  'text-green-400 border-green-400/30 bg-green-400/10',
  8:  'text-blue-400 border-blue-400/30 bg-blue-400/10',
  7:  'text-purple-400 border-purple-400/30 bg-purple-400/10',
  6:  'text-orange-400 border-orange-400/30 bg-orange-400/10',
}

export function CardGradedPrices({ cardId }: { cardId: string }) {
  const t = useT()

  const { data, isLoading } = useQuery({
    queryKey: ['card-graded-prices', cardId],
    queryFn: () => api.cards.getGradedPrices(cardId),
    staleTime: 300_000,
  })

  const prices = Array.isArray(data) ? data : []

  const byCompany = prices.reduce((acc: Record<string, any[]>, p: any) => {
    const co = p.company ?? 'PSA'
    if (!acc[co]) acc[co] = []
    acc[co].push(p)
    return acc
  }, {})

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-9 h-9 bg-yellow-400/10 rounded-xl flex items-center justify-center">
          <Award className="w-5 h-5 text-yellow-400" />
        </div>
        <div>
          <h3 className="font-semibold">{t.card.gradedPrices}</h3>
          <p className="text-xs text-muted-foreground">PSA · BGS · CGC</p>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array(4).fill(null).map((_, i) => (
              <div key={i} className="skeleton h-12 rounded-xl" />
            ))}
          </div>
        ) : prices.length === 0 ? (
          <div className="py-8 text-center">
            <Award className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">{t.card.noGraded}</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Données PSA/BGS non disponibles pour cette carte</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byCompany).map(([company, gradeList]) => (
              <div key={company}>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  {company}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(gradeList as any[]).slice(0, 6).map((p: any, i: number) => {
                    const grade = Number(p.grade)
                    const colorClass = GRADE_COLORS[grade] ?? 'text-muted-foreground border-white/10 bg-white/5'
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        className={clsx('rounded-xl p-3 border', colorClass)}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold">{company} {grade.toFixed(1)}</span>
                          {p.population && (
                            <span className="text-xs opacity-60">Pop. {p.population}</span>
                          )}
                        </div>
                        <div className="font-mono font-bold">
                          {p.avgSalePrice
                            ? `$${Number(p.avgSalePrice).toFixed(0)}`
                            : p.lastSalePrice
                            ? `$${Number(p.lastSalePrice).toFixed(0)}`
                            : '—'}
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
