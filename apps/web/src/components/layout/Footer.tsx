import Link from 'next/link'
import { Zap } from 'lucide-react'

const links = {
  Product: [
    { label: 'Market', href: '/' },
    { label: 'Cards', href: '/cards' },
    { label: 'Sets', href: '/sets' },
    { label: 'AI Insights', href: '/ai' },
    { label: 'Pricing', href: '/pricing' },
  ],
  Platform: [
    { label: 'Portfolio Tracker', href: '/portfolio' },
    { label: 'Price Alerts', href: '/alerts' },
    { label: 'API', href: '/api-docs' },
    { label: 'Market Index', href: '/market' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '/privacy' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Disclaimer', href: '/disclaimer' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-white/10 mt-20">
      <div className="container mx-auto px-4 py-12 max-w-[1600px]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 bg-pokemon-yellow rounded-lg flex items-center justify-center">
                <Zap className="w-4 h-4 text-background" />
              </div>
              <span className="font-bold text-lg">Poke<span className="text-pokemon-yellow">Market</span></span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              The most advanced Pokémon TCG market intelligence platform.
              Track prices, predict trends, invest smarter.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-4">
              Not affiliated with Nintendo, Game Freak, or The Pokémon Company.
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="font-semibold text-sm mb-3">{group}</h4>
              <ul className="space-y-2">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link
                      href={href}
                      className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-10 pt-8 border-t border-white/10">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} PokeMarket. All rights reserved.
          </p>
          <p className="text-xs text-muted-foreground">
            Prices are for informational purposes only. Not financial advice.
          </p>
        </div>
      </div>
    </footer>
  )
}
