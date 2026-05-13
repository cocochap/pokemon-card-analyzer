'use client'

import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, X } from 'lucide-react'
import { useAuth, useClerk } from '@clerk/nextjs'
import { useT } from '@/lib/i18n/LanguageContext'
import Link from 'next/link'

export function AddToPortfolioButton({ cardId }: { cardId: string }) {
  const t = useT()
  const { isSignedIn } = useAuth()
  const { openSignIn } = useClerk()
  const qc = useQueryClient()

  const [open, setOpen] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [price, setPrice] = useState('')
  const [success, setSuccess] = useState(false)
  const [limitError, setLimitError] = useState('')

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/portfolio/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId,
          quantity,
          purchasePrice: price ? parseFloat(price) : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.limitReached) throw Object.assign(new Error(data.error), { limitReached: true, upgradeUrl: data.upgradeUrl })
        throw new Error(data.error ?? 'Erreur')
      }
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['portfolio'] })
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
    setQuantity(1)
    setPrice('')
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-full px-4 py-2.5 rounded-xl bg-pokemon-yellow text-background font-bold text-sm hover:bg-yellow-300 transition-all hover:scale-105 shadow-glow"
      >
        + {t.common.addToPortfolio}
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
                <h3 className="font-bold text-white">Ajouter au portfolio</h3>
                <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white/70">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {success ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle2 className="w-10 h-10 text-green-400" />
                  <p className="font-semibold text-white">Carte ajoutée !</p>
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
                      <label className="text-xs text-white/50 mb-1.5 block">Quantité</label>
                      <div className="flex items-center gap-3">
                        <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center transition-colors"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                          −
                        </button>
                        <span className="text-xl font-bold text-white w-8 text-center">{quantity}</span>
                        <button onClick={() => setQuantity(q => q + 1)}
                          className="w-9 h-9 rounded-lg text-lg font-bold flex items-center justify-center transition-colors"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}>
                          +
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-white/50 mb-1.5 block">Prix d'achat (optionnel)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">€</span>
                        <input
                          type="number" min="0" step="0.01" placeholder="0.00"
                          value={price} onChange={e => setPrice(e.target.value)}
                          className="w-full pl-7 pr-3 py-2.5 rounded-xl text-sm text-white outline-none"
                          style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
                        />
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => mutate()}
                    disabled={isPending}
                    className="w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all hover:brightness-110"
                    style={{ background: '#FFCB05', color: '#0B1122' }}
                  >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : '+ Ajouter au portfolio'}
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
