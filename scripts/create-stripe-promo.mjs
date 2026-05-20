/**
 * Crée le coupon POKESCARD10 dans Stripe : -10% sur le premier mois (Premium + Elite).
 * Usage : STRIPE_SECRET_KEY=sk_... node scripts/create-stripe-promo.mjs
 */
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-11-20.acacia',
})

const PROMO_CODE = 'POKESCARD10'

async function main() {
  // Vérifier si le code existe déjà
  const existing = await stripe.promotionCodes.list({ code: PROMO_CODE, limit: 1 })
  if (existing.data.length > 0) {
    console.log(`Le code "${PROMO_CODE}" existe déjà :`, existing.data[0].id)
    return
  }

  // Créer le coupon : -10% sur la première facture uniquement
  const coupon = await stripe.coupons.create({
    name: 'PokeScard -10% premier mois',
    percent_off: 10,
    duration: 'once',
    currency: 'eur',
    metadata: { source: 'pokescard_launch' },
  })
  console.log('Coupon créé :', coupon.id)

  // Créer le code promo associé
  const promoCode = await stripe.promotionCodes.create({
    coupon: coupon.id,
    code: PROMO_CODE,
    metadata: { campaign: 'launch' },
  })
  console.log(`Code promo "${promoCode.code}" créé :`, promoCode.id)
  console.log('Done ✓')
}

main().catch(err => {
  console.error(err.message)
  process.exit(1)
})
