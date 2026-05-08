import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'

interface TickerItem {
  cardId: string
  name: string
  price: number
  change: number
}

interface MarketStore {
  // Live ticker data
  ticker: TickerItem[]
  setTicker: (items: TickerItem[]) => void
  updateTickerItem: (cardId: string, price: number, change: number) => void

  // Market index
  marketIndex: number
  indexChange: number
  setMarketIndex: (value: number, change: number) => void

  // WebSocket state
  wsConnected: boolean
  setWsConnected: (connected: boolean) => void

  // Currency preference
  currency: 'EUR' | 'USD'
  setCurrency: (currency: 'EUR' | 'USD') => void

  // Notification queue
  notifications: Array<{ id: string; message: string; type: 'bull' | 'bear' | 'neutral' }>
  addNotification: (notification: Omit<MarketStore['notifications'][0], 'id'>) => void
  removeNotification: (id: string) => void
}

export const useMarketStore = create<MarketStore>()(
  subscribeWithSelector((set, get) => ({
    ticker: [],
    setTicker: (items) => set({ ticker: items }),
    updateTickerItem: (cardId, price, change) =>
      set((state) => ({
        ticker: state.ticker.map((item) =>
          item.cardId === cardId ? { ...item, price, change } : item,
        ),
      })),

    marketIndex: 1000,
    indexChange: 0,
    setMarketIndex: (value, change) => set({ marketIndex: value, indexChange: change }),

    wsConnected: false,
    setWsConnected: (connected) => set({ wsConnected: connected }),

    currency: 'EUR',
    setCurrency: (currency) => set({ currency }),

    notifications: [],
    addNotification: (notification) =>
      set((state) => ({
        notifications: [
          ...state.notifications,
          { ...notification, id: Math.random().toString(36).slice(2) },
        ].slice(-10),
      })),
    removeNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),
  })),
)
