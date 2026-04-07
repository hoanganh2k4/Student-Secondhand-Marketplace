import { useEffect, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api')
  .replace(/\/api$/, '')   // strip /api suffix

type Handler = (data: any) => void

interface EventMap {
  new_message:           Handler
  order_request_created: Handler
  order_request_updated: Handler
  order_created:         Handler
}

export function useConversationSocket(
  conversationId: string | null,
  handlers: Partial<EventMap>,
) {
  // Keep handlers ref current every render — no stale closures
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!conversationId) return

    // Local variables — captured in the cleanup closure, safe with StrictMode
    let socket: Socket | null = null
    let cancelled = false

    async function connect() {
      const res = await fetch('/api/auth/ws-token')
      if (!res.ok || cancelled) return
      const { token } = await res.json()
      if (cancelled) return   // cleanup fired while we were fetching

      socket = io(`${WS_URL}/chat`, {
        auth:         { token },
        transports:   ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay:    1000,
      })

      socket.on('connect', () => {
        socket?.emit('join_conversation', conversationId)
      })

      socket.on('new_message',           (d) => handlersRef.current.new_message?.(d))
      socket.on('order_request_created', (d) => handlersRef.current.order_request_created?.(d))
      socket.on('order_request_updated', (d) => handlersRef.current.order_request_updated?.(d))
      socket.on('order_created',         (d) => handlersRef.current.order_created?.(d))
    }

    connect()

    return () => {
      cancelled = true      // stop connect() mid-flight if still fetching token
      socket?.disconnect()
      socket = null
    }
  }, [conversationId])
}
