'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import {
  BarChart3, Bell, Briefcase, Camera, Home, Menu, Package, Search,
  ShoppingBag, Sparkles, TrendingUp, X, Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { useUserTier, TIER_CONFIG } from '@/lib/useUserTier'

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const { t, locale, setLocale } = useLanguage()
  const { tier } = useUserTier()
  const tierConf = TIER_CONFIG[tier]

  const navLinks = [
    { href: '/',          label: t.nav.market,    icon: Home },
    { href: '/cards',     label: t.nav.cards,     icon: BarChart3 },
    { href: '/sets',      label: t.nav.sets,      icon: TrendingUp },
    { href: '/portfolio', label: t.nav.portfolio, icon: Briefcase },
    { href: '/ai',        label: t.nav.aiInsights,icon: Sparkles, badge: 'AI' },
    { href: '/deal',      label: 'Deal Vinted',   icon: ShoppingBag, badge: 'NEW' },
    { href: '/sealed',    label: 'Coffrets',      icon: Package },
    { href: '/scan',      label: t.nav.scan,      icon: Camera },
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

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Prevent scroll when menu open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <>
      <nav className={clsx(
        'sticky top-0 z-50 w-full transition-all duration-300',
        scrolled
          ? tier === 'ELITE'
            ? 'bg-[#060918]/95 backdrop-blur-xl border-b border-purple-500/20 shadow-[0_4px_24px_rgba(0,0,0,0.5),0_0_40px_rgba(167,139,250,0.06)]'
            : tier === 'PRO' || tier === 'STARTER'
            ? 'bg-[#060918]/95 backdrop-blur-xl border-b border-[#FFCB05]/15 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
            : 'bg-[#060918]/95 backdrop-blur-xl border-b border-[#FFCB05]/10 shadow-[0_4px_24px_rgba(0,0,0,0.5)]'
          : 'bg-[#060918]/80 backdrop-blur-md border-b border-white/5',
      )}>
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex h-14 md:h-16 items-center justify-between gap-3">

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 flex-shrink-0 group">
              <div className="relative w-7 h-7 md:w-8 md:h-8 drop-shadow-[0_0_8px_rgba(255,203,5,0.4)]">
                <Image src="/logo-pokescan.png" alt="PokeScard" fill className="object-contain" />
              </div>
              <span className="font-bold text-lg md:text-xl tracking-tight hidden sm:block"
                style={{ background: 'linear-gradient(135deg,#FFCB05,#F59E0B)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                PokeScard
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-0.5 flex-1 justify-center">
              {navLinks.slice(0, 6).map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link key={href} href={href}
                    className={clsx(
                      'relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium transition-all duration-150',
                      isActive ? 'text-[#FFCB05]' : 'text-white/60 hover:text-white/90 hover:bg-white/5',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full"
                        style={{ background: 'rgba(255,203,5,0.15)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.3)' }}>
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div layoutId="nav-active"
                        className="absolute inset-0 rounded-xl -z-10"
                        style={{ background: 'rgba(255,203,5,0.08)', border: '1px solid rgba(255,203,5,0.20)' }}
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1.5 flex-shrink-0">

              {/* Search — desktop */}
              <button onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.5)' }}>
                <Search className="w-3.5 h-3.5" />
                <span className="hidden lg:inline text-xs">Rechercher</span>
                <kbd className="text-[10px] px-1.5 py-0.5 rounded-md hidden lg:block"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.4)' }}>⌘K</kbd>
              </button>

              {/* Language toggle */}
              <button onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                className="hidden sm:flex items-center gap-1 px-2 py-1.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.6)' }}>
                <span className="text-base">{locale === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
              </button>

              {/* Scan CTA — desktop */}
              <Link href="/scan"
                className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200 hover:brightness-110"
                style={{ background: 'linear-gradient(135deg,#F59E0B,#FFCB05)', color: '#0A0E18', boxShadow: '0 0 16px rgba(255,203,5,0.25)' }}>
                <Camera className="w-4 h-4" />
                {t.nav.scan}
              </Link>

              {/* Auth — desktop */}
              <SignedOut>
                <SignInButton mode="redirect" forceRedirectUrl="/portfolio">
                  <button className="hidden md:flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.85)' }}>
                    {t.nav.signIn}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/alerts" className="relative p-2 rounded-xl transition-colors hidden sm:flex hover:bg-white/5">
                  <Bell className="w-5 h-5 text-white/60" />
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full" style={{ background: '#FFCB05' }} />
                </Link>
                {tierConf.badgeText && (
                  <Link href="/pricing" className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wider hover:brightness-110"
                    style={tier === 'ELITE'
                      ? { background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(167,139,250,0.15))', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.35)' }
                      : { background: 'rgba(255,203,5,0.12)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.30)' }
                    }>
                    {tier === 'ELITE' ? '👑' : '⭐'} {tierConf.badgeText}
                  </Link>
                )}
                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-8 h-8 md:w-9 md:h-9' } }} />
              </SignedIn>

              {/* Mobile: search + hamburger */}
              <button className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-colors" onClick={() => setCommandOpen(true)}>
                <Search className="w-5 h-5 text-white/60" />
              </button>
              <button className="md:hidden p-2 rounded-xl hover:bg-white/5 transition-colors" onClick={() => setMobileOpen(o => !o)}>
                {mobileOpen ? <X className="w-5 h-5 text-white/80" /> : <Menu className="w-5 h-5 text-white/80" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile menu overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-x-0 top-14 bottom-16 z-40 md:hidden flex flex-col"
            style={{ background: '#060918', borderTop: '1px solid rgba(255,255,255,0.06)' }}
          >
            <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
              {navLinks.map(({ href, label, icon: Icon, badge }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                return (
                  <Link key={href} href={href}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3.5 rounded-xl text-base font-medium transition-colors',
                      isActive
                        ? 'text-pokemon-yellow bg-pokemon-yellow/8'
                        : 'text-white/70 hover:text-white hover:bg-white/5',
                    )}
                    style={isActive ? { border: '1px solid rgba(255,203,5,0.2)' } : { border: '1px solid transparent' }}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                    {badge && (
                      <span className="ml-auto px-2 py-0.5 text-[10px] font-bold rounded-full"
                        style={{ background: 'rgba(255,203,5,0.15)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.3)' }}>
                        {badge}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Bottom auth actions */}
            <div className="px-4 pb-4 pt-4 space-y-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              {/* Language */}
              <button onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}
                className="flex items-center gap-2 w-full px-4 py-3 rounded-xl text-sm font-medium transition-colors"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.6)' }}>
                <span className="text-lg">{locale === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                <span>{locale === 'fr' ? 'Français' : 'English'}</span>
              </button>

              <SignedOut>
                <SignInButton mode="redirect" forceRedirectUrl="/portfolio">
                  <button className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>
                    {t.nav.signIn}
                  </button>
                </SignInButton>
                <Link href="/pricing"
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold"
                  style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)', color: '#FFCB05' }}>
                  <Zap className="w-4 h-4" /> Voir les offres Premium
                </Link>
              </SignedOut>
              <SignedIn>
                <div className="flex items-center gap-3 px-4 py-2">
                  <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-10 h-10' } }} />
                  {tierConf.badgeText && (
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full"
                      style={tier === 'ELITE'
                        ? { background: 'rgba(167,139,250,0.15)', color: '#A78BFA', border: '1px solid rgba(167,139,250,0.35)' }
                        : { background: 'rgba(255,203,5,0.12)', color: '#FFCB05', border: '1px solid rgba(255,203,5,0.30)' }
                      }>
                      {tier === 'ELITE' ? '👑' : '⭐'} {tierConf.badgeText}
                    </span>
                  )}
                </div>
              </SignedIn>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}
