# Real-time Updates (Frontend)

> Implemented via Socket.IO with JWT auth.
> Two namespaces: `/chat` (conversations) and `/orders` (order status).

---

## Architecture

The frontend cannot read httpOnly cookies from JavaScript, so WebSocket auth uses a token exchange pattern:

1. Client calls `GET /api/auth/ws-token` (Next.js server route)
2. Server route reads the `access_token` httpOnly cookie and returns `{ token }` as JSON
3. Client passes the token as `socket.auth.token` when connecting
4. Socket.IO gateway on the backend verifies the token with `JwtService.verify()`

---

## useConversationSocket

> File: `frontend/hooks/useConversationSocket.ts`
> Namespace: `/chat`

```typescript
export function useConversationSocket(
  conversationId: string | null,
  handlers: {
    new_message?:            (msg: any)    => void
    stage_changed?:          (data: any)   => void
    order_request_updated?:  (req: any)    => void
    order_created?:          (data: any)   => void
  }
)
```

**Events subscribed:**
- `new_message` — new chat message (with sender object embedded)
- `stage_changed` — conversation stage advanced
- `order_request_updated` — OrderRequest status/info updated
- `order_created` — OrderRequest finalized, `{ orderId }` → redirect to `/orders/:id`

**Usage in conversation page:**
```typescript
useConversationSocket(conv?.id ?? null, {
  new_message:           (msg) => setMessages(prev => [...prev, msg]),
  order_request_updated: (req) => setConv(prev => updateOrderRequest(prev, req)),
  order_created:         ({ orderId }) => router.push(`/orders/${orderId}`),
})
```

---

## useOrderSocket

> File: `frontend/hooks/useOrderSocket.ts`
> Namespace: `/orders`

```typescript
export function useOrderSocket(
  orderId: string | null,
  onUpdate: (order: Partial<Order>) => void,
)
```

**Events subscribed:**
- `order_updated` — partial order object (status, confirmation booleans, etc.)

**Usage in order detail page:**
```typescript
useOrderSocket(id ?? null, (updated) => {
  setOrder(prev => prev ? { ...prev, ...updated } : prev)
})
```

---

## React StrictMode Safety

Both hooks use the **local variable + cancelled flag** pattern to avoid double-connection in React 18 StrictMode (which runs `useEffect` twice in development):

```typescript
useEffect(() => {
  if (!id) return
  let socket: Socket | null = null
  let cancelled = false

  async function connect() {
    const res = await fetch('/api/auth/ws-token')
    if (!res.ok || cancelled) return
    const { token } = await res.json()
    if (cancelled) return

    socket = io(`${WS_URL}/namespace`, { auth: { token }, transports: ['websocket'] })
    socket.on('connect', () => socket?.emit('join_room', id))
    socket.on('event', handler)
  }

  connect()
  return () => {
    cancelled = true
    socket?.disconnect()
    socket = null
  }
}, [id])
```

The `cancelled` flag ensures the async `fetch` result is discarded if the effect was torn down before the fetch resolved.

---

## Backend Gateways

| File | Namespace | Auth | Rooms |
|------|-----------|------|-------|
| `backend/src/conversations/conversations.gateway.ts` | `/chat` | JWT on connect | `conv:<conversationId>` |
| `backend/src/orders/orders.gateway.ts` | `/orders` | JWT on connect | `order:<orderId>` |

Both gateways:
- Verify JWT in `handleConnection`, disconnect client if invalid
- Verify user is a participant before joining a room
- Expose `emit(id, event, data)` helper called by the corresponding service

---

## WS Token Route

> File: `frontend/app/api/auth/ws-token/route.ts`

```typescript
// GET /api/auth/ws-token
export async function GET(req: NextRequest) {
  const token = req.cookies.get('access_token')?.value
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json({ token })
}
```

This route is only accessible from the same Next.js app (not proxied to the backend).

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Backend base URL, e.g. `http://localhost:4000/api` |

WS URL is derived by stripping `/api` suffix:
```typescript
const WS_URL = (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api')
  .replace(/\/api$/, '')
// → 'http://localhost:4000'
```
