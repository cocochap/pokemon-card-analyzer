'use client'

import Link from 'next/link'
import { useT } from '@/lib/i18n/LanguageContext'

export function Footer() {
  const t = useT()

  const links = {
    [t.footer.product]: [
      { label: t.footer.links.market, href: '/' },
      { label: t.footer.links.cards, href: '/cards' },
      { label: t.footer.links.sets, href: '/sets' },
      { label: t.footer.links.ai, href: '/ai' },
      { label: t.footer.links.pricing, href: '/pricing' },
    ],
    [t.footer.platform]: [
      { label: t.footer.links.portfolio, href: '/portfolio' },
      { label: t.footer.links.alerts, href: '/alerts' },
      { label: t.footer.links.marketIndex, href: '/market' },
    ],
    [t.footer.legal]: [
      { label: t.footer.links.privacy, href: '/privacy' },
      { label: t.footer.links.terms, href: '/terms' },
      { label: t.footer.links.disclaimer, href: '/disclaimer' },
    ],
  }

  return (
    <footer className="border-t border-white/10 mt-20">
      <div className="container mx-auto px-4 py-12 max-w-[1600px]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="relative w-8 h-8 rounded-full border-2 border-white/20 overflow-hidden shadow-md">
                <div className="absolute top-0 left-0 right-0 h-1/2 bg-pokemon-red" />
                <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-0 absolute left-0 right-0 h-[2px] bg-black" style={{ top: '50%' }} />
                  <div className="w-3 h-3 rounded-full bg-white border-2 border-black z-10 relative" />
                </div>
              </div>
              <span className="font-bold text-lg">Poke<span className="text-pokemon-yellow">Market</span></span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              {t.footer.tagline}
            </p>
            <p className="text-xs text-muted-foreground/50 mt-4">
              {t.footer.disclaimer}
            </p>
          </div>

          {/* Links */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="font-semibold text-sm mb-3 text-foreground">{group}</h4>
              <ul className="space-y-2">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-muted-foreground hover:text-pokemon-yellow transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-10 pt-8 border-t border-white/10">
          <p className="text-xs text-muted-foreground">{t.footer.rights}</p>
          <p className="text-xs text-muted-foreground">{t.footer.infoOnly}</p>
        </div>
      </div>
    </footer>
  )
}
