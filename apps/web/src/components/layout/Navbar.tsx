'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import { BarChart3, Bell, Briefcase, Home, Search, Sparkles, TrendingUp, Menu, X } from 'lucide-react'
import { clsx } from 'clsx'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { LivePriceBadge } from '@/components/market/LivePriceBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Locale } from '@/lib/i18n/translations'

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)
  const { t, locale, setLocale } = useLanguage()

  const navLinks = [
    { href: '/', label: t.nav.market, icon: Home },
    { href: '/cards', label: t.nav.cards, icon: BarChart3 },
    { href: '/sets', label: t.nav.sets, icon: TrendingUp },
    { href: '/portfolio', label: t.nav.portfolio, icon: Briefcase, auth: true },
    { href: '/alerts', label: t.nav.alerts, icon: Bell, auth: true },
    { href: '/ai', label: t.nav.aiInsights, icon: Sparkles, badge: 'PRO' },
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
        scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-white/10 shadow-glass' : 'bg-transparent',
      )}>
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex h-16 items-center justify-between">

            {/* Logo — Pokéball style */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-9 h-9 shrink-0">
                {/* Pokéball */}
                <div className="w-full h-full rounded-full border-2 border-white/30 overflow-hidden shadow-lg group-hover:shadow-glow transition-shadow duration-300">
                  <div className="absolute top-0 left-0 right-0 h-1/2 bg-pokemon-red" />
                  <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-white" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-0 h-[2px] bg-black absolute left-0 right-0" style={{ top: '50%', height: '2px' }} />
                    <div className="w-3.5 h-3.5 rounded-full bg-white border-2 border-black z-10 relative" />
                  </div>
                </div>
              </div>
              <span className="font-bold text-xl tracking-tight">
                Poke<span className="text-pokemon-yellow">Market</span>
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
                        ? 'text-pokemon-yellow'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pokemon-yellow/20 text-pokemon-yellow border border-pokemon-yellow/30">
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-pokemon-yellow/10 rounded-xl border border-pokemon-yellow/20 -z-10"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              <LivePriceBadge />

              {/* Search */}
              <button
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm text-muted-foreground hover:bg-white/10 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span className="hidden lg:inline">{t.nav.search}</span>
                <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded-md hidden lg:block">⌘K</kbd>
              </button>

              {/* Language toggle */}
              <button
                onClick={toggleLang}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 border border-white/10 rounded-xl text-sm font-medium hover:bg-white/10 transition-colors"
                title={locale === 'fr' ? 'Switch to English' : 'Passer en français'}
              >
                <span className="text-base">{locale === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                <span className="text-xs text-muted-foreground uppercase">{locale}</span>
              </button>

              {/* Auth */}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-pokemon-yellow text-background font-bold text-sm rounded-xl hover:bg-pokemon-yellow/90 transition-all hover:scale-105 shadow-glow">
                    {t.nav.signIn}
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/alerts" className="relative p-2 hover:bg-white/5 rounded-xl transition-colors">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-pokemon-yellow rounded-full animate-pulse" />
                </Link>
                <UserButton afterSignOutUrl="/" appearance={{ elements: { avatarBox: 'w-9 h-9' } }} />
              </SignedIn>

              {/* Mobile toggle */}
              <button
                className="md:hidden p-2 hover:bg-white/5 rounded-xl transition-colors"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-white/10 bg-background/95 backdrop-blur-xl"
            >
              <div className="container mx-auto px-4 py-4 flex flex-col gap-2">
                {navLinks.map(({ href, label, icon: Icon, badge }) => (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={clsx(
                      'flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium transition-colors',
                      pathname === href
                        ? 'bg-pokemon-yellow/10 text-pokemon-yellow border border-pokemon-yellow/20'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                    {badge && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-pokemon-yellow/20 text-pokemon-yellow">
                        {badge}
                      </span>
                    )}
                  </Link>
                ))}
                {/* Lang in mobile */}
                <button
                  onClick={toggleLang}
                  className="flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-medium text-muted-foreground hover:bg-white/5"
                >
                  <span className="text-xl">{locale === 'fr' ? '🇫🇷' : '🇬🇧'}</span>
                  <span>{locale === 'fr' ? 'Passer en anglais' : 'Switch to French'}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}
