'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Camera, Home, Sparkles, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { motion } from 'framer-motion'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const leftTabs = [
    { href: '/',      label: t.nav.market, icon: Home },
    { href: '/cards', label: t.nav.cards,  icon: BarChart3 },
  ]
  const rightTabs = [
    { href: '/sets', label: t.nav.sets,       icon: TrendingUp },
    { href: '/ai',   label: t.nav.aiInsights, icon: Sparkles },
  ]

  function Tab({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Home }) {
    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
    return (
      <Link
        href={href}
        className={clsx(
          'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all duration-150',
          isActive ? 'text-blue-700' : 'text-gray-500',
        )}
      >
        <div className={clsx(
          'flex items-center justify-center w-9 h-6 rounded-xl transition-all duration-150',
          isActive && 'bg-blue-100',
        )}>
          <Icon className="w-5 h-5" />
        </div>
        <span>{label}</span>
        {isActive && (
          <motion.div
            layoutId="mobile-tab-indicator"
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600"
          />
        )}
      </Link>
    )
  }

  const isScanActive = pathname === '/scan'

  return (
    <nav className="mobile-bottom-nav">
      <div className="flex items-center h-16 px-2">
        {leftTabs.map(tab => <Tab key={tab.href} {...tab} />)}

        {/* Center scan CTA */}
        <div className="flex flex-col items-center justify-center px-3 -mt-6">
          <Link
            href="/scan"
            className={clsx(
              'relative flex items-center justify-center w-14 h-14 rounded-2xl transition-all duration-200',
              isScanActive ? 'scale-95' : 'hover:scale-105 active:scale-95',
            )}
            style={{
              background: isScanActive
                ? 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 100%)'
                : 'linear-gradient(135deg, #1D4ED8 0%, #3B82F6 100%)',
              boxShadow: isScanActive
                ? '0 2px 12px rgba(29,78,216,0.35)'
                : '0 4px 20px rgba(59,130,246,0.40), 0 2px 8px rgba(29,78,216,0.25)',
            }}
          >
            <Camera className="w-6 h-6 text-white" />
            {!isScanActive && (
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-blue-400/40"
                animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
          </Link>
          <span className={clsx('text-[10px] font-bold mt-0.5', isScanActive ? 'text-blue-700' : 'text-blue-600')}>
            {t.nav.scan}
          </span>
        </div>

        {rightTabs.map(tab => <Tab key={tab.href} {...tab} />)}
      </div>
    </nav>
  )
}
