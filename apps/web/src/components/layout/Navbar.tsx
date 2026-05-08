'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { SignInButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import {
  BarChart3,
  Bell,
  Briefcase,
  ChevronDown,
  Home,
  Search,
  Sparkles,
  TrendingUp,
  Menu,
  X,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import { CommandPalette } from '@/components/ui/CommandPalette'
import { LivePriceBadge } from '@/components/market/LivePriceBadge'

const navLinks = [
  { href: '/', label: 'Market', icon: Home },
  { href: '/cards', label: 'Cards', icon: BarChart3 },
  { href: '/sets', label: 'Sets', icon: TrendingUp },
  { href: '/portfolio', label: 'Portfolio', icon: Briefcase, auth: true },
  { href: '/alerts', label: 'Alerts', icon: Bell, auth: true },
  { href: '/ai', label: 'AI Insights', icon: Sparkles, badge: 'PRO' },
]

export function Navbar() {
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandOpen(true)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <>
      <nav
        className={clsx(
          'sticky top-0 z-50 w-full transition-all duration-300',
          scrolled
            ? 'bg-background/80 backdrop-blur-xl border-b border-white/10 shadow-glass'
            : 'bg-transparent',
        )}
      >
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="relative w-8 h-8">
                <div className="absolute inset-0 bg-pokemon-yellow rounded-lg rotate-6 group-hover:rotate-12 transition-transform" />
                <div className="relative flex items-center justify-center w-full h-full">
                  <Zap className="w-5 h-5 text-background font-bold" />
                </div>
              </div>
              <span className="font-bold text-xl tracking-tight">
                Poke<span className="text-pokemon-yellow">Market</span>
              </span>
            </Link>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center gap-1">
              {navLinks.map(({ href, label, icon: Icon, badge, auth }) => {
                const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
                const link = (
                  <Link
                    key={href}
                    href={href}
                    className={clsx(
                      'relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                      isActive
                        ? 'text-pokemon-yellow bg-pokemon-yellow/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5',
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {badge && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-pokemon-yellow/20 text-pokemon-yellow border border-pokemon-yellow/30">
                        {badge}
                      </span>
                    )}
                    {isActive && (
                      <motion.div
                        layoutId="nav-active"
                        className="absolute inset-0 bg-pokemon-yellow/10 rounded-lg -z-10"
                        transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                      />
                    )}
                  </Link>
                )
                if (auth) {
                  return (
                    <SignedIn key={href}>{link}</SignedIn>
                  )
                }
                return link
              })}
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-2">
              {/* Live Market Badge */}
              <LivePriceBadge />

              {/* Search */}
              <button
                onClick={() => setCommandOpen(true)}
                className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-muted-foreground hover:bg-white/10 transition-colors"
              >
                <Search className="w-4 h-4" />
                <span>Search cards...</span>
                <kbd className="text-xs bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
              </button>

              {/* Auth */}
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="px-4 py-2 bg-pokemon-yellow text-background font-semibold text-sm rounded-lg hover:bg-pokemon-yellow/90 transition-colors">
                    Sign In
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <Link href="/alerts" className="relative p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <Bell className="w-5 h-5 text-muted-foreground" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-pokemon-yellow rounded-full" />
                </Link>
                <UserButton
                  afterSignOutUrl="/"
                  appearance={{
                    elements: {
                      avatarBox: 'w-9 h-9',
                    },
                  }}
                />
              </SignedIn>

              {/* Mobile Menu Toggle */}
              <button
                className="md:hidden p-2 hover:bg-white/5 rounded-lg transition-colors"
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
                      'flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                      pathname === href
                        ? 'bg-pokemon-yellow/10 text-pokemon-yellow'
                        : 'text-muted-foreground hover:bg-white/5 hover:text-foreground',
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                    {badge && (
                      <span className="ml-auto px-1.5 py-0.5 text-[10px] font-bold rounded bg-pokemon-yellow/20 text-pokemon-yellow">
                        {badge}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  )
}
