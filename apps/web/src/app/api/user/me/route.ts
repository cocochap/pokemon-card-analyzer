import { NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { getUserWithTier } from '@/lib/subscription'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function GET() {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ tier: 'FREE', subscription: null })

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress

  const user = await getUserWithTier(clerkId, email ?? undefined)

  const subscription = await prisma.subscription.findFirst({
    where: { user: { clerkId }, status: { in: ['active', 'trialing'] } },
    orderBy: { createdAt: 'desc' },
    select: { tier: true, status: true, currentPeriodEnd: true, cancelAtPeriodEnd: true },
  })

  return NextResponse.json({ tier: user.tier, subscription })
}
