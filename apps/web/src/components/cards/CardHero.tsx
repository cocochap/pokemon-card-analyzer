'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDownRight, ArrowUpRight, Expand, Star } from 'lucide-react'
import { clsx } from 'clsx'
import { formatCurrency, formatPercent } from '@/lib/formatters'
import { RarityBadge } from '@/components/ui/RarityBadge'
import { VariantBadge } from '@/components/ui/VariantBadge'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import { getCardName, getSetName } from '@/lib/i18n/cardLocale'

interface CardHeroProps {
  card: {
    id: string
    name: string
    number: string
    rarity: string
    variant: string
    imageLgUrl: string | null
    imageSmUrl: string | null
    illustrator: string | null
    set: { name: string; logoUrl: string | null }
    marketData?: {
      currentPrice: number
      priceChange24h: number
      priceChange7d: number
      priceChange30d: number
    } | null
  }
}

export function CardHero({ card }: CardHeroProps) {
  const { locale } = useLanguage()
  const [zoomed, setZoomed] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 20
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * -20
    setTilt({ x, y })
  }

  const handleMouseLeave = () => setTilt({ x: 0, y: 0 })

  const md = card.marketData
  const changes = md
    ? [
        { label: '24h', value: md.priceChange24h },
        { label: '7d', value: md.priceChange7d },
        { label: '30d', value: md.priceChange30d },
      ]
    : []

  return (
    <>
      <div className="flex flex-col items-center">
        {/* Card with 3D tilt */}
        <motion.div
          className="relative cursor-pointer select-none"
          style={{ perspective: 1000 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={() => setZoomed(true)}
          animate={{ rotateX: tilt.y, rotateY: tilt.x }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        >
          <div className="relative w-full max-w-xs mx-auto">
            {/* Glow effect behind card */}
            <div
              className="absolute -inset-4 rounded-2xl blur-3xl opacity-30 transition-opacity duration-300"
              style={{
                background: 'radial-gradient(ellipse, rgba(255,203,5,0.4) 0%, transparent 70%)',
              }}
            />

            {/* Card image */}
            <div
              className={clsx(
                'relative rounded-2xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.8)]',
                'border border-white/10',
                !loaded && 'aspect-[5/7] bg-white/5 animate-pulse',
              )}
            >
              {card.imageLgUrl && (
                <Image
                  src={card.imageLgUrl}
                  alt={getCardName(card as any, locale)}
                  width={600}
                  height={840}
                  className={clsx(
                    'w-full h-auto transition-opacity duration-500',
                    loaded ? 'opacity-100' : 'opacity-0',
                  )}
                  onLoad={() => setLoaded(true)}
                  priority
                />
              )}

              {/* Holographic overlay for holo cards */}
              {(card.variant === 'HOLO' || card.variant === 'REVERSE_HOLO') && (
                <div
                  className="absolute inset-0 opacity-20 pointer-events-none"
                  style={{
                    background: `
                      linear-gradient(
                        105deg,
                        transparent 40%,
                        rgba(255, 219, 112, 0.5) 50%,
                        rgba(132, 50, 255, 0.5) 55%,
                        transparent 60%
                      )
                    `,
                    mixBlendMode: 'color-dodge',
                  }}
                />
              )}
            </div>

            {/* Expand button */}
            <button
              className="absolute top-3 right-3 p-1.5 bg-background/80 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-background transition-colors"
              onClick={(e) => { e.stopPropagation(); setZoomed(true) }}
            >
              <Expand className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Card info */}
          <div className="mt-5 text-center space-y-2">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <RarityBadge rarity={card.rarity} />
              <VariantBadge variant={card.variant} />
            </div>

            <h1 className="text-2xl font-bold">{getCardName(card as any, locale)}</h1>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              {card.set.logoUrl && (
                <Image src={card.set.logoUrl} alt={getSetName(card.set, locale)} width={20} height={20} className="h-5 w-auto" />
              )}
              <span>{getSetName(card.set, locale)}</span>
              <span className="text-white/20">·</span>
              <span>#{card.number}</span>
            </div>

            {card.illustrator && (
              <p className="text-xs text-muted-foreground/60">Illus. {card.illustrator}</p>
            )}
          </div>
        </motion.div>

        {/* Price & Changes */}
        {md && (
          <div className="mt-5 w-full max-w-xs">
            <div className="glass-card p-4 text-center">
              <div className="text-3xl font-bold font-mono mb-2">
                {formatCurrency(md.currentPrice)}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {changes.map(({ label, value }) => (
                  <div key={label} className="text-center">
                    <div
                      className={clsx(
                        'flex items-center justify-center gap-0.5 text-sm font-medium',
                        value >= 0 ? 'text-market-bull' : 'text-market-bear',
                      )}
                    >
                      {value >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                      {Math.abs(value).toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen zoom modal */}
      <AnimatePresence>
        {zoomed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4"
            onClick={() => setZoomed(false)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {card.imageLgUrl && (
                <Image
                  src={card.imageLgUrl}
                  alt={getCardName(card as any, locale)}
                  width={600}
                  height={840}
                  className="w-full h-auto rounded-2xl shadow-2xl"
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
