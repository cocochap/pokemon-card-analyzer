'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, X } from 'lucide-react'

interface UpgradeBannerProps {
  message: string
  className?: string
}

export function UpgradeBanner({ message, className = '' }: UpgradeBannerProps) {
  const [dismissed, setDismissed] = useState(false)
  const router = useRouter()

  if (dismissed) return null

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl ${className}`}>
      <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
      <p className="text-sm text-amber-800 flex-1">{message}</p>
      <button
        onClick={() => router.push('/pricing')}
        className="text-xs font-semibold text-amber-700 bg-amber-100 hover:bg-amber-200 px-3 py-1 rounded-lg transition-colors shrink-0"
      >
        Passer Premium
      </button>
      <button onClick={() => setDismissed(true)} className="text-amber-400 hover:text-amber-600">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
