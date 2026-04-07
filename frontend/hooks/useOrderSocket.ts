import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api')
  .replace(/\/api$/, '')

export function useOrderSocket(
  orderId: string | null,
  onUpdate: (order: any) => void,
) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!orderId) return
    let socket: Socket | null = null
    let cancelled = false

    async function connect() {
      const res = await fetch('/api/auth/ws-token')
      if (!res.ok || cancelled) return
      const { token } = await res.json()
      if (cancelled) return

      socket = io(`${WS_URL}/orders`, {
        auth:         { token },
        transports:   ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay:    1000,
      })

      socket.on('connect', () => {
        socket?.emit('join_order', orderId)
      })

      socket.on('order_updated', (data) => onUpdateRef.current(data))
    }

    connect()
    return () => {
      cancelled = true
      socket?.disconnect()
      socket = null
    }
  }, [orderId])
}
