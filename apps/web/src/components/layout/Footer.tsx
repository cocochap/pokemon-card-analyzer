'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useT } from '@/lib/i18n/LanguageContext'

export function Footer() {
  const t = useT()

  const links = {
    [t.footer.product]: [
      { label: 'Scan a Card',              href: '/scan' },
      { label: t.footer.links.market,      href: '/' },
      { label: t.footer.links.cards,       href: '/cards' },
      { label: t.footer.links.sets,        href: '/sets' },
      { label: t.footer.links.ai,          href: '/ai' },
    ],
    [t.footer.platform]: [
      { label: t.footer.links.portfolio,   href: '/portfolio' },
      { label: t.footer.links.alerts,      href: '/alerts' },
      { label: t.footer.links.marketIndex, href: '/market' },
    ],
    [t.footer.legal]: [
      { label: t.footer.links.privacy,     href: '/privacy' },
      { label: t.footer.links.terms,       href: '/terms' },
      { label: t.footer.links.disclaimer,  href: '/disclaimer' },
    ],
  }

  return (
    <footer className="border-t mt-20" style={{ borderColor: 'rgba(59,130,246,0.08)' }}>
      <div className="container mx-auto px-4 py-12 max-w-[1600px]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="relative w-9 h-9">
                <Image src="/logo-pokescan.png" alt="Scard" fill className="object-contain" />
              </div>
              <span className="font-bold text-lg">Scard</span>
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
              {t.footer.tagline}
            </p>
            <p className="text-xs text-muted-foreground/40 mt-4">
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
                    <Link href={href} className="text-sm text-muted-foreground hover:text-electric-400 transition-colors">
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
