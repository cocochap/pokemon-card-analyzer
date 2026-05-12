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
import { LivePriceBadge } from '@/components/market/LivePriceBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { t, locale, setLocale } = useLanguage()

  const navLinks = [
    { href: '/',          label: t.nav.market,     icon: Home },
    { href: '/cards',     label: t.nav.cards,       icon: BarChart3 },
    { href: '/sets',      label: t.nav.sets,        icon: TrendingUp },
    { href: '/portfolio', label: t.nav.portfolio,   icon: Briefcase, auth: true },
    { href: '/alerts',    label: t.nav.alerts,      icon: Bell, auth: true },
    { href: '/ai',        label: t.nav.aiInsights,  icon: Sparkles, badge: 'AI' },
  ]

  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 20)
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

  const toggleLang = () => setLocale(locale === 'fr' ? 'en' : 'fr')

  return (
    <>
      <nav className={clsx(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? 'bg-navy-900/90 backdrop-blur-xl border-b border-electric-500/10 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
          : 'bg-transparent',
      )}>
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex h-16 items-center justify-between">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group flex-shrink-0">
              <div className="relative w-9 h-9">
                <Image
                  src="/logo-pokescan.png"
                  alt="Scard"
                  fill
                  className="object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]"
                />
              </div>
              <span className="font-bold text-xl tracking-tight hidden sm:block">
                Scard
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-0.5">
              {navLinks.map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'text-electric-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04]',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-electric-500/20 text-electric-300 border border-electric-500/30">
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-electric-500/10 rounded-xl border border-electric-500/20 -z-10"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:block"><LivePriceBadge /></div>

              {/* Scan CTA — desktop */}
              <Link
                href="/scan"
                className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: 'linear-gradient(135deg, #2563EB 0%, #3B82F6 100%)',
                  boxShadow: '0 0 20px rgba(59,130,246,0.3)',
                  color: '#fff',
                }}
              >
                <Camera className="w-4 h-4" />
                {t.nav.scan}
              </Link>

              {/* Search button */}
              <button
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-muted-foreground hover:bg-white/[0.07] hover:text-foreground transition-colors"
              >
                <Search className="w-4 h-4" />
                <span className="hidden lg:inline">{t.nav.search}</span>
                <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded-md hidden lg:block">⌘K</kbd>
              </button>

              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm font-medium hover:bg-white/[0.07] transition-colors"
                title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
              >
                <span className="text-base">{locale === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                <span className="text-xs text-muted-foreground uppercase hidden sm:block">{locale}</span>
              </button>

              {/* Auth */}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="btn-ghost text-sm">
                    {t.nav.signIn}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/alerts" className="relative p-2 hover:bg-white/[0.04] rounded-xl transition-colors hidden sm:flex">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-electric-500 rounded-full animate-pulse" />
                </Link>
                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
              </SignedIn>

              {/* Mobile search */}
              <button
                className="md:hidden p-2 hover:bg-white/[0.04] rounded-xl transition-colors"
                onClick={() => setCommandOpen(true)}
              >
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}
