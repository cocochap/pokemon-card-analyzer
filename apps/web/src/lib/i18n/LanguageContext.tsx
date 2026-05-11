'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { type Locale, translations } from './translations'

// Derive a shared type that works for both fr and en
type TranslationRecord = {
  [K in keyof typeof translations.fr]: (typeof translations.fr)[K]
}

interface LanguageContextValue {
  locale: Locale
  t: TranslationRecord
  setLocale: (l: Locale) => void
  isChoosingLanguage: boolean
  dismissModal: () => void
}

const LanguageContext = createContext<LanguageContextValue>({
  locale: 'fr',
  t: translations.fr as TranslationRecord,
  setLocale: () => {},
  isChoosingLanguage: false,
  dismissModal: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr')
  const [isChoosingLanguage, setIsChoosingLanguage] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('poke-lang') as Locale | null
    if (!saved) {
      setIsChoosingLanguage(true)
    } else {
      setLocaleState(saved)
    }
  }, [])

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem('poke-lang', l)
  }

  const dismissModal = () => setIsChoosingLanguage(false)

  if (!mounted) {
    return (
      <LanguageContext.Provider value={{ locale: 'fr', t: translations.fr, setLocale, isChoosingLanguage: false, dismissModal }}>
        {children}
      </LanguageContext.Provider>
    )
  }

  return (
    <LanguageContext.Provider value={{ locale, t: translations[locale] as TranslationRecord, setLocale, isChoosingLanguage, dismissModal }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}

export function useT() {
  return useContext(LanguageContext).t
}
