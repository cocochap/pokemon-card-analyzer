'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import { ArrowDownRight, ArrowUpRight, Wifi } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '@/lib/api'
import { formatCurrency } from '@/lib/formatters'

export function MarketTicker() {
  const trackRef = useRef<HTMLDivElement>(null)

  const { data: tickers } = useQuery({
    queryKey: ['market-ticker'],
    queryFn: api.market.getTicker,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const items = tickers ?? []
  const doubled = [...items, ...items]

  return (
    <div className="w-full bg-background/60 backdrop-blur-md border-b border-white/10 overflow-hidden py-2">
      <div className="flex items-center">
        {/* Live badge */}
        <div className="flex items-center gap-1.5 px-4 text-xs font-medium text-market-bull border-r border-white/10 shrink-0">
          <Wifi className="w-3 h-3" />
          <span className="hidden sm:inline">LIVE</span>
        </div>

        {/* Scrolling track */}
        <div className="overflow-hidden flex-1">
          <div
            ref={trackRef}
            className="flex items-center gap-8 animate-ticker whitespace-nowrap"
            style={{ width: 'max-content' }}
          >
            {doubled.map((item, i) => (
              <Link
                key={`${item.cardId}-${i}`}
                href={`/cards/${item.cardId}`}
                className="flex items-center gap-2 hover:text-foreground text-muted-foreground transition-colors group shrink-0"
              >
                <span className="text-xs font-medium group-hover:text-pokemon-yellow transition-colors">
                  {item.name}
                </span>
                <span className="text-xs font-mono tabular-nums">
                  {formatCurrency(item.price)}
                </span>
                <span
                  className={clsx(
                    'flex items-center gap-0.5 text-xs font-medium',
                    item.change >= 0 ? 'text-market-bull' : 'text-market-bear',
                  )}
                >
                  {item.change >= 0 ? (
                    <ArrowUpRight className="w-3 h-3" />
                  ) : (
                    <ArrowDownRight className="w-3 h-3" />
                  )}
                  {Math.abs(item.change).toFixed(2)}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
