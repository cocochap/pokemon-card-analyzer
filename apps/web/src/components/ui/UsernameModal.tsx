'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Loader2, User, X } from 'lucide-react'
import { clsx } from 'clsx'
import { useQueryClient } from '@tanstack/react-query'

interface Props {
  open: boolean
  onClose: () => void
  initialUsername?: string
  initialDisplayName?: string
  required?: boolean
}

const USERNAME_RE = /^[a-zA-Z0-9_-]{3,20}$/

function ModalContent({
  onClose, initialUsername, initialDisplayName, required,
}: Omit<Props, 'open'>) {
  const [username, setUsername]       = useState(initialUsername ?? '')
  const [displayName, setDisplayName] = useState(initialDisplayName ?? '')
  const [error, setError]             = useState('')
  const [loading, setLoading]         = useState(false)
  const [done, setDone]               = useState(false)
  const qc = useQueryClient()

  const usernameValid = USERNAME_RE.test(username)

  const save = async () => {
    setError('')
    if (!usernameValid) { setError('3 à 20 caractères — lettres, chiffres, _ ou -'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, displayName: displayName || username }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Erreur'); return }
      setDone(true)
      qc.invalidateQueries({ queryKey: ['user-me'] })
      setTimeout(() => { setDone(false); onClose() }, 900)
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,203,5,0.10)' }}>
            <User className="w-4 h-4 text-pokemon-yellow" />
          </div>
          <div>
            <h3 className="font-bold text-base">
              {initialUsername ? 'Modifier mon profil' : 'Choisis ton pseudo'}
            </h3>
            <p className="text-xs text-white/40">Visible dans le classement</p>
          </div>
        </div>
        {!required && (
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors p-1 -mr-1 -mt-1">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Nom affiché */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">Nom affiché</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder={username || 'Ex: DracaufeuMaster'}
          maxLength={30}
          className="w-full px-3 py-3 rounded-xl text-base bg-white/5 border border-white/10 text-white placeholder-white/25 focus:outline-none focus:border-pokemon-yellow/40 transition-colors"
        />
        <p className="text-xs text-white/30">Peut contenir des espaces et émojis (30 car. max)</p>
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-white/50 uppercase tracking-wide">
          Pseudo <span className="text-red-400">*</span>
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm select-none">@</span>
          <input
            type="text"
            value={username}
            onChange={e => { setUsername(e.target.value.toLowerCase()); setError('') }}
            placeholder="ton_pseudo"
            maxLength={20}
            autoCapitalize="none"
            autoCorrect="off"
            className={clsx(
              'w-full pl-7 pr-10 py-3 rounded-xl text-base bg-white/5 border text-white placeholder-white/25 focus:outline-none transition-colors font-mono',
              error              ? 'border-red-500/50 focus:border-red-500/70' :
              username && usernameValid ? 'border-green-500/40 focus:border-green-500/60' :
                               'border-white/10 focus:border-pokemon-yellow/40'
            )}
          />
          {username && usernameValid && (
            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-400 pointer-events-none" />
          )}
        </div>
        {error
          ? <p className="text-xs text-red-400">{error}</p>
          : <p className="text-xs text-white/30">3-20 car. — lettres, chiffres, _ ou -</p>
        }
      </div>

      {/* Button */}
      <button
        onClick={save}
        disabled={loading || !usernameValid || done}
        className={clsx(
          'w-full py-3.5 rounded-xl font-bold text-sm transition-all active:scale-[0.98]',
          done
            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
            : 'text-black hover:brightness-110 disabled:opacity-50'
        )}
        style={done ? {} : { background: 'linear-gradient(135deg, #FFCB05, #F59E0B)' }}
      >
        {done
          ? '✓ Enregistré !'
          : loading
          ? <Loader2 className="w-4 h-4 animate-spin mx-auto" />
          : 'Enregistrer'}
      </button>
    </div>
  )
}

export function UsernameModal(props: Props) {
  const { open, onClose, required } = props

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={required ? undefined : onClose}
          />

          {/* Desktop : modal centré */}
          <div className="hidden sm:flex absolute inset-0 items-center justify-center p-4">
            <motion.div
              className="relative w-full max-w-sm glass-card p-6"
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
            >
              <ModalContent {...props} />
            </motion.div>
          </div>

          {/* Mobile : bottom sheet */}
          <div className="sm:hidden absolute inset-x-0 bottom-0">
            <motion.div
              className="relative glass-card rounded-t-2xl rounded-b-none px-5 pt-3 pb-8"
              style={{ paddingBottom: 'max(2rem, env(safe-area-inset-bottom))' }}
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              {/* Handle */}
              <div className="w-10 h-1 rounded-full bg-white/20 mx-auto mb-5" />
              <ModalContent {...props} />
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  )
}
