'use client'

import { motion } from 'framer-motion'
import { Shield } from 'lucide-react'
import { useT, useLanguage } from '@/lib/i18n/LanguageContext'

// Population data is simulated — real integration requires PSA API access
const SIMULATED_POP = [
  { grade: 10, pop: 0, label: 'PSA 10 — Gem Mint' },
  { grade: 9,  pop: 0, label: 'PSA 9 — Mint' },
  { grade: 8,  pop: 0, label: 'PSA 8 — NM-MT' },
  { grade: 7,  pop: 0, label: 'PSA 7 — NM' },
]

export function CardPsaPopulation({ cardId }: { cardId: string }) {
  const t = useT()
  const { locale } = useLanguage()

  return (
    <div className="glass-card p-5 mt-4">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-9 h-9 bg-blue-400/10 rounded-xl flex items-center justify-center">
          <Shield className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">PSA Population</h3>
          <p className="text-xs text-muted-foreground">{locale === 'fr' ? 'Données de certification' : 'Certification data'}</p>
        </div>
      </div>

      <div className="space-y-2">
        {SIMULATED_POP.map(({ grade, label }) => (
          <div key={grade} className="flex items-center gap-3">
            <div className="text-xs font-bold text-muted-foreground w-6 text-center">{grade}</div>
            <div className="flex-1 h-5 bg-white/5 rounded-full overflow-hidden border border-white/10">
              <div className="h-full bg-gradient-to-r from-blue-500/30 to-blue-300/20 rounded-full flex items-center justify-end pr-2" style={{ width: '0%' }}>
              </div>
            </div>
            <div className="text-xs text-muted-foreground w-8 text-right font-mono">N/A</div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground/50 mt-3 text-center">
        {locale === 'fr' ? 'Population PSA non disponible — accès API PSA requis' : 'PSA population unavailable — PSA API access required'}
      </p>
    </div>
  )
}
