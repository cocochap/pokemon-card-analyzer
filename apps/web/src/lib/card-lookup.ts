/**
 * Shared card lookup logic used by both /api/ai/scan and /api/ai/deal.
 * Single source of truth for card identification from AI hints.
 */

import { prisma } from '@/lib/db/prisma'

export interface CardHint {
  cardName: string
  englishName: string
  cardNumber: string
  setName: string
  setId: string
}

// ── Utilitaires ───────────────────────────────────────────────────────────────

export function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[''`]/g, '').replace(/\s+/g, ' ').trim()
}

export function extractTotal(cardNumber: string): number | null {
  const raw = (cardNumber ?? '').split('/')[1]?.trim()
  if (!raw || /[A-Za-z]/.test(raw)) return null
  const n = parseInt(raw, 10)
  return n > 0 && n <= 500 ? n : null
}

export function numberVariants(raw: string): string[] {
  const base = raw.split('/')[0].trim()
  if (!base) return []
  const vs = new Set<string>([base])
  const noZeros = base.replace(/^0+(?=[0-9])/, '')
  vs.add(noZeros)
  if (/^\d+$/.test(noZeros)) { vs.add(noZeros.padStart(2, '0')); vs.add(noZeros.padStart(3, '0')) }
  const alpha = base.match(/^([A-Z]+)(\d+)$/i)
  if (alpha) {
    const [, pfx, dig] = alpha
    const clean = dig.replace(/^0+(?=[0-9])/, '')
    vs.add(`${pfx.toUpperCase()}${dig}`)
    vs.add(`${pfx.toUpperCase()}${clean}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(2, '0')}`)
    vs.add(`${pfx.toUpperCase()}${clean.padStart(3, '0')}`)
    vs.add(clean); vs.add(clean.padStart(3, '0'))
  }
  return [...vs].filter(Boolean)
}

export function numberSetHints(num: string): string[] {
  const n = num.toUpperCase()
  if (n.match(/^SV\d/))   return ['swsh45sv', 'swsh4sv', 'swsh35sv', 'pgo', 'swsh1']
  if (n.match(/^TG\d/))   return ['swsh9', 'swsh10', 'swsh11', 'swsh12', 'swsh12pt5']
  if (n.match(/^GG\d/))   return ['sv1', 'sv2', 'sv3', 'sv3pt5', 'sv4']
  if (n.match(/^SWSH\d/)) return ['swshp']
  if (n.match(/^SM\d/))   return ['smp']
  if (n.match(/^XY\d/))   return ['xyp']
  return []
}

export function matchScore(card: any, hint: CardHint, setId: string): number {
  let s = 0
  const nums     = numberVariants(hint.cardNumber)
  const cn       = (card.number ?? '').split('/')[0].trim()
  const hintNorm = normalizeName(hint.englishName || hint.cardName)
  const cardNorm = normalizeName(card.name ?? '')
  const sid      = setId || hint.setId

  if (hint.cardNumber && nums.includes(cn))                                                       s += 50
  else if (hint.cardNumber && cn.replace(/^[A-Z]+/i, '') === hint.cardNumber.replace(/^[A-Z]+/i, '')) s += 20
  if (hintNorm && cardNorm === hintNorm)                                                           s += 40
  else if (hintNorm && cardNorm.startsWith(hintNorm.split(' ')[0]))                               s += 15
  if (sid && card.set?.externalId === sid)                                                         s += 30

  return s
}

// ── Résolution du set ─────────────────────────────────────────────────────────

const SET_NAME_MAP: Record<string, string> = {
  '151': 'sv3pt5', 'flammes obsidiennes': 'sv3', 'obsidian flames': 'sv3',
  'mascarade crepusculaire': 'sv6', 'twilight masquerade': 'sv6',
  'forces temporelles': 'sv5', 'temporal forces': 'sv5',
  'evolution celeste': 'swsh7', 'evolving skies': 'swsh7',
  'astres radieux': 'swsh10', 'brilliant stars': 'swsh9',
  'couronne zenith': 'swsh12pt5', 'crown zenith': 'swsh12pt5',
  'origine perdue': 'swsh11', 'lost origin': 'swsh11',
  'epee et bouclier': 'swsh1', 'sword shield': 'swsh1',
  'celebrations': 'cel25', 'base': 'base1', 'jungle': 'jungle', 'fossil': 'fossil',
  'scarlet violet': 'sv1', 'ecarlate et violet': 'sv1',
  'paldea evolved': 'sv2',
  'pokemon go': 'pgo', 'paldean fates': 'sv4pt5', 'destinees de paldea': 'sv4pt5',
  'shrouded fable': 'sv6pt5', 'fable nebuleuse': 'sv6pt5',
  'stellar crown': 'sv7', 'couronne stellaire': 'sv7',
  'surging sparks': 'sv8', 'etincelles dechainantes': 'sv8',
  'prismatic evolutions': 'sv8pt5', 'evolutions prismatiques': 'sv8pt5',
  'journey together': 'sv9', 'voyage ensemble': 'sv9',
  'paradox rift': 'sv4', 'faille paradoxe': 'sv4',
  'silver tempest': 'swsh12', 'tempete argentee': 'swsh12',
  'astral radiance': 'swsh10',
  'fusion strike': 'swsh8', 'frappe attaque': 'swsh8',
  'chilling reign': 'swsh6', 'reign of ice': 'swsh6',
  'battle styles': 'swsh5', 'styles de combat': 'swsh5',
  'vivid voltage': 'swsh4', 'voltage eclatant': 'swsh4',
  'darkness ablaze': 'swsh3', 'tenebres embrasees': 'swsh3',
  'rebel clash': 'swsh2', 'clash rebelle': 'swsh2',
  'champion path': 'swsh35',
  'shining fates': 'swsh45',
}

export async function resolveSetId(hint: CardHint): Promise<string> {
  // 1. Total imprimé → set unique
  const total = extractTotal(hint.cardNumber)
  if (total) {
    const sets = await prisma.pokemonSet.findMany({
      where: { OR: [{ printedTotal: total }, { totalCards: total }] },
      select: { externalId: true }, orderBy: { releaseDate: 'desc' }, take: 3,
    })
    if (sets.length === 1) return sets[0].externalId
  }

  // 2. setId fourni directement
  if (hint.setId) return hint.setId

  // 3. Nom du set → map statique
  if (hint.setName) {
    const norm = normalizeName(hint.setName)
    for (const [k, v] of Object.entries(SET_NAME_MAP)) {
      if (norm.includes(k) || k.includes(norm.substring(0, 8))) return v
    }
    // 4. DB fallback
    const dbSet = await prisma.pokemonSet.findFirst({
      where: { name: { contains: hint.setName.substring(0, 12), mode: 'insensitive' } },
      select: { externalId: true }, orderBy: { releaseDate: 'desc' },
    })
    if (dbSet?.externalId) return dbSet.externalId
  }

  return ''
}

// ── DB select ─────────────────────────────────────────────────────────────────

export const CARD_SELECT = {
  id: true, name: true, number: true, rarity: true, imageSmUrl: true, imageLgUrl: true,
  set: { select: { name: true, externalId: true, releaseDate: true, logoUrl: true } },
  prices: { where: { source: 'cardmarket' }, orderBy: { fetchedAt: 'desc' } as any, take: 1, select: { market: true, low: true, high: true, currency: true, source: true } },
  marketData: { select: { investmentScore: true, rarityScore: true, liquidityScore: true, trendDirection: true, priceChange7d: true, priceChange30d: true, priceChange1y: true, allTimeHigh: true, volatility30d: true } },
  aiAnalysis: { select: { investmentScore: true, predictedRoi90d: true, trendDirection: true, bullishSignals: true, bearishSignals: true, keyInsight: true, predictions: { select: { horizonDays: true, predictedPrice: true, lowerBound: true, upperBound: true }, orderBy: { horizonDays: 'asc' } as any } } },
}

// ── Recherche DB (S1 → S5) ────────────────────────────────────────────────────

export async function findCardInDB(hint: CardHint, setId: string): Promise<any | null> {
  const numRaw = (hint.cardNumber ?? '').split('/')[0].trim()
  const nums   = numberVariants(numRaw)
  const frNorm = normalizeName(hint.cardName)
  const enNorm = normalizeName(hint.englishName)

  if (!hint.cardName && !hint.englishName && !numRaw) return null

  // S1 : externalId exact (une seule requête batch)
  const setIds = new Set<string>([...[setId, hint.setId].filter(Boolean), ...numberSetHints(numRaw)])
  const extIds = [...setIds].flatMap(sid => nums.map(n => `${sid}-${n}`))
  if (extIds.length) {
    const found = await prisma.card.findFirst({ where: { externalId: { in: extIds } }, select: CARD_SELECT })
    if (found) return found
  }

  if (numRaw) {
    // S2 : nom + numéro
    const nameQueries = [hint.cardName, hint.englishName].filter((v, i, a) => v && a.indexOf(v) === i)
    const s2all = (await Promise.all(nameQueries.map(name =>
      prisma.card.findMany({
        where: { name: { contains: name, mode: 'insensitive' }, number: { in: nums } },
        select: CARD_SELECT, orderBy: { set: { releaseDate: 'desc' } } as any, take: 8,
      })
    ))).flat()
    if (s2all.length) {
      const exact = setId ? s2all.find(c => c.set.externalId === setId) : null
      return exact ?? s2all[0]
    }

    // S3 : numéro + setId
    if (setId) {
      const s3 = await prisma.card.findFirst({ where: { number: { in: nums }, set: { externalId: setId } }, select: CARD_SELECT })
      if (s3) return s3
    }

    // S4 : numéro seul
    const byNum = await prisma.card.findMany({ where: { number: { in: nums } }, select: CARD_SELECT, take: 30 })
    if (byNum.length === 1) return byNum[0]
    if (byNum.length > 1) {
      for (const norm of [frNorm, enNorm].filter(Boolean)) {
        const exact = byNum.find(c => normalizeName(c.name) === norm)
        if (exact && (!setId || exact.set.externalId === setId)) return exact
        const prefix = byNum.filter(c => normalizeName(c.name).startsWith(norm.split(' ')[0]))
        if (prefix.length === 1) return prefix[0]
        if (prefix.length > 1 && setId) {
          const inSet = prefix.find(c => c.set.externalId === setId)
          if (inSet) return inSet
        }
      }
    }
  }

  // S5 : nom + setId
  if (setId && (hint.cardName || hint.englishName)) {
    const name = hint.englishName || hint.cardName
    const s5 = await prisma.card.findFirst({
      where: { name: { contains: name, mode: 'insensitive' }, set: { externalId: setId } },
      select: CARD_SELECT,
    })
    if (s5) return s5
  }

  return null
}
