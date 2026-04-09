# Roadmap

> Current state: NestJS backend + Next.js frontend + FastAPI AI service, all running locally.
> Stack: NestJS 10 · Next.js 15 · PostgreSQL · MinIO · Florence-2 · SentenceTransformer · CLIP

---

## What's Built

| Feature | Status | Notes |
|---------|--------|-------|
| Auth — magic link + password | ✅ | Email → onboarding → set-password → login |
| Listings CRUD + image upload | ✅ | MinIO storage, Florence-2 auto-caption |
| Demands CRUD | ✅ | |
| AI matching engine | ✅ | `/score-pairs` cosine similarity, structured text format |
| Price + condition penalties | ✅ | Soft multipliers after scoring |
| Same-user hard filter | ✅ | Applied in Prisma query |
| MatchSnapshot (LTR features) | ✅ | Saved per match, 11 features |
| MatchInteraction (labels) | ✅ | Auto-logged: messaged, offered, ordered |
| AiCallLog | ✅ | Every AI service call logged |
| AiMatchLog | ✅ | Every matching run logged |
| Training data export | ✅ | `/api/ai/training-data/export` → JSONL for XGBoost |
| Conversations + realtime chat | ✅ | WebSocket gateway |
| Offers (negotiate price) | ✅ | Counter-offer flow |
| Orders + confirmation flow | ✅ | 4-stage: Created → In Progress → Completed → Success |
| Reviews + disputes | ✅ | |
| Notifications (realtime) | ✅ | WebSocket + DB |
| Admin panel | ✅ | Suspend/ban users, remove listings, resolve disputes |

---

## Upgrade Paths

### Priority 1 — Matching Quality

| Item | What to do | When |
|------|-----------|------|
| **LTR model** | Train XGBoost LambdaRank on `/training-data/export` once 50+ labeled rows | After 50+ matched + interacted pairs |
| **Visual scoring** | Wire CLIP score into `visualScore` in MatchSnapshot; blend `α·textScore + β·visualScore` | After collecting enough image interactions |
| **Stage 0 demand enrichment** | Use `/stage0/parse` to extract budget/condition from free-text before scoring | When demand descriptions are unreliable |
| **Dynamic α/β weights** | Electronics: α=0.9/β=0.1; Fashion: α=0.6/β=0.4 | After visual scoring is live |

### Priority 2 — Infrastructure

| Item | What to do | When |
|------|-----------|------|
| **Async matching queue** | BullMQ + Redis — dequeue after demand/listing published | When matching takes >1s (large candidate pool) |
| **Email delivery** | Wire Resend/SendGrid for magic link emails | Before deploying to real users |
| **Push notifications** | Web push (Vapid) or mobile push | When PWA is shipped |
| **Payments** | Stripe Connect — escrow released on mutual confirmation | When cash-at-meetup causes disputes |

### Priority 3 — Scale

| Item | What to do | When |
|------|-----------|------|
| **Multi-university** | Add `University` model; scope all queries by `universityId` | When expanding to 2nd campus |
| **PostGIS location** | Replace string zone with `ST_DWithin` radius query | When zone labels cause match quality complaints |
| **Automated moderation** | Content classifier for prohibited items + NSFW detection | When report volume >50/week |
| **Seller analytics** | Views/match-rate/conversion dashboard | When seller retention drops |

---

## Metrics to Watch

| Metric | Warning | Action |
|--------|---------|--------|
| Matching latency | >500ms p95 | Move to async queue |
| Match acceptance rate | <20% lead to conversation | Review text format or add Stage 0 enrichment |
| Training data coverage | <50% snapshots have interactions | Improve UI surfaces for interaction logging |
| NDCG@5 after retrain | Lower than current | Debug feature vector or collect more diverse labels |
| Dispute rate | >5% of completed orders | Consider payment escrow |
