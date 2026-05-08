import type { Metadata } from 'next'
import { Check, Zap } from 'lucide-react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Pricing',
  description: 'Choose your PokeMarket plan and start investing smarter.',
}

const plans = [
  {
    name: 'Free',
    price: '0',
    period: 'forever',
    description: 'For casual collectors',
    features: [
      'Live card prices',
      'Basic market data',
      '30-day price history',
      'Up to 50 portfolio cards',
      '5 price alerts',
    ],
    cta: 'Get Started',
    href: '/sign-up',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '14.99',
    period: 'month',
    description: 'For serious investors',
    features: [
      'Everything in Free',
      'AI price predictions (7/30/90 days)',
      'Investment scoring',
      'Full price history',
      'Unlimited portfolio',
      '50 price alerts',
      'eBay sold data',
      'PSA population stats',
      'Advanced charts (candles, RSI)',
      'Portfolio analytics',
      'CSV import/export',
    ],
    cta: 'Start 7-day Free Trial',
    href: '/checkout/pro',
    highlighted: true,
    badge: 'Most Popular',
  },
  {
    name: 'Elite',
    price: '39.99',
    period: 'month',
    description: 'For professional traders',
    features: [
      'Everything in Pro',
      'API access (10k req/day)',
      'Unlimited alerts',
      'Real-time WebSocket prices',
      'AI market insights',
      'Bulk portfolio analytics',
      'Priority support',
      'Early access to new features',
    ],
    cta: 'Start 7-day Free Trial',
    href: '/checkout/elite',
    highlighted: false,
  },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="container mx-auto px-4 py-16 max-w-5xl">
        {/* Header */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-pokemon-yellow/10 border border-pokemon-yellow/30 rounded-full text-pokemon-yellow text-sm font-medium mb-6">
            <Zap className="w-4 h-4" />
            Pricing
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Invest in Pokémon like a <span className="gradient-text">professional</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            All plans include a 7-day free trial. Cancel anytime.
          </p>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`glass-card p-6 flex flex-col relative ${
                plan.highlighted
                  ? 'border-pokemon-yellow/40 bg-pokemon-yellow/5 shadow-glow'
                  : ''
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-pokemon-yellow text-background text-xs font-bold rounded-full">
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                <p className="text-muted-foreground text-sm mb-4">{plan.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-bold font-mono">€{plan.price}</span>
                  <span className="text-muted-foreground text-sm">/{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((feat) => (
                  <li key={feat} className="flex items-start gap-2.5 text-sm">
                    <Check className="w-4 h-4 text-market-bull mt-0.5 shrink-0" />
                    <span className="text-foreground/90">{feat}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`w-full py-3 rounded-xl font-semibold text-center transition-all duration-200 ${
                  plan.highlighted
                    ? 'bg-pokemon-yellow text-background hover:bg-pokemon-yellow/90 shadow-glow'
                    : 'bg-white/5 border border-white/10 hover:bg-white/10'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* FAQ */}
        <div className="mt-20 text-center">
          <h2 className="text-2xl font-bold mb-2">Questions?</h2>
          <p className="text-muted-foreground">
            Contact us at{' '}
            <a href="mailto:support@pokemarket.io" className="text-pokemon-yellow hover:underline">
              support@pokemarket.io
            </a>
          </p>
        </div>
      </main>

      <Footer />
    </div>
  )
}
