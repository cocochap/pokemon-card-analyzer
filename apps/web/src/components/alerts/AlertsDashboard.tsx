'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bell,
  BellOff,
  Check,
  Plus,
  Trash2,
  TrendingDown,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { clsx } from 'clsx'
import Image from 'next/image'
import Link from 'next/link'
import { api } from '@/lib/api'
import { formatCurrency, formatRelativeTime } from '@/lib/formatters'
import { CreateAlertModal } from './CreateAlertModal'
import toast from 'react-hot-toast'

const ALERT_TYPE_CONFIG = {
  PRICE_ABOVE: { label: 'Price Above', icon: TrendingUp, color: 'text-market-bull' },
  PRICE_BELOW: { label: 'Price Below', icon: TrendingDown, color: 'text-market-bear' },
  PRICE_CHANGE_PERCENT: { label: 'Price Change', icon: Zap, color: 'text-pokemon-yellow' },
  VOLUME_SPIKE: { label: 'Volume Spike', icon: Zap, color: 'text-pokemon-blue' },
  AI_SIGNAL: { label: 'AI Signal', icon: Zap, color: 'text-purple-400' },
}

export function AlertsDashboard() {
  const [showCreate, setShowCreate] = useState(false)
  const queryClient = useQueryClient()

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['alerts'],
    queryFn: api.alerts.getAll,
    staleTime: 30_000,
    refetchInterval: 60_000,
  })

  const deleteMutation = useMutation({
    mutationFn: api.alerts.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts'] })
      toast.success('Alert deleted')
    },
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.alerts.update(id, { status }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  })

  const activeAlerts = alerts?.filter((a: any) => a.status === 'ACTIVE') ?? []
  const triggeredAlerts = alerts?.filter((a: any) => a.status === 'TRIGGERED') ?? []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Price Alerts</h1>
          <p className="text-muted-foreground text-sm">
            {activeAlerts.length} active · {triggeredAlerts.length} triggered
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-pokemon-yellow text-background font-semibold rounded-xl text-sm hover:bg-pokemon-yellow/90 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Create Alert
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active', value: activeAlerts.length, color: 'text-market-bull', bg: 'bg-market-bull/10' },
          { label: 'Triggered', value: triggeredAlerts.length, color: 'text-pokemon-yellow', bg: 'bg-pokemon-yellow/10' },
          { label: 'Total', value: alerts?.length ?? 0, color: 'text-foreground', bg: 'bg-white/5' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`glass-card p-4 ${bg}`}>
            <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
            <div className="text-xs text-muted-foreground mt-1">{label} alerts</div>
          </div>
        ))}
      </div>

      {/* Alerts List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array(4).fill(null).map((_, i) => (
            <div key={i} className="skeleton h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : alerts?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center glass-card">
          <Bell className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">No alerts yet</h3>
          <p className="text-muted-foreground text-sm max-w-sm mb-6">
            Create price alerts to be notified when your favorite cards reach your target price.
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-pokemon-yellow text-background font-semibold rounded-lg text-sm"
          >
            Create your first alert
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {alerts.map((alert: any, i: number) => {
              const typeConfig = ALERT_TYPE_CONFIG[alert.type as keyof typeof ALERT_TYPE_CONFIG]
              const isActive = alert.status === 'ACTIVE'
              const isTriggered = alert.status === 'TRIGGERED'

              return (
                <motion.div
                  key={alert.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: i * 0.03 }}
                  className={clsx(
                    'glass-card p-4 flex items-center gap-4',
                    isTriggered && 'border-pokemon-yellow/30 bg-pokemon-yellow/5',
                  )}
                >
                  {/* Card thumbnail */}
                  <div className="w-10 h-14 rounded-lg overflow-hidden bg-white/5 shrink-0">
                    {alert.card?.imageSmUrl && (
                      <Image
                        src={alert.card.imageSmUrl}
                        alt={alert.card.name}
                        width={40}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/cards/${alert.cardId}`}
                      className="font-medium hover:text-pokemon-yellow transition-colors"
                    >
                      {alert.card?.name ?? 'Unknown Card'}
                    </Link>
                    <div className="flex items-center gap-2 mt-1">
                      {typeConfig && (
                        <span className={clsx('flex items-center gap-1 text-xs', typeConfig.color)}>
                          <typeConfig.icon className="w-3 h-3" />
                          {typeConfig.label}
                        </span>
                      )}
                      {alert.targetValue && (
                        <span className="text-xs text-muted-foreground">
                          → {formatCurrency(alert.targetValue)}
                        </span>
                      )}
                      {alert.targetPercent && (
                        <span className="text-xs text-muted-foreground">
                          → {(alert.targetPercent * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                    {alert.triggeredAt && (
                      <div className="text-xs text-pokemon-yellow mt-1">
                        Triggered {formatRelativeTime(alert.triggeredAt)}
                      </div>
                    )}
                  </div>

                  {/* Status badge */}
                  <div className={clsx(
                    'px-2 py-1 rounded-full text-xs font-medium',
                    isActive ? 'bg-market-bull/10 text-market-bull' :
                    isTriggered ? 'bg-pokemon-yellow/10 text-pokemon-yellow' :
                    'bg-white/10 text-muted-foreground',
                  )}>
                    {isTriggered ? '🔔 Triggered' : alert.status.toLowerCase()}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: alert.id,
                          status: isActive ? 'PAUSED' : 'ACTIVE',
                        })
                      }
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      title={isActive ? 'Pause alert' : 'Activate alert'}
                    >
                      {isActive ? (
                        <BellOff className="w-4 h-4 text-muted-foreground" />
                      ) : (
                        <Bell className="w-4 h-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(alert.id)}
                      className="p-2 hover:bg-market-bear/20 rounded-lg transition-colors group"
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground group-hover:text-market-bear transition-colors" />
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <CreateAlertModal open={showCreate} onClose={() => setShowCreate(false)} />
    </div>
  )
}
