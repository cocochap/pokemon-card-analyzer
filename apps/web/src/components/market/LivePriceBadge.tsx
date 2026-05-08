'use client'

import { useMarketStore } from '@/stores/market.store'
import { Wifi, WifiOff } from 'lucide-react'

export function LivePriceBadge() {
  const { wsConnected, marketIndex, indexChange } = useMarketStore()

  return (
    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs">
      {wsConnected ? (
        <Wifi className="w-3.5 h-3.5 text-market-bull" />
      ) : (
        <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
      )}
      <span className="text-muted-foreground">PMI</span>
      <span className="font-mono font-medium">{marketIndex.toFixed(0)}</span>
      <span className={indexChange >= 0 ? 'text-market-bull' : 'text-market-bear'}>
        {indexChange >= 0 ? '+' : ''}{indexChange.toFixed(2)}%
      </span>
    </div>
  )
}
