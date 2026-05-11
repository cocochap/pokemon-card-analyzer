'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useLanguage } from '@/lib/i18n/LanguageContext'
import type { Locale } from '@/lib/i18n/translations'

export function LanguageModal() {
  const { isChoosingLanguage, setLocale, dismissModal, t } = useLanguage()

  const choose = (l: Locale) => {
    setLocale(l)
    dismissModal()
  }

  return (
    <AnimatePresence>
      {isChoosingLanguage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="relative w-full max-w-md"
          >
            {/* Pokéball deco */}
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-32 h-32 opacity-20 pointer-events-none">
              <div className="w-full h-full rounded-full border-4 border-white relative overflow-hidden">
                <div className="absolute inset-0 top-1/2 bg-pokemon-red" />
                <div className="absolute inset-0 bottom-1/2 bg-white" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white border-4 border-white z-10 shadow-lg" />
                <div className="absolute top-1/2 left-0 right-0 h-1 bg-black" />
              </div>
            </div>

            <div className="bg-[#0d1117] border border-white/15 rounded-2xl overflow-hidden shadow-2xl">
              {/* Header */}
              <div className="px-8 pt-10 pb-6 text-center relative">
                {/* Stars deco */}
                <div className="absolute top-4 left-6 text-pokemon-yellow text-2xl opacity-60">✦</div>
                <div className="absolute top-6 right-8 text-pokemon-yellow text-sm opacity-40">✦</div>

                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-pokemon-yellow/15 border border-pokemon-yellow/30 rounded-full mb-4">
                  <span className="text-pokemon-yellow text-lg">⚡</span>
                  <span className="text-pokemon-yellow font-bold text-sm">PokeMarket</span>
                </div>

                <h2 className="text-2xl font-bold text-white mb-2">{t.langModal.title}</h2>
                <p className="text-sm text-white/50">{t.langModal.subtitle}</p>
              </div>

              {/* Language buttons */}
              <div className="px-6 pb-8 grid grid-cols-2 gap-4">
                <button
                  onClick={() => choose('fr')}
                  className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-blue-500/10 hover:border-blue-400/40 transition-all duration-200 hover:scale-105"
                >
                  <span className="text-4xl">🇫🇷</span>
                  <div className="text-center">
                    <div className="font-bold text-white text-lg">Français</div>
                    <div className="text-xs text-white/50 mt-0.5">Continuer en français</div>
                  </div>
                </button>

                <button
                  onClick={() => choose('en')}
                  className="group flex flex-col items-center gap-3 p-6 rounded-2xl bg-white/5 border border-white/10 hover:bg-red-500/10 hover:border-red-400/40 transition-all duration-200 hover:scale-105"
                >
                  <span className="text-4xl">🇬🇧</span>
                  <div className="text-center">
                    <div className="font-bold text-white text-lg">English</div>
                    <div className="text-xs text-white/50 mt-0.5">Continue in English</div>
                  </div>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
