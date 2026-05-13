'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { BarChart3, Bell, Briefcase, Camera, Home, Search, Sparkles, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { t, locale, setLocale } = useLanguage()

  const navLinks = [
    { href: '/',          label: t.nav.market,    icon: Home },
    { href: '/cards',     label: t.nav.cards,      icon: BarChart3 },
    { href: '/sets',      label: t.nav.sets,       icon: TrendingUp },
    { href: '/portfolio', label: t.nav.portfolio,  icon: Briefcase },
    { href: '/ai',        label: t.nav.aiInsights, icon: Sparkles, badge: 'AI' },
  ]

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', h, { passive: true })
    return () => window.removeEventListener('scroll', h)
  }, [])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setCommandOpen(true) }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [])

  return (
    <>
      <nav className={clsx(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-white/95 backdrop-blur-xl border-b border-gray-200/80 shadow-sm'
          : 'bg-white/80 backdrop-blur-md',
      )}>
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex h-16 items-center justify-between gap-4">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="relative w-8 h-8">
                <Image
                  src="/logo-pokescan.png"
                  alt="Scard"
                  fill
                  className="object-contain"
                />
              </div>
              <span className="font-bold text-xl tracking-tight text-gray-900 hidden sm:block">
                Scard
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
              {navLinks.map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                      isActive
                        ? 'text-blue-700 bg-blue-50'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-blue-100 text-blue-700">
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-blue-50 rounded-xl -z-10 border border-blue-100"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* Search */}
              <button
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-xs">Rechercher</span>
                <kbd className="text-[10px] bg-white border border-gray-200 px-1.5 py-0.5 rounded-md hidden lg:block">⌘K</kbd>
              </button>

              {/* Language toggle */}
              <button
                onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
                title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
              >
                <span className="text-base">{locale === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                <span className="text-xs text-gray-500 uppercase hidden sm:block">{locale}</span>
              </button>

              {/* Scan CTA */}
              <Link
                href="/scan"
                className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:scale-[1.02]"
                style={{
                  background: 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
                  boxShadow: '0 2px 8px rgba(29,78,216,0.25)',
                }}
              >
                <Camera className="w-4 h-4" />
                {t.nav.scan}
              </Link>

              {/* Auth */}
              <SignedOut>
                <Link
                  href="/pricing"
                  className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Premium
                </Link>
                <SignInButton mode="redirect" forceRedirectUrl="/portfolio">
                  <button className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-gray-700 border border-gray-200 hover:bg-gray-50 transition-colors">
                    {t.nav.signIn}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/alerts" className="relative p-2 hover:bg-gray-100 rounded-xl transition-colors hidden sm:flex">
                  <Bell className="w-5 h-5 text-gray-600" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-600 rounded-full" />
                </Link>
                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
              </SignedIn>

              {/* Mobile search */}
              <button
                className="md:hidden p-2 hover:bg-gray-100 rounded-xl transition-colors"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}
