import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/db/prisma'
import type Stripe from 'stripe'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not set')
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message)
    return NextResponse.json({ error: `Webhook error: ${err.message}` }, { status: 400 })
  }

  const subscription = event.data.object as Stripe.Subscription

  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const clerkId = subscription.metadata?.clerkId
      if (!clerkId) break

      const isActive = subscription.status === 'active' || subscription.status === 'trialing'
      const tier = isActive ? 'PRO' : 'FREE'

      await prisma.user.update({ where: { clerkId }, data: { tier } })

      await prisma.subscription.upsert({
        where: { stripeSubscriptionId: subscription.id },
        create: {
          stripeSubscriptionId: subscription.id,
          tier,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          user: { connect: { clerkId } },
        },
        update: {
          tier,
          status: subscription.status,
          currentPeriodStart: new Date(subscription.current_period_start * 1000),
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      })
      break
    }

    case 'customer.subscription.deleted': {
      const clerkId = subscription.metadata?.clerkId
      if (!clerkId) break

      await prisma.user.update({ where: { clerkId }, data: { tier: 'FREE' } })
      await prisma.subscription.updateMany({
        where: { stripeSubscriptionId: subscription.id },
        data: { status: 'canceled', tier: 'FREE' },
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
