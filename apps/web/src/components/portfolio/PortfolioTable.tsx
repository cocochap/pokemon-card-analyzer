'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, ExternalLink, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

export function PortfolioTable({ portfolioId }: { portfolioId?: string }) {
  const qc = useQueryClient()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio'],
    queryFn: api.portfolio.getMyPortfolio,
    staleTime: 60_000,
  })

  const { mutate: deleteItem } = useMutation({
    mutationFn: (itemId: string) => api.portfolio.deleteItem(itemId),
    onMutate: (itemId) => setDeletingId(itemId),
    onSettled: () => {
      setDeletingId(null)
      qc.invalidateQueries({ queryKey: ['portfolio'] })
    },
  })

  const items: any[] = (portfolio as any)?.items ?? []

  if (isLoading) {
    return (
      <div className="glass-card p-6 space-y-3">
        <div className="h-5 skeleton rounded w-32 mb-4" />
        {Array(4).fill(null).map((_, i) => (
          <div key={i} className="h-16 skeleton rounded-xl" />
        ))}
      </div>
    )
  }

  if (items.length === 0) return null

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <h3 className="font-semibold text-white">Cartes ({items.length})</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th className="text-left py-3 px-5 text-xs font-medium text-white/40">Carte</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-white/40">Qté</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-white/40">Achat</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-white/40">Prix actuel</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-white/40">ROI</th>
              <th className="text-right py-3 px-5 text-xs font-medium text-white/40">7j</th>
              <th className="py-3 px-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <AnimatePresence initial={false}>
              {items.map((item: any) => {
                const card = item.card
                const currentPrice = Number(card?.prices?.[0]?.market ?? 0)
                const purchasePrice = item.purchasePrice ? Number(item.purchasePrice) : null
                const roi = purchasePrice && purchasePrice > 0 && currentPrice > 0
                  ? ((currentPrice - purchasePrice) / purchasePrice) * 100
                  : null
                const change7d = card?.marketData?.priceChange7d
                  ? Number(card.marketData.priceChange7d)
                  : null
                const imageUrl = card?.imageSmUrl

                return (
                  <motion.tr
                    key={item.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0, height: 0 }}
                    className="hover:bg-white/3 transition-colors group"
                  >
                    {/* Card */}
                    <td className="py-2.5 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-12 rounded-lg overflow-hidden flex-shrink-0"
                          style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
                          {imageUrl ? (
                            <Image
                              src={imageUrl}
                              alt={card.name}
                              width={36}
                              height={48}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-white/5 flex items-center justify-center text-[8px] text-white/20">
                              ?
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <Link href={`/cards/${card?.id}`}
                            className="font-medium text-white hover:text-pokemon-yellow transition-colors flex items-center gap-1 group/link">
                            <span className="truncate max-w-[150px]">{card?.name ?? '—'}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover/link:opacity-60 flex-shrink-0" />
                          </Link>
                          <p className="text-xs text-white/35 truncate max-w-[150px]">{card?.set?.name ?? ''}</p>
                        </div>
                      </div>
                    </td>

                    {/* Quantity */}
                    <td className="py-2.5 px-5 text-right font-mono text-white/70">
                      {item.quantity}
                    </td>

                    {/* Purchase price */}
                    <td className="py-2.5 px-5 text-right font-mono text-white/50">
                      {purchasePrice ? formatCurrency(purchasePrice) : <span className="text-white/20">—</span>}
                    </td>

                    {/* Current price */}
                    <td className="py-2.5 px-5 text-right font-mono font-medium text-white">
                      {currentPrice > 0 ? formatCurrency(currentPrice) : <span className="text-white/20">—</span>}
                    </td>

                    {/* ROI */}
                    <td className="py-2.5 px-5 text-right">
                      {roi !== null ? (
                        <span className={clsx(
                          'flex items-center justify-end gap-0.5 text-xs font-semibold',
                          roi >= 0 ? 'text-green-400' : 'text-red-400',
                        )}>
                          {roi >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                        </span>
                      ) : <span className="text-xs text-white/20">—</span>}
                    </td>

                    {/* 7d change */}
                    <td className="py-2.5 px-5 text-right">
                      {change7d !== null ? (
                        <span className={clsx(
                          'text-xs font-medium',
                          change7d >= 0 ? 'text-green-400' : 'text-red-400',
                        )}>
                          {change7d >= 0 ? '+' : ''}{change7d.toFixed(1)}%
                        </span>
                      ) : <span className="text-xs text-white/20">—</span>}
                    </td>

                    {/* Delete */}
                    <td className="py-2.5 px-3">
                      <button
                        onClick={() => deleteItem(item.id)}
                        disabled={deletingId === item.id}
                        className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                        title="Retirer du portfolio"
                      >
                        {deletingId === item.id
                          ? <Loader2 className="w-3.5 h-3.5 text-white/30 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5 text-white/30 hover:text-red-400" />
                        }
                      </button>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  )
}
