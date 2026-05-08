'use client'

import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowDownRight, ArrowUpRight, TrendingDown, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'
import { RarityBadge } from '@/components/ui/RarityBadge'

interface TopMoversProps {
  direction: 'up' | 'down'
}

export function TopMovers({ direction }: TopMoversProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['top-movers', direction],
    queryFn: () => api.market.getTopMovers(direction),
    staleTime: 60_000,
    refetchInterval: 120_000,
  })

  const isUp = direction === 'up'

  return (
    <div className="glass-card overflow-hidden">
      <div className={clsx(
        'flex items-center gap-3 p-4 border-b border-white/10',
        isUp ? 'bg-market-bull/5' : 'bg-market-bear/5',
      )}>
        <div className={clsx(
          'w-9 h-9 rounded-xl flex items-center justify-center',
          isUp ? 'bg-market-bull/10' : 'bg-market-bear/10',
        )}>
          {isUp
            ? <TrendingUp className="w-5 h-5 text-market-bull" />
            : <TrendingDown className="w-5 h-5 text-market-bear" />
          }
        </div>
        <div>
          <h3 className="font-semibold">{isUp ? 'Top Gainers' : 'Top Losers'}</h3>
          <p className="text-xs text-muted-foreground">24h price change</p>
        </div>
      </div>

      <div className="divide-y divide-white/5">
        {isLoading
          ? Array(5).fill(null).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-4">
                <div className="skeleton w-10 h-14 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-4 w-32" />
                  <div className="skeleton h-3 w-20" />
                </div>
                <div className="space-y-1">
                  <div className="skeleton h-4 w-16" />
                  <div className="skeleton h-3 w-12" />
                </div>
              </div>
            ))
          : (data ?? []).slice(0, 8).map((card, i) => (
              <motion.div
                key={card.id}
                initial={{ opacity: 0, x: isUp ? -20 : 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Link
                  href={`/cards/${card.id}`}
                  className="flex items-center gap-3 p-4 hover:bg-white/3 transition-colors group"
                >
                  {/* Rank */}
                  <span className="w-6 text-center text-sm font-bold text-muted-foreground/60 shrink-0">
                    {i + 1}
                  </span>

                  {/* Card thumbnail */}
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0">
                    {card.imageSmUrl && (
                      <Image
                        src={card.imageSmUrl}
                        alt={card.name}
                        width={40}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate group-hover:text-pokemon-yellow transition-colors">
                      {card.name}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <RarityBadge rarity={card.rarity} size="xs" />
                      <span className="text-xs text-muted-foreground truncate">{card.setName}</span>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="text-right shrink-0">
                    <div className="font-mono font-semibold text-sm">{formatCurrency(card.price)}</div>
                    <div
                      className={clsx(
                        'flex items-center justify-end gap-0.5 text-xs font-bold',
                        isUp ? 'text-market-bull' : 'text-market-bear',
                      )}
                    >
                      {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(card.change24h).toFixed(2)}%
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))
        }
      </div>

      {/* View All */}
      <div className={clsx(
        'p-3 border-t border-white/10 text-center',
        isUp ? 'bg-market-bull/3' : 'bg-market-bear/3',
      )}>
        <Link
          href={`/market?movers=${direction}`}
          className={clsx(
            'text-sm font-medium transition-colors',
            isUp ? 'text-market-bull hover:text-market-bull/80' : 'text-market-bear hover:text-market-bear/80',
          )}
        >
          View all {isUp ? 'gainers' : 'losers'} →
        </Link>
      </div>
    </div>
  )
}
