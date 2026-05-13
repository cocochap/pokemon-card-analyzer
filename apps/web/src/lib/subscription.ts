import { prisma } from '@/lib/db/prisma'

export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'ELITE'

export const LIMITS = {
  FREE: {
    chartRanges: ['7d', '30d'] as string[],
    portfolioCards: 10,
    alerts: 0,
    scansPerMonth: 3,
    aiInsights: false,
    cardAnalysis: false,
    csvExport: false,
    monthlyReport: false,
  },
  PRO: {
    chartRanges: ['7d', '30d', '90d', '1y'] as string[],
    portfolioCards: Infinity,
    alerts: 10,
    scansPerMonth: 30,
    aiInsights: true,       // featured + hype + momentum only
    aiInsightsFull: false,  // undervalued + long_term locked
    cardAnalysis: false,
    csvExport: false,
    monthlyReport: false,
  },
  ELITE: {
    chartRanges: ['7d', '30d', '90d', '1y', 'all'] as string[],
    portfolioCards: Infinity,
    alerts: Infinity,
    scansPerMonth: Infinity,
    aiInsights: true,
    aiInsightsFull: true,   // all categories
    cardAnalysis: true,     // per-card AI analysis
    csvExport: true,
    monthlyReport: true,
  },
}

export function isPremiumTier(tier: Tier): boolean {
  return tier === 'PRO' || tier === 'ELITE' || tier === 'STARTER'
}

export function isEliteTier(tier: Tier): boolean {
  return tier === 'ELITE'
}

export function getLimits(tier: Tier) {
  if (tier === 'ELITE') return LIMITS.ELITE
  if (tier === 'PRO' || tier === 'STARTER') return LIMITS.PRO
  return LIMITS.FREE
}

export async function getUserWithTier(clerkId: string, email?: string): Promise<{
  id: string
  tier: Tier
  stripeCustomerId: string | null
}> {
  const user = await prisma.user.upsert({
    where: { clerkId },
    create: {
      clerkId,
      email: email ?? `${clerkId}@placeholder.com`,
      tier: 'FREE',
    },
    update: email ? { email } : {},
    select: { id: true, tier: true, stripeCustomerId: true },
  })
  return user as any
}

export async function getUserTier(clerkId: string): Promise<Tier> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { tier: true },
  })
  return (user?.tier ?? 'FREE') as Tier
}

export async function isPremium(clerkId: string): Promise<boolean> {
  const tier = await getUserTier(clerkId)
  return isPremiumTier(tier)
}

export async function getScanUsage(userId: string): Promise<number> {
  const yearMonth = new Date().toISOString().slice(0, 7)
  const record = await prisma.scanUsage.findUnique({
    where: { userId_yearMonth: { userId, yearMonth } },
    select: { count: true },
  })
  return record?.count ?? 0
}

export async function incrementScanUsage(userId: string): Promise<number> {
  const yearMonth = new Date().toISOString().slice(0, 7)
  const record = await prisma.scanUsage.upsert({
    where: { userId_yearMonth: { userId, yearMonth } },
    create: { userId, yearMonth, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  })
  return record.count
}
