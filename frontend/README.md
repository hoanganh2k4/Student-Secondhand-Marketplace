# Frontend — Student Secondhand Marketplace

Next.js 16 · React 19 · TypeScript · Tailwind CSS v4  
Mobile-first UI · Port: **3000**

---

## Setup

```bash
cd frontend
npm install
```

Tạo `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

```bash
npm run dev   # http://localhost:3000
```

Yêu cầu backend chạy trên port 4000.

---

## NPM Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Dev server với hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve production build |
| `npm run lint` | ESLint |

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
│   │   │   ├── new/page.tsx          ← Create listing form + image upload
│   │   │   └── [id]/page.tsx         ← Listing detail + match list
│   │   ├── demands/
│   │   │   ├── page.tsx              ← My demands list
│   │   │   ├── new/page.tsx          ← Create demand form
│   │   │   └── [id]/page.tsx         ← Demand detail + match list
│   │   ├── matches/
│   │   │   └── [id]/page.tsx         ← Match detail: AI scoring, accept/decline
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

## Auth

- Backend set `access_token` là httpOnly cookie
- Tất cả API call đi qua `/api/proxy/[...path]` — proxy tự đính cookie vào request backend
- Khi load page, gọi `GET /api/proxy/auth/me` để check auth; redirect về `/auth/login` nếu 401
- Logout: navigate tới proxy endpoint xóa cookie

---

## Proxy Route

`app/api/proxy/[...path]/route.ts` — catch-all:
1. Forward request (method + headers + body) tới `NEXT_PUBLIC_API_URL + path`
2. Đính `access_token` cookie từ browser
3. Return response từ backend nguyên vẹn

Giữ backend URL ở server-side, tránh CORS.

---

## WebSocket

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
// Merges vào local order state khi có status update
```

Cả hai hook xử lý React StrictMode double-invocation (local socket variable + cancelled flag).

---

## Key Pages

### Match Detail (`/matches/[id]`)

- Score overview: `matchScore` (0–100) + confidence badge + rank trong run
- AI Scoring section: textScore bar (SentenceTransformer), visualScore nếu có (CLIP), finalScore + penalty warning
- Match Features: price fit bar, condition match badge, image/vision status
- Demand vs Listing comparison panel (từ MatchSnapshot)
- Model Info: version, rank position, feature flags
- Accept / Decline buttons (chỉ hiện khi còn `canStillAct`)
- Snapshot fetch là non-blocking — page load nhanh, scoring data hiện sau

### Conversation (`/conversations/[id]`)

- Realtime chat qua `useConversationSocket`
- Messages left (đối phương) / right (mình, xanh)
- System message `__order_request:<id>__` render thành `OrderRequestCard`
- `OrderRequestCard` hiện form khác cho seller vs buyer:
  - **Seller:** điền price + quantity
  - **Buyer:** điền phone, email, địa chỉ, phương thức giao nhận
- Nút "Order" chỉ hiện khi không có OrderRequest đang pending/accepted

### Orders (`/orders`)

- 2 tabs: **Đang mua** (`buyerUserId = myId`) / **Đang bán** (`sellerUserId = myId`)
- Badge count trên mỗi tab

### Order Detail (`/orders/[id]`)

- Realtime status qua `useOrderSocket`
- 4-stage timeline: Created → In Progress → Completed → Success
- "Success" stage hiện khi cả buyer lẫn seller đều confirm complete
- Completion confirmation panel (buyer ✓ / seller ✓)
- Review form (stars + comment) sau khi completed
- Dispute form (trong 48h sau completion)

### Profile (`/profile`)

- Fetch user, listings, demands, orders song song
- Stats thực: completed orders, active listings, active demands
- Rating từ `sellerProfile.sellerRating` hoặc `buyerProfile.buyerRating`
- 3 listings, demands, orders gần nhất với status badge

---

## API Calls

Tất cả qua `/api/proxy/` → NestJS backend tại `NEXT_PUBLIC_API_URL`.

| Resource | Base path |
|----------|-----------|
| Auth | `/api/proxy/auth/me`, `/api/proxy/auth/login`, `/api/proxy/auth/register` |
| Listings | `/api/proxy/listings` |
| Demands | `/api/proxy/demands` |
| Matches | `/api/proxy/matches/:id`, `/api/proxy/matches/:id/snapshot` |
| Conversations | `/api/proxy/conversations` |
| Orders | `/api/proxy/orders` |
| Notifications | `/api/proxy/notifications` |
| Categories | `/api/proxy/categories` |
