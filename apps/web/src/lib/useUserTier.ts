'use client'

import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@clerk/nextjs'

export type Tier = 'FREE' | 'PRO' | 'STARTER' | 'ELITE'

export function useUserTier() {
  const { isSignedIn } = useAuth()

  const { data } = useQuery({
    queryKey: ['user-me'],
    queryFn: () => fetch('/api/user/me').then(r => r.ok ? r.json() : null),
    enabled: !!isSignedIn,
    staleTime: 60_000,
  })

  const tier: Tier = data?.tier ?? 'FREE'
  const isPro = tier === 'PRO' || tier === 'STARTER'
  const isElite = tier === 'ELITE'
  const isPremium = isPro || isElite

  return { tier, isPro, isElite, isPremium }
}

export const TIER_CONFIG = {
  FREE: {
    label: 'Gratuit',
    badgeText: null,
    color: 'rgba(255,255,255,0.4)',
    glow: null,
    bodyClass: '',
  },
  STARTER: {
    label: 'Premium',
    badgeText: 'PREMIUM',
    color: '#FFCB05',
    glow: 'rgba(255,203,5,0.08)',
    bodyClass: 'tier-pro',
  },
  PRO: {
    label: 'Premium',
    badgeText: 'PREMIUM',
    color: '#FFCB05',
    glow: 'rgba(255,203,5,0.08)',
    bodyClass: 'tier-pro',
  },
  ELITE: {
    label: 'Elite',
    badgeText: 'ELITE',
    color: '#A78BFA',
    glow: 'rgba(167,139,250,0.08)',
    bodyClass: 'tier-elite',
  },
}
