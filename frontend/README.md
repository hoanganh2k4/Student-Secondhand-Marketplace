# Frontend — Student Secondhand Marketplace

Next.js 16 App Router, TypeScript, Tailwind CSS. Mobile-first PWA-style UI.

---

## Running

```bash
cd frontend
npm install
npm run dev   # http://localhost:3000
```

Requires `.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

---

## Project Structure

```
frontend/
├── app/
│   ├── layout.tsx                    ← Root layout (fonts, global styles)
│   ├── (auth)/                       ← Unauthenticated routes
│   │   ├── login/page.tsx            ← Login / register tabs
│   │   └── onboarding/page.tsx       ← Post-register profile setup
│   ├── (main)/                       ← Authenticated routes (bottom nav)
│   │   ├── layout.tsx                ← Bottom navigation bar
│   │   ├── page.tsx                  ← Home feed (listings + demands)
│   │   ├── listings/
│   │   │   ├── page.tsx              ← My listings list
│   │   │   ├── new/page.tsx          ← Create listing form
│   │   │   └── [id]/page.tsx         ← Listing detail + matches
│   │   ├── demands/
│   │   │   ├── page.tsx              ← My demands list
│   │   │   ├── new/page.tsx          ← Create demand form
│   │   │   └── [id]/page.tsx         ← Demand detail + matches
│   │   ├── matches/
│   │   │   └── [id]/page.tsx         ← Match detail, accept/decline
│   │   ├── conversations/
│   │   │   ├── page.tsx              ← Conversation inbox
│   │   │   └── [id]/page.tsx         ← Chat thread + OrderRequestCard
│   │   ├── orders/
│   │   │   ├── page.tsx              ← Orders (2 tabs: buying / selling)
│   │   │   └── [id]/page.tsx         ← Order detail, confirm, review, dispute
│   │   ├── notifications/page.tsx    ← Notification feed
│   │   └── profile/
│   │       ├── page.tsx              ← Profile summary (stats, listings, orders)
│   │       └── set-password/page.tsx ← Change password
│   └── api/
│       ├── proxy/[...path]/route.ts  ← Catch-all proxy → backend (forwards cookie)
│       └── auth/ws-token/route.ts    ← Returns JWT for WebSocket auth
├── hooks/
│   ├── useConversationSocket.ts      ← Socket.IO /chat namespace
│   └── useOrderSocket.ts             ← Socket.IO /orders namespace
└── public/                           ← Static assets
```

---

## Auth Flow

- Auth cookie (`access_token`) is set by the backend as httpOnly
- All API calls go through `/api/proxy/[...path]` which forwards the cookie to the backend
- On page load, pages call `GET /api/proxy/auth/me` to check auth; redirect to `/auth/login` if not OK
- Logout: navigate to `/auth/logout` (proxy endpoint that clears cookie)

---

## Proxy Route

`app/api/proxy/[...path]/route.ts` — catch-all that:
1. Forwards the incoming request (method, headers, body) to `NEXT_PUBLIC_API_URL + path`
2. Attaches the `access_token` cookie from the browser
3. Returns the backend's response verbatim

This keeps the backend URL server-side and avoids CORS issues.

---

## WebSocket Hooks

### useConversationSocket

```typescript
useConversationSocket(conversationId, {
  new_message:           (msg)  => void,
  stage_changed:         (data) => void,
  order_request_updated: (req)  => void,
  order_created:         (data) => void,  // { orderId } → redirect
})
```

### useOrderSocket

```typescript
useOrderSocket(orderId, (partialOrder) => void)
// Merges into local order state on every status update
```

Both hooks handle React StrictMode double-invocation safely (local socket variable + cancelled flag).

---

## Key Pages

### Conversation (`/conversations/[id]`)

- Realtime chat via `useConversationSocket`
- Messages are displayed left (other) / right (self, blue) based on `myId`
- System messages with body `__order_request:<id>__` render as `OrderRequestCard` components
- `OrderRequestCard` shows different forms to seller vs buyer:
  - **Seller:** fills price + quantity
  - **Buyer:** fills phone, email, delivery address, fulfillment method
- "Order" button only appears when no active OrderRequest (pending/accepted) exists

### Orders (`/orders`)

- Two tabs: **Đang mua** (buyerUserId = myId) and **Đang bán** (sellerUserId = myId)
- Badge count on each tab

### Order Detail (`/orders/[id]`)

- Realtime status updates via `useOrderSocket`
- Shows completion confirmation panel (buyer ✓ / seller ✓)
- "Xác nhận hoàn thành" button only shown if current user hasn't confirmed yet
- Review form (stars + comment) after completion
- Dispute form (within 48h of completion)

### Profile (`/profile`)

- Fetches user, listings, demands, orders in parallel
- Real stats: completed orders, active listings, active demands
- Rating from `sellerProfile.sellerRating` or `buyerProfile.buyerRating`
- Last 3 listings, demands, and orders with status badges

---

## API Calls

All go through `/api/proxy/` which forwards to the NestJS backend at `NEXT_PUBLIC_API_URL`.

| Resource | Base path |
|----------|-----------|
| Auth | `/api/proxy/auth/me`, `/api/proxy/auth/login`, `/api/proxy/auth/register` |
| Listings | `/api/proxy/listings` |
| Demands | `/api/proxy/demands` |
| Matches | `/api/proxy/matches` |
| Conversations | `/api/proxy/conversations` |
| Orders | `/api/proxy/orders` |
| Notifications | `/api/proxy/notifications` |
