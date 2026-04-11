# Admin Management — Demands, Listings, Orders

> Scope: Thiết kế view-only cho admin quản lý demands, listings, orders
> Hiện tại: Admin đã có quản lý Users và Disputes. Trang Demands/Listings/Orders **chưa được implement**.
> Auth: `isAdmin: true` — guard `AdminGuard` áp dụng cho tất cả route `/api/admin`

---

## 1. Backend API (View only)

### 1.1 Demands

#### `GET /api/admin/demands`

**Query params:**

| Param | Type | Options | Default |
|-------|------|---------|---------|
| `status` | enum | `draft \| active \| waiting \| matched \| in_conversation \| in_negotiation \| fulfilled \| expired \| cancelled` | — |
| `categoryId` | string | — | — |
| `search` | string | Title hoặc email buyer | — |
| `limit` | int | — | 20 |
| `offset` | int | — | 0 |
| `sortBy` | enum | `createdAt \| expiresAt` | `createdAt` |
| `sortOrder` | enum | `asc \| desc` | `desc` |

**Response:**
```json
{
  "total": 142,
  "limit": 20,
  "offset": 0,
  "demands": [
    {
      "id": "uuid",
      "title": "Cần mua laptop sinh viên",
      "status": "active",
      "budgetMin": "0",
      "budgetMax": "20000000",
      "preferredCondition": "good",
      "location": "Hanoi",
      "urgency": "within_week",
      "expiresAt": "2026-05-09T...",
      "createdAt": "2026-04-09T...",
      "matchCount": 2,
      "category": { "id": "...", "name": "Electronics" },
      "buyer": { "id": "uuid", "name": "Nguyen Van A", "email": "a@hcmut.edu.vn" }
    }
  ]
}
```

#### `GET /api/admin/demands/:id`

Chi tiết 1 demand kèm matches và buyer info.

**Response thêm:**
```json
{
  "description": "...",
  "specialRequirements": "...",
  "quantityNeeded": 1,
  "fulfilledQuantity": 0,
  "buyerProfile": {
    "trustTier": "new",
    "totalOrdersCompleted": 0,
    "university": "HCMUT"
  },
  "matches": [
    {
      "id": "uuid",
      "matchScore": 76,
      "matchConfidence": "high",
      "status": "active",
      "createdAt": "...",
      "productListing": { "id": "...", "title": "MacBook Pro 2020", "status": "active" }
    }
  ]
}
```

---

### 1.2 Listings

#### `GET /api/admin/listings`

**Query params:**

| Param | Type | Options | Default |
|-------|------|---------|---------|
| `status` | enum | `draft \| active \| matched \| in_conversation \| partially_sold \| sold \| expired \| removed` | — |
| `categoryId` | string | — | — |
| `condition` | enum | `poor \| fair \| good \| very_good \| like_new` | — |
| `search` | string | Title hoặc email seller | — |
| `limit` | int | — | 20 |
| `offset` | int | — | 0 |
| `sortBy` | enum | `createdAt \| priceExpectation \| proofCompletenessScore` | `createdAt` |
| `sortOrder` | enum | `asc \| desc` | `desc` |

**Response:**
```json
{
  "total": 87,
  "listings": [
    {
      "id": "uuid",
      "title": "MacBook Pro 2020 M1",
      "status": "active",
      "condition": "very_good",
      "priceExpectation": "18000000",
      "location": "Hanoi",
      "proofCompletenessScore": 90,
      "imageCount": 4,
      "hasVision": true,
      "expiresAt": "2026-05-09T...",
      "createdAt": "2026-04-09T...",
      "matchCount": 1,
      "thumbnailUrl": "https://...",
      "category": { "id": "...", "name": "Electronics" },
      "seller": { "id": "uuid", "name": "Tran Thi B", "email": "b@hcmut.edu.vn" }
    }
  ]
}
```

#### `GET /api/admin/listings/:id`

Chi tiết listing kèm proof assets + matches + seller info.

