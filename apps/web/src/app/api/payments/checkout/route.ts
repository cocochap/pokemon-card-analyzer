import { NextRequest, NextResponse } from 'next/server'
import { auth, currentUser } from '@clerk/nextjs/server'
import { stripe, STRIPE_PRICE_ID_PRO, STRIPE_PRICE_ID_ELITE } from '@/lib/stripe'
import { getUserWithTier } from '@/lib/subscription'
import { prisma } from '@/lib/db/prisma'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth()
  if (!clerkId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan } = await req.json().catch(() => ({ plan: 'pro' }))
  const priceId = plan === 'elite' ? STRIPE_PRICE_ID_ELITE : STRIPE_PRICE_ID_PRO

  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress

  const user = await getUserWithTier(clerkId, email ?? undefined)

  let stripeCustomerId = user.stripeCustomerId
  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: email ?? undefined,
      metadata: { clerkId },
    })
    stripeCustomerId = customer.id
    await prisma.user.update({
      where: { id: user.id },
      data: { stripeCustomerId },
    })
  }

  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}/pricing?success=true&plan=${plan}`,
    cancel_url: `${origin}/pricing?canceled=true`,
    metadata: { clerkId, plan },
    subscription_data: { metadata: { clerkId, plan } },
    allow_promotion_codes: true,
  })

  return NextResponse.json({ url: session.url })
}
