'use client'

import { clsx } from 'clsx'
import { useT } from '@/lib/i18n/LanguageContext'

const RARITY_STYLE: Record<string, { short: string; className: string }> = {
  COMMON:                    { short: 'C',     className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  UNCOMMON:                  { short: 'U',     className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  RARE:                      { short: 'R',     className: 'bg-pokemon-blue/20 text-pokemon-blue border-pokemon-blue/30' },
  RARE_HOLO:                 { short: 'Holo',  className: 'bg-pokemon-blue/20 text-pokemon-blue border-pokemon-blue/30' },
  RARE_HOLO_EX:              { short: 'EX',    className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  RARE_HOLO_GX:              { short: 'GX',    className: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
  RARE_HOLO_V:               { short: 'V',     className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  RARE_HOLO_VMAX:            { short: 'VMAX',  className: 'bg-purple-600/20 text-purple-300 border-purple-600/30' },
  RARE_HOLO_VSTAR:           { short: 'VSTAR', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  RARE_ULTRA:                { short: 'Ultra', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  RARE_RAINBOW:              { short: '🌈',    className: 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border-white/20' },
  RARE_SECRET:               { short: 'Secret',className: 'bg-yellow-500/20 text-pokemon-yellow border-pokemon-yellow/30' },
  ILLUSTRATION_RARE:         { short: 'IR',    className: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  SPECIAL_ILLUSTRATION_RARE: { short: 'SIR',   className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  HYPER_RARE:                { short: 'HR',    className: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30' },
  CROWN_RARE:                { short: '♛',     className: 'bg-pokemon-yellow/20 text-pokemon-yellow border-pokemon-yellow/30' },
  PROMO:                     { short: 'Promo', className: 'bg-red-500/20 text-red-400 border-red-400/30' },
  AMAZING_RARE:              { short: 'AR',    className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  LEGEND:                    { short: 'LEG',   className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  RARE_SHINY:                { short: '✦',     className: 'bg-blue-400/20 text-blue-300 border-blue-400/30' },
  RARE_SHINY_GX:             { short: '✦GX',   className: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' },
}

interface RarityBadgeProps {
  rarity: string
  size?: 'xs' | 'sm' | 'md'
  full?: boolean  // Show full French/English name instead of short code
}

export function RarityBadge({ rarity, size = 'sm', full = false }: RarityBadgeProps) {
  const t = useT()
  const style = RARITY_STYLE[rarity]
  const className = style?.className ?? 'bg-white/10 text-muted-foreground border-white/20'

  // Full name from translations (fr or en)
  const fullName = t.rarity[rarity as keyof typeof t.rarity]
  const label = full && fullName ? fullName : (style?.short ?? rarity)

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border',
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        className,
      )}
    >
      {label}
    </span>
  )
}
