# Developer Docs — Student Secondhand Marketplace

> **Source of truth for all technical implementation.**
> Business rules → [`rules.md`](../rules.md) · Design reference → [`EC/src.zip`](../EC/src.zip)

---

## Architecture

```
Browser (Next.js 14 App Router)
    │
    ▼
Vercel  ─── Next.js API Routes + SSR
    │
    ├── Supabase
    │     ├── PostgreSQL (Prisma ORM)
    │     ├── Auth (magic link, .edu domain)
    │     ├── Storage (proof assets)
    │     ├── Realtime (conversations, notifications)
    │     └── Edge Functions (cron jobs)
    │
    └── AI Matching Microservice  (multimodal-matching/)
          ├── Stage 0: QueryParser       — intent + category routing
          ├── Stage 1: CategoryRouter    — FAISS sub-index selection
          ├── Stage 2: BiEncoder + FAISS — dense retrieval (RRF + BM25)
          └── Stage 3: IntentAwareReranker — graded attribute scoring
```

---

## What do you need?

### "I'm setting up the project for the first time"
→ [infra/dev-workflow.md](infra/dev-workflow.md) — local setup, Prisma workflow, sprint order  
→ [infra/env.md](infra/env.md) — all environment variables  
→ [infra/deployment.md](infra/deployment.md) — Vercel + Supabase + AI service deploy

### "I need to understand the data model"
→ [backend/schema.prisma.md](backend/schema.prisma.md) — full Prisma schema (source of truth)  
→ [backend/objects/](backend/objects/README.md) — each domain object: fields, state machine, API endpoints  
→ [backend/state-machines.md](backend/state-machines.md) — all state transition tables + TypeScript code

### "I need to look up a specific domain object"

| Object | File |
|--------|------|
| User, BuyerProfile, SellerProfile | [objects/user.md](backend/objects/user.md) |
| DemandRequest | [objects/demand-request.md](backend/objects/demand-request.md) |
| ProductListing | [objects/product-listing.md](backend/objects/product-listing.md) |
| Match + score breakdown | [objects/match.md](backend/objects/match.md) |
| Conversation, Message, EvidenceRequest | [objects/conversation.md](backend/objects/conversation.md) |
| Offer + counter-offer chain | [objects/offer.md](backend/objects/offer.md) |
| Order + completion triggers | [objects/order.md](backend/objects/order.md) |
| ProofAsset + storage | [objects/proof-asset.md](backend/objects/proof-asset.md) |
| Dispute | [objects/dispute.md](backend/objects/dispute.md) |
| Notification | [objects/notification.md](backend/objects/notification.md) |

### "I need to add or change an API endpoint"
→ [backend/api/web-api.md](backend/api/web-api.md) — all Next.js routes (demands, listings, matches, conversations, orders, admin)  
→ [backend/api/ai-api.md](backend/api/ai-api.md) — FastAPI AI service endpoints

### "I need to understand how a feature works"

| Feature | File |
|---------|------|
| Authentication + RLS | [services/auth.md](backend/services/auth.md) |
| Rule-based matching engine | [services/matching-engine.md](backend/services/matching-engine.md) |
| AI matching pipeline (BiEncoder, FAISS, BM25) | [services/matching-ai.md](backend/services/matching-ai.md) |
| Proof asset upload + storage policy | [services/file-upload.md](backend/services/file-upload.md) |
| Email notifications (Resend templates) | [services/notifications.md](backend/services/notifications.md) |
| Background cron jobs (expiry, auto-close) | [services/background-jobs.md](backend/services/background-jobs.md) |

### "I need to build or change a frontend screen"
→ [frontend/repo-structure.md](frontend/repo-structure.md) — full directory tree, route map, EC → Next.js screen mapping  
→ [frontend/components.md](frontend/components.md) — design tokens, shared components, all screen layouts  
→ [frontend/realtime.md](frontend/realtime.md) — Supabase Realtime hooks

### "I need to understand the business rules"
→ [`rules.md`](../rules.md) — all domain rules (access, listing, matching, conversation, offer, trust)

### "I'm planning Phase 2"
→ [infra/roadmap.md](infra/roadmap.md)

---

## File Map

```
docs/
├── README.md                       ← you are here
├── stack.md                        ← technology decisions + rationale
│
├── backend/
│   ├── schema.prisma.md            ← Prisma schema (source of truth for data model)
│   ├── state-machines.md           ← state transition code for all objects
│   │
│   ├── api/
│   │   ├── web-api.md              ← Next.js API routes
│   │   └── ai-api.md               ← FastAPI AI service endpoints
│   │
│   ├── objects/                    ← one file per domain object
│   │   ├── README.md               ← object relationship map
│   │   ├── user.md
│   │   ├── demand-request.md
│   │   ├── product-listing.md
│   │   ├── match.md
│   │   ├── conversation.md
│   │   ├── offer.md
│   │   ├── order.md
│   │   ├── proof-asset.md
│   │   ├── dispute.md
│   │   └── notification.md
│   │
│   └── services/                   ← how each feature is implemented
│       ├── auth.md
│       ├── matching-engine.md
│       ├── matching-ai.md
│       ├── file-upload.md
│       ├── notifications.md
│       └── background-jobs.md
│
├── frontend/
│   ├── repo-structure.md           ← full directory tree + EC → Next.js screen map
│   ├── components.md               ← design tokens + shared components + screen layouts
│   └── realtime.md                 ← Supabase Realtime hooks
│
└── infra/
    ├── env.md                      ← all environment variables
    ├── dev-workflow.md             ← local setup + sprint order
    ├── deployment.md               ← Vercel + Supabase + AI service
    └── roadmap.md                  ← Phase 2 upgrade paths
```

---

## Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| TypeScript / Next.js | camelCase fields, PascalCase types | `buyerProfileId`, `DemandRequest` |
| Prisma schema | camelCase (auto-maps to snake_case) | `proofCompletenessScore` |
| PostgreSQL / Supabase | snake_case | `proof_completeness_score` |
| Python (AI service) | snake_case | `rerank_score`, `category_id` |
| API JSON bodies | camelCase | `{ "budgetMin": 100 }` |
| React components | PascalCase files | `MatchScore.tsx`, `StatusBadge.tsx` |
| Hooks | camelCase, `use` prefix | `useConversationMessages.ts` |

---

## Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Full-stack framework | Next.js 14 (App Router, TypeScript) |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth (magic link, .edu restriction) |
| File storage | Supabase Storage |
| Real-time | Supabase Realtime |
| Email | Resend + React Email |
| UI | shadcn/ui + Tailwind CSS |
| Client state | Zustand + TanStack Query |
| Background jobs | Supabase Edge Functions (Deno cron) |
| AI matching | Python · FastAPI · PyTorch · FAISS · BM25 |
| Deployment | Vercel (app) + Supabase (backend) + Docker/VPS (AI) |

Full rationale → [stack.md](stack.md)