**Response thêm:**
```json
{
  "description": "...",
  "conditionNotes": "...",
  "priceFlexible": false,
  "quantityAvailable": 1,
  "quantityRemaining": 1,
  "proofAssets": [
    {
      "id": "uuid",
      "fileUrl": "https://...",
      "aiAttributes": {
        "attributes": {
          "detailed_caption": "The image shows an Apple MacBook Pro...",
          "ocr": "MacBook Pro",
          "object_detection": "laptop, keyboard"
        }
      }
    }
  ],
  "sellerProfile": {
    "sellerRating": 4.8,
    "totalOrdersCompleted": 3,
    "trustTier": "established"
  },
  "matches": [
    {
      "id": "uuid",
      "matchScore": 76,
      "status": "active",
      "demandRequest": { "id": "...", "title": "Cần mua laptop sinh viên" }
    }
  ]
}
```

---

### 1.3 Orders

#### `GET /api/admin/orders`

**Query params:**

| Param | Type | Options | Default |
|-------|------|---------|---------|
| `status` | enum | `created \| confirmed \| in_progress \| completed \| cancelled \| disputed` | — |
| `fulfillmentMethod` | string | `pickup \| delivery \| flexible` | — |
| `search` | string | Email buyer/seller hoặc listing title | — |
| `fromDate` | ISO date | — | — |
| `toDate` | ISO date | — | — |
| `limit` | int | — | 20 |
| `offset` | int | — | 0 |
| `sortBy` | enum | `createdAt \| finalPrice \| completedAt` | `createdAt` |
| `sortOrder` | enum | `asc \| desc` | `desc` |

**Response:**
```json
{
  "total": 34,
  "orders": [
    {
      "id": "uuid",
      "status": "completed",
      "finalPrice": "1750000",
      "quantity": 1,
      "fulfillmentMethod": "delivery",
      "buyerConfirmedComplete": true,
      "sellerConfirmedComplete": true,
      "completedAt": "2026-04-09T...",
      "createdAt": "2026-04-09T...",
      "hasDispute": false,
      "reviewCount": 1,
      "listing": { "id": "...", "title": "MacBook Pro 2020 M1" },
      "buyer": { "id": "...", "name": "Nguyen Van A", "email": "..." },
      "seller": { "id": "...", "name": "Tran Thi B", "email": "..." }
    }
  ]
}
```

#### `GET /api/admin/orders/:id`

Chi tiết order kèm match, offer, dispute, reviews.

**Response thêm:**
```json
{
  "meetupDetails": "...",
  "cancellationReason": null,
  "match": {
    "id": "...",
    "matchScore": 76,
    "demandRequest": { "title": "..." },
    "productListing": { "title": "..." }
  },
  "offer": {
    "proposedPrice": "1750000",
    "fulfillmentMethod": "delivery"
  },
  "dispute": null,
  "ratingReviews": [
    {
      "roleOfReviewer": "buyer",
      "rating": 5,
      "comment": "Tuyệt vời"
    }
  ]
}
```

---

### 1.4 Stats

#### `GET /api/admin/stats`

```json
{
  "demands": {
    "total": 142,
    "active": 38,
    "fulfilled": 12,
    "expiringSoon": 7
  },
  "listings": {
    "total": 87,
    "active": 45,
    "removed": 3,
    "lowProofScore": 9
  },
  "orders": {
    "total": 34,
    "completed": 22,
    "disputed": 2,
    "inProgress": 4,
    "totalVolume": 42500000
  },
  "matches": {
    "total": 156,
    "conversionRate": 0.22
  }
}
```

---

## 2. NestJS Implementation

### admin.controller.ts — thêm routes

```typescript
// ── Demands ──
@Get('demands')
listDemands(
  @Query('status')    status?: string,
  @Query('categoryId') categoryId?: string,
  @Query('search')    search?: string,
  @Query('limit',  new DefaultValuePipe(20), ParseIntPipe) limit?: number,
  @Query('offset', new DefaultValuePipe(0),  ParseIntPipe) offset?: number,
  @Query('sortBy')    sortBy?: string,
  @Query('sortOrder') sortOrder?: string,
) {
  return this.adminService.listDemands({ status, categoryId, search, limit, offset, sortBy, sortOrder })
}

@Get('demands/:id')
getDemand(@Param('id') id: string) {
  return this.adminService.getDemand(id)
}

// ── Listings ──
@Get('listings')
listListings(/* same pattern */) {
  return this.adminService.listListings({ ... })
}

@Get('listings/:id')
getListing(@Param('id') id: string) {
  return this.adminService.getListing(id)
}

// ── Orders ──
@Get('orders')
listOrders(/* same pattern */) {
  return this.adminService.listOrders({ ... })
}

@Get('orders/:id')
getOrder(@Param('id') id: string) {
  return this.adminService.getOrder(id)
}

// ── Stats ──
@Get('stats')
stats() {
  return this.adminService.getStats()
}
```

