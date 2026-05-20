'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Loader2, Medal, Trophy, Lock } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { formatCurrency } from '@/lib/formatters'
import { clsx } from 'clsx'

interface LeaderboardUser {
  id: string
  displayName: string
  username: string | null
  avatarUrl: string | null
}

interface Entry {
  rank: number
  totalValue: number
  cardCount: number
  computedAt: string
  user: LeaderboardUser
}

// ── Podium top 3 ──────────────────────────────────────────────────────────────
function PodiumCard({ entry, height }: { entry: Entry; height: string }) {
  const colors: Record<number, { accent: string; bg: string; ring: string }> = {
    1: { accent: '#FFCB05', bg: 'rgba(255,203,5,0.10)', ring: 'rgba(255,203,5,0.35)' },
    2: { accent: '#C0C0C0', bg: 'rgba(192,192,192,0.08)', ring: 'rgba(192,192,192,0.25)' },
    3: { accent: '#CD7F32', bg: 'rgba(205,127,50,0.08)', ring: 'rgba(205,127,50,0.25)' },
  }
  const c = colors[entry.rank]

  const Icon = entry.rank === 1 ? Crown : entry.rank === 2 ? Trophy : Medal

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: (3 - entry.rank) * 0.1 + 0.1 }}
      className="flex flex-col items-center gap-2"
      style={{ flex: '1' }}
    >
      {/* Avatar */}
      <div className="relative">
        {entry.user.avatarUrl ? (
          <Image
            src={entry.user.avatarUrl}
            alt={entry.user.displayName}
            width={56} height={56}
            className="rounded-full object-cover"
            style={{ border: `2px solid ${c.ring}`, boxShadow: `0 0 16px ${c.ring}` }}
          />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black"
            style={{ background: c.bg, border: `2px solid ${c.ring}`, color: c.accent }}>
            {entry.user.displayName[0]?.toUpperCase()}
          </div>
        )}
        <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: c.accent }}>
          <span className="text-xs font-black text-black">{entry.rank}</span>
        </div>
      </div>

      {/* Podium block */}
      <div
        className="w-full flex flex-col items-center justify-end rounded-t-2xl px-3 pb-4 pt-3 gap-1"
        style={{ height, background: c.bg, border: `1px solid ${c.ring}` }}
      >
        <Icon className="w-5 h-5 mb-1" style={{ color: c.accent }} />
        <p className="text-sm font-bold text-center truncate w-full text-center" style={{ color: c.accent }}>
          {entry.user.displayName}
        </p>
        <p className="text-base font-black font-mono">{formatCurrency(entry.totalValue)}</p>
        <p className="text-xs text-white/40">{entry.cardCount} cartes</p>
      </div>
    </motion.div>
  )
}

// ── Opt-in banner ─────────────────────────────────────────────────────────────
function OptInBanner() {
  return (
    <Link href="/portfolio?tab=settings" className="block">
      <div className="glass-card p-4 flex items-center gap-3 hover:border-pokemon-yellow/30 transition-colors cursor-pointer"
        style={{ borderColor: 'rgba(255,203,5,0.15)' }}>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: 'rgba(255,203,5,0.08)' }}>
          <Trophy className="w-4 h-4 text-pokemon-yellow" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-white/80">Rejoindre le classement</p>
          <p className="text-xs text-white/40">Rends ta collection publique dans les paramètres portfolio</p>
        </div>
        <span className="text-xs text-pokemon-yellow/70 font-semibold shrink-0">Paramètres →</span>
      </div>
    </Link>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function LeaderboardTable() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/leaderboard')
      .then(r => r.json())
      .then(d => {
        setEntries(d.entries ?? [])
        setUpdatedAt(d.updatedAt ?? null)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 text-pokemon-yellow animate-spin" />
      </div>
    )
  }

  if (entries.length === 0) {
    return (
      <div className="space-y-4">
        <div className="glass-card p-10 text-center">
          <Trophy className="w-10 h-10 text-white/15 mx-auto mb-3" />
          <p className="text-sm font-semibold text-white/50 mb-1">Classement vide</p>
          <p className="text-xs text-white/30">Le classement est calculé chaque nuit à partir des collections publiques.</p>
        </div>
        <OptInBanner />
      </div>
    )
  }

  const top3 = entries.slice(0, 3)
  const rest  = entries.slice(3)

  // Ordre podium : 2 - 1 - 3
  const podiumOrder = [
    top3.find(e => e.rank === 2),
    top3.find(e => e.rank === 1),
    top3.find(e => e.rank === 3),
  ].filter(Boolean) as Entry[]

  return (
    <div className="space-y-6">

      {/* Podium */}
      {top3.length > 0 && (
        <div className="flex items-end gap-3 px-2">
          {podiumOrder.map(e => (
            <PodiumCard
              key={e.rank}
              entry={e}
              height={e.rank === 1 ? '160px' : e.rank === 2 ? '130px' : '110px'}
            />
          ))}
        </div>
      )}

      {/* Anti-cheat notice */}
      <div className="flex items-start gap-2 px-1">
        <Lock className="w-3.5 h-3.5 text-white/25 shrink-0 mt-0.5" />
        <p className="text-xs text-white/25">
          Seules les cartes présentes depuis ≥ 7 jours comptent. Prix CardMarket exclusivement.
        </p>
      </div>

      {/* Table rank 4+ */}
      {rest.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="divide-y divide-white/[0.06]">
            {rest.map((e, i) => (
              <motion.div
                key={e.user.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Rank */}
                <span className="text-sm font-mono text-white/30 w-7 text-right shrink-0">
                  {e.rank}
                </span>

                {/* Avatar */}
                {e.user.avatarUrl ? (
                  <Image
                    src={e.user.avatarUrl}
                    alt={e.user.displayName}
                    width={32} height={32}
                    className="rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ background: 'rgba(255,255,255,0.07)' }}>
                    {e.user.displayName[0]?.toUpperCase()}
                  </div>
                )}

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={clsx('text-sm font-semibold truncate', e.rank <= 10 ? 'text-white/90' : 'text-white/65')}>
                    {e.user.displayName}
                  </p>
                  {e.user.username && (
                    <p className="text-xs text-white/30 truncate">@{e.user.username}</p>
                  )}
                </div>

                {/* Cards */}
                <span className="text-xs text-white/35 shrink-0 hidden sm:block">
                  {e.cardCount} cartes
                </span>

                {/* Value */}
                <span className="text-sm font-bold font-mono text-white/80 shrink-0">
                  {formatCurrency(e.totalValue)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Opt-in */}
      <OptInBanner />

      {/* Last update */}
      {updatedAt && (
        <p className="text-xs text-white/20 text-center">
          Dernière mise à jour : {new Date(updatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </div>
  )
}
