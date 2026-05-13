'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellRing, CheckCircle2, Loader2, Lock, X } from 'lucide-react'
import { useAuth, useClerk } from '@clerk/nextjs'
import Link from 'next/link'
import { useT } from '@/lib/i18n/LanguageContext'
import { useUserTier } from '@/lib/useUserTier'

type AlertType = 'PRICE_ABOVE' | 'PRICE_BELOW' | 'PRICE_CHANGE_PERCENT'

const ALERT_TYPES: { key: AlertType; label: string; placeholder: string; unit: string }[] = [
  { key: 'PRICE_ABOVE',          label: 'Prix dépasse',    placeholder: '25.00', unit: '€' },
  { key: 'PRICE_BELOW',          label: 'Prix passe sous', placeholder: '10.00', unit: '€' },
  { key: 'PRICE_CHANGE_PERCENT', label: 'Variation de',    placeholder: '15',    unit: '%' },
]

export function SetAlertButton({ cardId }: { cardId: string }) {
  const t = useT()
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const { isPremium } = useUserTier()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<AlertType>('PRICE_ABOVE')
  const [value, setValue] = useState('')
  const [success, setSuccess] = useState(false)
  const [limitError, setLimitError] = useState('')

  const selectedType = ALERT_TYPES.find(a => a.key === type)!

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const isPercent = type === 'PRICE_CHANGE_PERCENT'
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          type,
          ...(isPercent
            ? { targetPercent: parseFloat(value) }
            : { targetValue: parseFloat(value) }),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.limitReached) throw Object.assign(new Error(data.error), { limitReached: true })
        throw new Error(data.error ?? 'Erreur')
      }
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] })
      setSuccess(true)
      setTimeout(() => { setOpen(false); setSuccess(false) }, 1500)
    },
    onError: (err: any) => {
      if (err.limitReached) setLimitError(err.message)
    },
  })

  const handleOpen = () => {
    if (!isSignedIn) { openSignIn(); return }
    setOpen(true)
    setSuccess(false)
    setLimitError('')
    setValue('')
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-white/5 hover:border-pokemon-yellow/30 transition-colors"
        style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.7)' }}
      >
        <Bell className="w-4 h-4" />
        {t.common.setAlert}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl p-6 space-y-5"
              style={{ background: '#0B1122', border: '1px solid rgba(255,203,5,0.2)' }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BellRing className="w-5 h-5 text-pokemon-yellow" />
                  <h3 className="font-bold text-white">Créer une alerte</h3>
                </div>
                <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* FREE tier blocker */}
              {!isPremium ? (
                <div className="text-center space-y-4 py-2">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
                    style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.25)' }}>
                    <Lock className="w-5 h-5 text-pokemon-yellow" />
                  </div>
                  <div>
                    <p className="font-semibold text-white mb-1">Alertes réservées aux abonnés</p>
                    <p className="text-sm text-white/50">Passez à Premium pour créer jusqu'à 10 alertes de prix.</p>
                  </div>
                  <Link href="/pricing" onClick={() => setOpen(false)}
                    className="inline-block px-5 py-2.5 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.3)', color: '#FFCB05' }}>
                    Voir les offres →
                  </Link>
                </div>
              ) : success ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <p className="font-semibold text-white">Alerte créée !</p>
                </div>
              ) : limitError ? (
                <div className="text-center space-y-3 py-2">
                  <p className="text-sm text-white/70">{limitError}</p>
                  <Link href="/pricing" onClick={() => setOpen(false)}
                    className="inline-block px-4 py-2 rounded-xl text-sm font-bold"
                    style={{ background: 'rgba(255,203,5,0.10)', border: '1px solid rgba(255,203,5,0.3)', color: '#FFCB05' }}>
                    Voir les offres →
                  </Link>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Type d'alerte</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {ALERT_TYPES.map(a => (
                          <button key={a.key} onClick={() => setType(a.key)}
                            className="px-3 py-2 rounded-xl text-sm text-left transition-all"
                            style={type === a.key
                              ? { background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.35)', color: '#FFCB05' }
                              : { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)' }}>
                            {a.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Valeur cible</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                          {selectedType.unit}
                        </span>
                        <input
                          type="number" min="0" step="0.01"
                          placeholder={selectedType.placeholder}
                          value={value} onChange={e => setValue(e.target.value)}
                          className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => mutate()}
                    disabled={isPending || !value}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110 disabled:opacity-50"
                    style={{ background: 'rgba(255,203,5,0.12)', border: '1px solid rgba(255,203,5,0.3)', color: '#FFCB05' }}
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Bell className="w-4 h-4" />Créer l'alerte</>}
                  </button>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
