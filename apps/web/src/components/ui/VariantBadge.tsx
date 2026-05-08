import { clsx } from 'clsx'

const VARIANT_CONFIG: Record<string, { label: string; className: string }> = {
  NORMAL: { label: 'Normal', className: 'bg-gray-500/20 text-gray-300 border-gray-500/30' },
  HOLO: { label: '✨ Holo', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  REVERSE_HOLO: { label: 'Reverse Holo', className: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  FIRST_EDITION: { label: '1st Edition', className: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  SHADOWLESS: { label: 'Shadowless', className: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
  PROMO: { label: 'Promo', className: 'bg-red-500/20 text-red-300 border-red-500/30' },
  UNLIMITED: { label: 'Unlimited', className: 'bg-gray-600/20 text-gray-400 border-gray-600/30' },
  STAMP: { label: 'Stamp', className: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
}

interface VariantBadgeProps {
  variant: string
  size?: 'xs' | 'sm' | 'md'
}

export function VariantBadge({ variant, size = 'sm' }: VariantBadgeProps) {
  if (variant === 'NORMAL') return null
  const config = VARIANT_CONFIG[variant] ?? { label: variant, className: 'bg-white/10 text-muted-foreground border-white/20' }

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
