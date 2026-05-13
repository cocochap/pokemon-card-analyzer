'use client'

import { useEffect } from 'react'
import { useUserTier } from '@/lib/useUserTier'

export function TierProvider({ children }: { children: React.ReactNode }) {
  const { tier } = useUserTier()

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('tier-free', 'tier-pro', 'tier-elite')
    if (tier === 'ELITE') root.classList.add('tier-elite')
    else if (tier === 'PRO' || tier === 'STARTER') root.classList.add('tier-pro')
    else root.classList.add('tier-free')
  }, [tier])

  return <>{children}</>
}
