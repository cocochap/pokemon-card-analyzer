import type { Locale } from './translations'

/** Retourne le nom de la carte dans la langue demandée, avec fallback EN */
export function getCardName(card: { name: string; localeName?: Record<string, string> | unknown }, locale: Locale): string {
  const names = card.localeName as Record<string, string> | null | undefined
  if (!names || typeof names !== 'object') return card.name
  if (locale === 'fr' && names.fr) return names.fr
  if (names.en) return names.en
  return card.name
}

/** Noms des sets par externalId */
const SET_NAMES_FR: Record<string, string> = {
  'sv10.5w': 'Flamme Blanche',
  'sv10.5b': 'Flamme Noire',
}

export function getSetName(set: { name: string; externalId?: string }, locale: Locale): string {
  if (locale === 'fr' && set.externalId && SET_NAMES_FR[set.externalId]) {
    return SET_NAMES_FR[set.externalId]
  }
  return set.name
}
