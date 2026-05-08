import { clsx } from 'clsx'

const RARITY_CONFIG: Record<string, { label: string; className: string }> = {
  COMMON: { label: 'C', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  UNCOMMON: { label: 'U', className: 'bg-green-500/20 text-green-300 border-green-500/30' },
  RARE: { label: 'R', className: 'bg-pokemon-blue/20 text-pokemon-blue border-pokemon-blue/30' },
  RARE_HOLO: { label: 'Holo R', className: 'bg-pokemon-blue/20 text-pokemon-blue border-pokemon-blue/30' },
  RARE_HOLO_V: { label: 'V', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  RARE_HOLO_VMAX: { label: 'VMAX', className: 'bg-purple-600/20 text-purple-300 border-purple-600/30' },
  RARE_HOLO_VSTAR: { label: 'VSTAR', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  RARE_ULTRA: { label: 'Ultra', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  RARE_RAINBOW: { label: '🌈', className: 'bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-white border-white/20' },
  RARE_SECRET: { label: 'Secret', className: 'bg-yellow-500/20 text-pokemon-yellow border-pokemon-yellow/30' },
  ILLUSTRATION_RARE: { label: 'IR', className: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
  SPECIAL_ILLUSTRATION_RARE: { label: 'SIR', className: 'bg-rose-500/20 text-rose-300 border-rose-500/30' },
  HYPER_RARE: { label: 'HR', className: 'bg-yellow-400/20 text-yellow-300 border-yellow-400/30' },
  CROWN_RARE: { label: '♛', className: 'bg-pokemon-yellow/20 text-pokemon-yellow border-pokemon-yellow/30 animate-pulse-glow' },
  PROMO: { label: 'Promo', className: 'bg-pokemon-red/20 text-red-400 border-red-400/30' },
  AMAZING_RARE: { label: 'AR', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  LEGEND: { label: 'Legend', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
}

interface RarityBadgeProps {
  rarity: string
  size?: 'xs' | 'sm' | 'md'
}

export function RarityBadge({ rarity, size = 'sm' }: RarityBadgeProps) {
  const config = RARITY_CONFIG[rarity] ?? { label: rarity, className: 'bg-white/10 text-muted-foreground border-white/20' }

  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full border',
        size === 'xs' && 'px-1.5 py-0.5 text-[10px]',
        size === 'sm' && 'px-2 py-0.5 text-xs',
        size === 'md' && 'px-3 py-1 text-sm',
        config.className,
      )}
    >
      {config.label}
    </span>
  )
}
