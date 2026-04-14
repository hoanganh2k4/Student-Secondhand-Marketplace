# Object: User

> Tables: `users`, `student_profiles`, `buyer_profiles`, `seller_profiles`
> A single student account can act as both buyer and seller simultaneously.

---

## User

Central identity record. Created on first login via Supabase Auth magic link.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | Primary key |
| email | String | University email, unique |
| emailVerified | Boolean | Must be true before any activity |
| name | String | Display name |
| phone | String? | Optional, for order coordination |
| passwordHash | String? | bcrypt hash; null if magic-link only account |
| status | `active \| suspended \| banned` | |
| isAdmin | Boolean | `false` by default; grants access to `/api/admin/*` |
| createdAt | DateTime | |
| lastActiveAt | DateTime? | Used for inactivity detection |

**Constraints:**
- Email must match `ALLOWED_EMAIL_DOMAINS` (bypassed for seeded admin account)
- Cannot create demands, listings, or send messages until `emailVerified = true`
- `isAdmin = true` unlocks all `AdminGuard`-protected routes

---

## StudentProfile

Stores university identity data. One-to-one with User.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| userId | String | FK → User |
| university | String | |
| studentIdNumber | String? | From ID card |
| verificationStatus | `unverified \| email_verified \| id_verified` | |
| verifiedAt | DateTime? | |
| graduationYear | Int? | |

---

## BuyerProfile

Created automatically (upsert) when a user submits their first DemandRequest.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| userId | String | FK → User, unique |
| preferredCategories | String[] | Optional preference list |
| defaultLocation | String? | Pre-fills demand location |
| buyerRating | Decimal? | 0.00–5.00, computed from RatingReviews |
| totalOrdersCompleted | Int | |
| trustTier | `new \| established \| trusted` | |

---

## SellerProfile

Created automatically (upsert) when a user publishes their first ProductListing.

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | |
| userId | String | FK → User, unique |
| sellerRating | Decimal? | 0.00–5.00 |
| totalListingsCreated | Int | |
| totalOrdersCompleted | Int | |
| trustTier | `new \| established \| trusted` | |
| preferredMeetupZones | String[] | |
| availabilityNotes | String? | |

---

## Business Rules

| Rule | Description |
|------|-------------|
| R-U1 | Email must match `ALLOWED_EMAIL_DOMAINS` |
| R-U2 | `emailVerified = true` required before any marketplace activity |
| R-U3 | Max 10 active DemandRequests per BuyerProfile |
| R-U4 | BuyerProfile and SellerProfile created lazily on first use |
| R-U5 | `status = suspended/banned` blocks all API actions for that user |
| R-U6 | `isAdmin = true` is required for all `/api/admin/*` routes (enforced by `AdminGuard`) |
| R-U7 | Admin account (`admin@marketplace.com`) is auto-seeded on every backend startup via `seedAdmin()` in `main.ts` |

---

## Related API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile` | Get own profile |
| PATCH | `/api/profile` | Update name, phone, availability |

---

## Related Objects

- [demand-request.md](demand-request.md) — BuyerProfile creates demands
- [product-listing.md](product-listing.md) — SellerProfile creates listings
- [order.md](order.md) — User participates as buyer or seller
- [notification.md](notification.md) — Notifications delivered to User
