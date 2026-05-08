/**
 * Client API — toutes les requêtes passent par les Next.js Route Handlers.
 * URLs relatives → fonctionne en dev comme en prod sans config.
 */

async function fetcher<T = any>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }))
    throw new Error(error.message ?? `Request failed: ${res.status}`)
  }
  return res.json()
}

function qs(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export const api = {
  // ─── CARDS ────────────────────────────────────────────────────────────────
  cards: {
    search: (q: string, filters?: Record<string, string>) =>
      fetcher(`/api/cards${qs({ q, ...filters })}`),

    getById: (id: string) =>
      fetcher(`/api/cards/${id}`),

    getPriceHistory: (id: string, params: { range: string; type: string }) =>
      fetcher(`/api/cards/${id}/price-history${qs(params)}`),

    getGradedPrices: (id: string) =>
      fetcher(`/api/cards/${id}/graded-prices`),

    getSales: (id: string, limit = 20) =>
      fetcher(`/api/cards/${id}/sales${qs({ limit })}`),

    getSimilar: (id: string, setId?: string) =>
      fetcher(`/api/cards/${id}/similar${qs({ setId })}`),

    getTrending: (limit = 20) =>
      fetcher(`/api/cards/trending${qs({ limit })}`),
  },

  // ─── MARKET ───────────────────────────────────────────────────────────────
  market: {
    getOverview: () =>
      fetcher('/api/market/overview'),

    getTicker: () =>
      fetcher('/api/market/ticker'),

    getTopMovers: (direction: 'up' | 'down', limit = 10) =>
      fetcher(`/api/market/movers${qs({ direction, limit })}`),

    getOpportunities: (limit = 10) =>
      fetcher(`/api/market/opportunities${qs({ limit })}`),

    getRecentSales: (limit = 20) =>
      fetcher(`/api/market/recent-sales${qs({ limit })}`),

    getFeaturedCard: () =>
      fetcher('/api/market/featured'),

    getIndex: (params?: { range?: string; type?: string }) =>
      fetcher(`/api/market/index${qs(params)}`),
  },

  // ─── PORTFOLIO ────────────────────────────────────────────────────────────
  portfolio: {
    getMyPortfolio: () =>
      fetcher('/api/portfolio/me'),

    getHistory: (range: string) =>
      fetcher(`/api/portfolio/me/history${qs({ range })}`),

    addItem: (data: {
      cardId: string
      variant?: string
      quantity: number
      purchasePrice?: number
      purchasedAt?: string
      grade?: number
      gradeCompany?: string
      notes?: string
    }) => fetcher('/api/portfolio/items', { method: 'POST', body: JSON.stringify(data) }),

    updateItem: (itemId: string, data: Partial<{ quantity: number; purchasePrice: number; notes: string }>) =>
      fetcher(`/api/portfolio/items/${itemId}`, { method: 'PATCH', body: JSON.stringify(data) }),

    deleteItem: (itemId: string) =>
      fetcher(`/api/portfolio/items/${itemId}`, { method: 'DELETE' }),

    importCsv: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      return fetch('/api/portfolio/import', { method: 'POST', body: form }).then((r) => r.json())
    },
  },

  // ─── ALERTS ───────────────────────────────────────────────────────────────
  alerts: {
    getAll: () =>
      fetcher('/api/alerts'),

    create: (data: {
      cardId: string
      type: string
      targetValue?: number
      targetPercent?: number
      notifyEmail?: boolean
    }) => fetcher('/api/alerts', { method: 'POST', body: JSON.stringify(data) }),

    update: (id: string, data: Partial<{ status: string; targetValue: number }>) =>
      fetcher(`/api/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id: string) =>
      fetcher(`/api/alerts/${id}`, { method: 'DELETE' }),
  },

  // ─── WATCHLIST ────────────────────────────────────────────────────────────
  watchlist: {
    getAll: () =>
      fetcher('/api/watchlist'),

    add: (cardId: string) =>
      fetcher('/api/watchlist', { method: 'POST', body: JSON.stringify({ cardId }) }),

    remove: (cardId: string) =>
      fetcher(`/api/watchlist/${cardId}`, { method: 'DELETE' }),

    check: (cardId: string) =>
      fetcher(`/api/watchlist/${cardId}`),
  },

  // ─── AI ───────────────────────────────────────────────────────────────────
  ai: {
    getCardAnalysis: (cardId: string) =>
      fetcher(`/api/ai/cards/${cardId}/analysis`),
  },

  // ─── PAYMENTS ─────────────────────────────────────────────────────────────
  payments: {
    createCheckoutSession: (tier: string) =>
      fetcher('/api/payments/checkout', { method: 'POST', body: JSON.stringify({ tier }) }),

    getSubscription: () =>
      fetcher('/api/payments/subscription'),
  },
}
