/**
 * Utilitaire de déchiffrement pokecardex.com
 * Les pages utilisent AES-256-CBC avec une clé embarquée dans leur bundle JS.
 */
import { createDecipheriv } from 'crypto'

const KEY = Buffer.from('oe61R0RgVTJm9omokoKuRem2N2GUbUZ8', 'utf8') // 32 bytes = AES-256

export function decryptPokecardex(payload: { iv: string; data: string }): any {
  const iv  = Buffer.from(payload.iv,   'base64')
  const enc = Buffer.from(payload.data, 'base64')
  const dec = createDecipheriv('aes-256-cbc', KEY, iv)
  const raw = Buffer.concat([dec.update(enc), dec.final()])
  return JSON.parse(raw.toString('utf8'))
}

export function extractPayload(html: string): { iv: string; data: string } | null {
  // Le payload est injecté comme window.__INITIAL_DATA_ENCRYPTED__ = {...}
  const m = html.match(/window\.__INITIAL_DATA_ENCRYPTED__\s*=\s*(\{[^<]+\})/)
  if (!m) return null
  try { return JSON.parse(m[1]) } catch { return null }
}

const BASE = 'https://www.pokecardex.com'

export async function fetchDecrypt(path: string): Promise<any | null> {
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.5',
        'Referer': 'https://www.pokecardex.com',
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    const html = await res.text()
    const payload = extractPayload(html)
    if (!payload) return null
    return decryptPokecardex(payload)
  } catch (e: any) {
    console.warn(`[pokecardex] fetchDecrypt ${path}: ${e.message}`)
    return null
  }
}

/** Prix d'une carte pokecardex (source: cardmarket FR) */
export interface PokecardexPrice {
  averageSellPrice: number
  lowPrice: number
  trendPrice: number
  avg1: number
  avg7: number
  avg30: number
  reverseHoloTrend?: number
  reverseHoloAvg7?: number
  reverseHoloAvg30?: number
  updated: string
}

export async function fetchCardPrice(idCard: number): Promise<PokecardexPrice | null> {
  const data = await fetchDecrypt(`/carte/${idCard}`)
  if (!data) return null
  const prices: any[] = data.cardmarketPrices ?? []
  // Prendre la version principale (isAlt=0 en priorité)
  const main = prices.find(p => !p.isAlt) ?? prices[0]
  if (!main) return null
  return main as PokecardexPrice
}
