'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, Home, Search, Sparkles, TrendingUp } from 'lucide-react'
import { clsx } from 'clsx'
import { useLanguage } from '@/lib/i18n/LanguageContext'

export function MobileBottomNav() {
  const pathname = usePathname()
  const { t } = useLanguage()

  const tabs = [
    { href: '/',         label: t.nav.market,     icon: Home },
    { href: '/cards',    label: t.nav.cards,       icon: BarChart3 },
    { href: '/sets',     label: t.nav.sets,        icon: TrendingUp },
    { href: '/ai',       label: t.nav.aiInsights,  icon: Sparkles },
  ]

  return (
    <nav className="mobile-bottom-nav">
      <div className="flex items-stretch h-16 px-2">
        {tabs.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href))
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-all duration-200 rounded-xl mx-0.5',
                isActive
                  ? 'text-pokemon-yellow'
                  : 'text-muted-foreground active:text-foreground',
              )}
            >
              <div className={clsx(
                'flex items-center justify-center w-9 h-7 rounded-xl transition-all duration-200',
                isActive && 'bg-pokemon-yellow/15',
              )}>
                <Icon className={clsx('transition-all duration-200', isActive ? 'w-5 h-5' : 'w-5 h-5')} />
              </div>
              <span>{label}</span>
              {isActive && (
                <span className="absolute bottom-0 w-8 h-0.5 bg-pokemon-yellow rounded-full" />
              )}
            </Link>
          )
        })}

        {/* Search tab */}
        <SearchTab label={t.nav.search} />
      </div>
    </nav>
  )
}

function SearchTab({ label }: { label: string }) {
  const handleOpen = () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }))
  }
  return (
    <button
      onClick={handleOpen}
      className="flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium text-muted-foreground active:text-foreground transition-all duration-200 rounded-xl mx-0.5"
    >
      <div className="flex items-center justify-center w-9 h-7 rounded-xl">
        <Search className="w-5 h-5" />
      </div>
      <span>{label}</span>
    </button>
  )
}