### admin.service.ts — logic chính

```typescript
async listDemands({ status, categoryId, search, limit, offset, sortBy, sortOrder }) {
  const where: any = {}
  if (status) where.status = status
  if (categoryId) where.categoryId = categoryId
  if (search) where.OR = [
    { title: { contains: search, mode: 'insensitive' } },
    { buyerProfile: { user: { email: { contains: search, mode: 'insensitive' } } } },
  ]

  const [total, demands] = await Promise.all([
    prisma.demandRequest.count({ where }),
    prisma.demandRequest.findMany({
      where,
      take: limit, skip: offset,
      orderBy: { [sortBy ?? 'createdAt']: sortOrder ?? 'desc' },
      include: {
        category:     { select: { id: true, name: true } },
        buyerProfile: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count:       { select: { matches: true } },
      },
    }),
  ])

  return {
    total, limit, offset,
    demands: demands.map(d => ({
      ...d,
      matchCount: d._count.matches,
      buyer: d.buyerProfile.user,
    })),
  }
}
```

---

## 3. Frontend UI

### 3.1 Route structure

```
/admin
├── /admin/demands            ← list
│   └── /admin/demands/[id]   ← detail
├── /admin/listings           ← list
│   └── /admin/listings/[id]  ← detail
└── /admin/orders             ← list
    └── /admin/orders/[id]    ← detail
```

---

### 3.2 Trang `/admin/demands`

**Filter bar:**
```
[🔍 Search title / email]  [Status ▼]  [Category ▼]  [Sort ▼]
```

**Table columns:**

| Column | Nội dung |
|--------|---------|
| Title | Text, truncate 45 chars, link → `/admin/demands/[id]` |
| Buyer | Name + email (muted) |
| Category | Badge xanh nhạt |
| Budget | `0 – 20,000,000 ₫` |
| Status | Colored badge (xem bảng màu bên dưới) |
| Matches | Số lượng, badge tím nếu > 0 |
| Expires | Relative time, đỏ nếu < 3 ngày |
| Created | Date |

**Status badge colors:**

| Status | Màu |
|--------|-----|
| `draft` | Gray |
| `active` | Blue |
| `waiting` | Yellow |
| `matched` | Purple |
| `in_conversation` | Indigo |
| `in_negotiation` | Orange |
| `fulfilled` | Green |
| `expired` | Gray muted |
| `cancelled` | Red |

---

### 3.3 Trang `/admin/demands/[id]`

**Layout:** 2 cột trên desktop, 1 cột trên mobile

**Trái — Demand info:**
- Header: title + status badge + created/expires
- Budget range, urgency, location
- Preferred condition
- Description + special requirements
- Category

**Phải — Buyer info:**
- Avatar placeholder + name + email
- University, trust tier, total orders completed
- Link → `/admin/users/[id]`

**Dưới — Matches table:**

| Match Score | Confidence | Listing | Status | Created |
|-------------|-----------|---------|--------|---------|
| 76% | high (green) | MacBook Pro 2020 | active | ... |

Link từng row → `/admin/listings/[id]`

---

### 3.4 Trang `/admin/listings`

**Filter bar:**
```
[🔍 Search title / email]  [Status ▼]  [Category ▼]  [Condition ▼]  [Sort ▼]
```

**Table columns:**

| Column | Nội dung |
|--------|---------|
| — | Thumbnail 40×40, fallback icon |
| Title | Link → `/admin/listings/[id]` |
| Seller | Name + email |
| Category | Badge |
| Price | `18,000,000 ₫` |
| Condition | Badge (green=like_new, yellow=good, red=poor) |
| Proof | Score bar + `4 imgs` |
| Status | Colored badge |
| Created | Date |

