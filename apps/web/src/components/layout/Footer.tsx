'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Camera, Zap } from 'lucide-react'

const links = {
  Produit: [
    { label: 'Scanner une carte', href: '/scan' },
    { label: 'Explorer les cartes', href: '/cards' },
    { label: 'Coffrets scellés', href: '/sealed' },
    { label: 'Extensions', href: '/sets' },
    { label: 'IA Insights', href: '/ai' },
  ],
  Plateforme: [
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Alertes de prix', href: '/alerts' },
    { label: 'Tarifs', href: '/pricing' },
  ],
  Légal: [
    { label: 'Mentions légales', href: '/mentions-legales' },
    { label: 'Confidentialité', href: '/privacy' },
    { label: 'Conditions d\'utilisation', href: '/terms' },
    { label: 'Avertissement', href: '/disclaimer' },
  ],
}

export function Footer() {
  return (
    <footer className="mt-16" style={{ borderTop: '1px solid rgba(255,203,5,0.10)', background: 'rgba(6,9,24,0.95)' }}>
      <div className="container mx-auto px-4 py-12 max-w-[1600px]">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="relative w-8 h-8 drop-shadow-[0_0_8px_rgba(255,203,5,0.4)]">
                <Image src="/logo-pokescan.png" alt="PokeScard" fill className="object-contain" />
              </div>
              <span className="font-bold text-lg"
                style={{ background: 'linear-gradient(135deg,#FFCB05,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                PokeScard
              </span>
            </Link>
            <p className="text-sm text-white/40 max-w-xs leading-relaxed mb-5">
              La plateforme de référence pour scanner, analyser et suivre vos cartes Pokémon TCG avec l'IA.
            </p>

            {/* CTA */}
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold mb-6 transition-all hover:brightness-110"
              style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18', boxShadow: '0 0 16px rgba(255,203,5,0.2)' }}
            >
              <Camera className="w-4 h-4" />
              Scanner une carte
            </Link>

            {/* Social */}
            <div className="flex items-center gap-2">
              <a href="https://www.tiktok.com/@pokescard" target="_blank" rel="noopener noreferrer"
                aria-label="TikTok PokeScard"
                className="w-9 h-9 flex items-center justify-center rounded-xl transition-colors text-white/40 hover:text-[#FFCB05]"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1-.07z"/>
                </svg>
              </a>
              <Link href="/pricing" className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors"
                style={{ background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.20)', color: '#FFCB05' }}>
                <Zap className="w-3.5 h-3.5" /> Premium
              </Link>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="font-semibold text-sm mb-4 text-white/70">{group}</h4>
              <ul className="space-y-2.5">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-white/35 hover:text-[#FFCB05] transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Gold divider */}
        <div className="gold-divider mb-6" />

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-white/25">
            © 2026 PokeScard. Tous droits réservés.
          </p>
          <p className="text-xs text-white/25 text-center">
            Prix fournis à titre indicatif. Pas un conseil financier.
            Pokémon est une marque de Nintendo / The Pokémon Company.
          </p>
        </div>
      </div>
    </footer>
  )
}
