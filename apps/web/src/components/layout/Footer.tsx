'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Camera, Github, Twitter } from 'lucide-react'

const links = {
  Produit: [
    { label: 'Scanner une carte', href: '/scan' },
    { label: 'Explorer les cartes', href: '/cards' },
    { label: 'Extensions', href: '/sets' },
    { label: 'IA Insights', href: '/ai' },
  ],
  Plateforme: [
    { label: 'Portfolio', href: '/portfolio' },
    { label: 'Alertes de prix', href: '/alerts' },
    { label: 'Tarifs', href: '/pricing' },
  ],
  Légal: [
    { label: 'Confidentialité', href: '/privacy' },
    { label: 'Conditions d\'utilisation', href: '/terms' },
    { label: 'Avertissement', href: '/disclaimer' },
  ],
}

export function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 mt-8">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-10 mb-12">

          {/* Brand */}
          <div className="col-span-2">
            <Link href="/" className="flex items-center gap-2.5 mb-4">
              <div className="relative w-8 h-8">
                <Image src="/logo-pokescan.png" alt="Scard" fill className="object-contain" />
              </div>
              <span className="font-bold text-lg text-gray-900">Scard</span>
            </Link>
            <p className="text-sm text-gray-500 max-w-xs leading-relaxed mb-5">
              La plateforme de référence pour scanner, analyser et suivre vos cartes Pokémon TCG avec l'IA.
            </p>

            {/* CTA */}
            <Link
              href="/scan"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white mb-6"
              style={{ background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)' }}
            >
              <Camera className="w-4 h-4" />
              Scanner une carte
            </Link>

            {/* Social */}
            <div className="flex items-center gap-2">
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 flex items-center justify-center rounded-xl bg-white border border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300 transition-colors">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Links */}
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <h4 className="font-semibold text-sm mb-4 text-gray-900">{group}</h4>
              <ul className="space-y-2.5">
                {items.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-sm text-gray-500 hover:text-gray-900 transition-colors">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 pt-8 border-t border-gray-200">
          <p className="text-xs text-gray-400">
            © 2026 Scard. Tous droits réservés.
          </p>
          <p className="text-xs text-gray-400 text-center">
            Prix fournis à titre indicatif. Pas un conseil financier.
            Pokémon est une marque de Nintendo / The Pokémon Company.
          </p>
        </div>
      </div>
    </footer>
  )
}
