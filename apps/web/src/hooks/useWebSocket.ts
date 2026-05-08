'use client'

import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'
import { useMarketStore } from '@/stores/market.store'

export function useWebSocket() {
  const socketRef = useRef<Socket | null>(null)
  const { setWsConnected, updateTickerItem, setMarketIndex, addNotification } = useMarketStore()

  useEffect(() => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001'

    socketRef.current = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 10,
    })

    const socket = socketRef.current

    socket.on('connect', () => {
      setWsConnected(true)
      // Subscribe to market feed
      socket.emit('subscribe:market')
    })

    socket.on('disconnect', () => {
      setWsConnected(false)
    })

    // Real-time price updates
    socket.on('price:update', ({ cardId, price, change }: { cardId: string; price: number; change: number }) => {
      updateTickerItem(cardId, price, change)
    })

    // Market index updates
    socket.on('index:update', ({ value, change }: { value: number; change: number }) => {
      setMarketIndex(value, change)
    })

    // Alert triggers
    socket.on('alert:triggered', ({ cardName, message }: { cardName: string; message: string }) => {
      addNotification({
        message: `🔔 Alert: ${cardName} — ${message}`,
        type: 'neutral',
      })
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  return socketRef.current
}
