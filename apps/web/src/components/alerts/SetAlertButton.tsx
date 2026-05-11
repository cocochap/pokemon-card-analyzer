'use client'

import { Bell } from 'lucide-react'
import { useT } from '@/lib/i18n/LanguageContext'

export function SetAlertButton({ cardId }: { cardId: string }) {
  const t = useT()
  return (
    <button className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 text-sm font-medium hover:bg-white/5 hover:border-pokemon-yellow/30 transition-colors">
      <Bell className="w-4 h-4" />
      {t.common.setAlert}
    </button>
  )
}
