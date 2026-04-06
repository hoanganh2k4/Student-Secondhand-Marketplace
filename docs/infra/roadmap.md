# Phase 2 Upgrade Roadmap

> This document lists what was intentionally deferred from MVP and how to upgrade each part.
> See [stack.md](../stack.md) for the MVP decisions.

---

## Upgrade Paths

| Concern | MVP Approach | Phase 2 Upgrade | Trigger to upgrade |
|---------|-------------|-----------------|-------------------|
| Matching performance | Synchronous call in API route (blocks response for ~200ms) | Move to async job queue: BullMQ + Redis, triggered via a Supabase Database webhook | When matching takes > 1s due to large candidate pool |
| Matching quality (rule-based) | Rule-based weighted scoring (price/condition/location/quantity) | Integrate AI service `/search` results as a `semantic` dimension (15% weight) — **AI service already built** | Connect `AI_SERVICE_URL` in production |
| Matching quality (AI) | BiEncoder trained on 40K synthetic triplets | Retrain on real user interaction data (clicks, accepted matches) — LightGBM reranker on top | When 1,000+ real match interactions available |
| Proof quality scoring | Static `qualityScore: 90` placeholder | Call Google Vision API (or similar) for blur detection, completeness, object presence | When fake/low-quality proof becomes a moderation burden |
| Notifications | Email only (Resend) | Add mobile push (Expo Push for React Native app) or web push (via Vapid) | When mobile app is built |
| Real-time | Supabase Realtime (200 concurrent conn on free tier) | Upgrade Supabase plan, or replace with a dedicated Ably/Pusher channel if Supabase limits are hit | When concurrent active conversations exceed 150 |
| Payments | No in-platform payment; cash at meetup | Stripe Connect for buyer escrow; funds released on mutual confirmation | When trust incidents make cash payments a retention problem |
| Multi-campus | Single campus (one `ALLOWED_EMAIL_DOMAINS` list) | Add `University` model; scope all queries by `universityId`; allow cross-campus discovery as optional | When expanding to a second campus |
| Location | String zone label (e.g., "North Campus") | Add `latitude` + `longitude` to User/Listing; use PostGIS `ST_Distance` for radius-based matching | When zone labels become too coarse for matching quality |
| Moderation | Admin manually reviews report queues | Train a content classifier for prohibited items + image NSFW detection; add automated shadow-banning with appeal flow | When report volume exceeds admin bandwidth (> 50/week) |
| Mobile app | Mobile-first web (PWA) | React Native app using the same Next.js API layer (no backend changes required) | When PWA retention data shows native app would improve engagement |
| Student ID verification | Email domain check only | Upload student ID photo → OCR name + ID number → cross-check against university roster API (if available) | For high-value categories (electronics > $500) or high-dispute users |
| Seller analytics | No analytics dashboard | Add a seller dashboard: views per listing, match rate, conversion rate, average time to sale | When seller retention data shows this is a requested feature |
| Category taxonomy | Flat list of 10 categories | Add subcategory hierarchy (already modelled in schema) + category-specific matching attribute weights | When category mismatch is a leading cause of low match quality |

---

## Architecture Changes Required Per Upgrade

### Async Matching Queue

Replace the fire-and-forget call in the API route:

```typescript
// MVP
matchDemandAgainstListings(demand.id).catch(console.error)

// Phase 2: enqueue a job
await matchingQueue.add('match-demand', { demandId: demand.id })
```

Add:
- Redis instance (Upstash Redis for serverless compatibility with Vercel)
- BullMQ worker process (separate `worker.ts` entry point, deployed as a long-running process on Railway or Fly.io)
- A `matching_jobs` table (optional) for audit and retry tracking

### Multi-Campus

Add to Prisma schema:

```prisma
model University {
  id             String  @id @default(uuid())
  name           String
  allowedDomains String[]
  isActive       Boolean @default(true)

  users     User[]
  listings  ProductListing[]
  demands   DemandRequest[]
}
```

Add `universityId` FK to `User`, `ProductListing`, `DemandRequest`. Scope all matching queries to `WHERE university_id = ?`.

### PostGIS Location Matching

```sql
-- Add to product_listings and demand_requests
ALTER TABLE product_listings ADD COLUMN coordinates geography(POINT, 4326);
ALTER TABLE demand_requests  ADD COLUMN coordinates geography(POINT, 4326);

-- Matching query: filter candidates within Xkm
SELECT *
FROM product_listings
WHERE ST_DWithin(coordinates, $1::geography, $2 * 1000)  -- $2 = km radius
AND status = 'active';
```

Replace the current `listing.location === demand.location` check in the normalizer with a distance score.

---

## What to Monitor to Know When to Upgrade

| Metric | Warning threshold | Action |
|--------|------------------|--------|
| Matching engine response time | > 500ms p95 | Move to async queue |
| Supabase Realtime connections | > 150 concurrent | Upgrade plan or switch provider |
| Admin report queue | > 50 open reports/week | Add automated moderation |
| Match acceptance rate | < 20% of matches lead to conversation | Revisit scoring weights or switch to ML |
| Dispute rate | > 5% of completed orders | Investigate root cause; consider escrow |
| Email open rate | < 20% | Consider push notifications |
