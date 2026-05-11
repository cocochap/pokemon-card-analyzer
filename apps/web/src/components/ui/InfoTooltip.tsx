'use client'

import { useState } from 'react'
import { Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

interface InfoTooltipProps {
  text: string
  side?: 'top' | 'bottom'
  className?: string
}

export function InfoTooltip({ text, side = 'top', className }: InfoTooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <span
      className={clsx('relative inline-flex items-center', className)}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onFocus={() => setShow(true)}
      onBlur={() => setShow(false)}
    >
      <Info className="w-3.5 h-3.5 text-muted-foreground/50 cursor-help hover:text-pokemon-yellow/70 transition-colors" />

      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: side === 'top' ? 6 : -6, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: side === 'top' ? 6 : -6, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={clsx(
              'absolute z-50 w-56 p-3 rounded-xl text-xs leading-relaxed pointer-events-none',
              'bg-[#080d14] border border-white/15 shadow-xl text-muted-foreground',
              'left-1/2 -translate-x-1/2',
              side === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            )}
          >
            {/* Arrow */}
            <div className={clsx(
              'absolute left-1/2 -translate-x-1/2 w-2.5 h-2.5 rotate-45 bg-[#080d14] border border-white/15',
              side === 'top'
                ? 'bottom-0 translate-y-1/2 border-t-0 border-l-0'
                : 'top-0 -translate-y-1/2 border-b-0 border-r-0',
            )} />
            {text}
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  )
}