**Status badge colors:**

| Status | Màu |
|--------|-----|
| `draft` | Gray |
| `active` | Green |
| `matched` | Purple |
| `in_conversation` | Indigo |
| `partially_sold` | Yellow |
| `sold` | Blue |
| `expired` | Gray muted |
| `removed` | Red |

---

### 3.5 Trang `/admin/listings/[id]`

**Layout:** 2 cột

**Trái — Listing info:**
- Title + status badge
- Price, condition, location, quantity
- Description, condition notes
- Proof completeness score (progress bar 0–100)
- Category

**Phải — Seller info:**
- Name + email
- Seller rating (stars), total orders, trust tier

**Images gallery:**
- Grid 2 cột ảnh từ `proofAssets`
- Bên dưới mỗi ảnh: AI caption (Florence-2) nếu có, badge "OCR: ..." nếu có

**Matches table:**

| Match Score | Confidence | Demand | Status | Created |
|-------------|-----------|--------|--------|---------|

Link từng row → `/admin/demands/[id]`

---

### 3.6 Trang `/admin/orders`

**Filter bar:**
```
[🔍 Search buyer / seller / listing]  [Status ▼]  [Fulfillment ▼]  [From] [To]  [Sort ▼]
```

**Table columns:**

| Column | Nội dung |
|--------|---------|
| ID | `#ab12cd34`, link → `/admin/orders/[id]` |
| Listing | Title truncate |
| Buyer | Name + email |
| Seller | Name + email |
| Amount | `1,750,000 ₫` |
| Fulfillment | `pickup / delivery` badge |
| Confirmed | `✓ Buyer  ✓ Seller` hoặc `○ / ✓` |
| Status | Colored badge |
| Dispute | Icon cảnh báo nếu `hasDispute` |
| Created | Date |

**Status badge colors:**

| Status | Màu |
|--------|-----|
| `created` | Blue |
| `confirmed` | Indigo |
| `in_progress` | Yellow |
| `completed` | Green |
| `cancelled` | Gray |
| `disputed` | Red |

---

### 3.7 Trang `/admin/orders/[id]`

**Timeline:**
```
● Created → ● In Progress → ● Completed → ● Success
                          ↘ Cancelled / Disputed
```

**Order details card:**

| Field | Value |
|-------|-------|
| Listing | Link → `/admin/listings/[id]` |
| Buyer | Link → `/admin/users/[id]` |
| Seller | Link → `/admin/users/[id]` |
| Amount | `1,750,000 ₫` |
| Quantity | 1 |
| Fulfillment | delivery |
| Meetup details | ... |
| Created | ... |
| Completed | ... |

**Confirmation status:**
- `Buyer confirmed: ✓` / `✗`
- `Seller confirmed: ✓` / `✗`

**Dispute section** (nếu có): description, filed by, status, resolution

**Reviews section** (nếu có): buyer review + seller review, rating + comment

---

## 4. Proxy Routes (Next.js)

Thêm vào `frontend/app/api/proxy/`:

```
GET  /api/proxy/admin/demands
GET  /api/proxy/admin/demands/[id]
GET  /api/proxy/admin/listings
GET  /api/proxy/admin/listings/[id]
GET  /api/proxy/admin/orders
GET  /api/proxy/admin/orders/[id]
GET  /api/proxy/admin/stats
```

---

## 5. Implementation Order

```
Phase 1 — Backend (1 ngày)
  1. admin.service.ts: listDemands, getDemand
  2. admin.service.ts: listListings, getListing
  3. admin.service.ts: listOrders, getOrder
  4. admin.service.ts: getStats
  5. admin.controller.ts: đăng ký tất cả GET routes trên

Phase 2 — Frontend list pages (1 ngày)
  6. /admin/demands
  7. /admin/listings
  8. /admin/orders

Phase 3 — Frontend detail pages (1 ngày)
  9. /admin/demands/[id]
  10. /admin/listings/[id]
  11. /admin/orders/[id]
```
