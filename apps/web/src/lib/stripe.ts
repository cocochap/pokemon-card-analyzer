import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as any,
  typescript: true,
})

export const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID_PREMIUM!
