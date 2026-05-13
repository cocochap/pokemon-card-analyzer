import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-11-20.acacia' as any,
  typescript: true,
})

export const STRIPE_PRICE_ID_PRO   = process.env.STRIPE_PRICE_ID_PREMIUM!
export const STRIPE_PRICE_ID_ELITE = process.env.STRIPE_PRICE_ID_ELITE!

// Back-compat
export const STRIPE_PRICE_ID = STRIPE_PRICE_ID_PRO
