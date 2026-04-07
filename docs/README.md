# Developer Docs — Student Secondhand Marketplace

> **Source of truth for all technical implementation.**
> Business rules → [`rules.md`](../rules.md) · Design reference → [`EC/src.zip`](../EC/src.zip)

---

## Architecture

```
Browser (Next.js 16 App Router)
    │
    ▼
Next.js Dev Server (port 3000)
    │  proxy.ts — auth guard (access_token cookie)
    │
    ▼
NestJS REST API (port 4000, prefix /api)
    │
    ├── PostgreSQL (Docker)
    │     └── Prisma ORM (backend/prisma/schema.prisma)
    │
    ├── MinIO (Docker, S3-compatible)
    │     └── bucket: proof-assets
    │
    ├── Resend (email — magic links, notifications)
    │     └── Dev: Mailhog SMTP trap (localhost:8025)
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
→ [infra/deployment.md](infra/deployment.md) — VPS Docker Compose deployment

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
→ [backend/api/web-api.md](backend/api/web-api.md) — all NestJS REST endpoints (demands, listings, matches, conversations, orders, admin)  
→ [backend/api/ai-api.md](backend/api/ai-api.md) — FastAPI AI service endpoints

### "I need to understand how a feature works"

| Feature | File |
|---------|------|
| Authentication (JWT, magic link, password) | [services/auth.md](backend/services/auth.md) |
| Rule-based matching engine | [services/matching-engine.md](backend/services/matching-engine.md) |
| AI matching pipeline (BiEncoder, FAISS, BM25) | [services/matching-ai.md](backend/services/matching-ai.md) |
| Proof asset upload + MinIO storage | [services/file-upload.md](backend/services/file-upload.md) |
| Email + in-app notifications | [services/notifications.md](backend/services/notifications.md) |
| Background cron jobs (expiry, auto-close) | [services/background-jobs.md](backend/services/background-jobs.md) |

### "I need to build or change a frontend screen"
→ [frontend/repo-structure.md](frontend/repo-structure.md) — full directory tree, route map, EC → Next.js screen mapping  
→ [frontend/components.md](frontend/components.md) — design tokens, shared components, all screen layouts  
→ [frontend/realtime.md](frontend/realtime.md) — real-time updates (Phase 2 — deferred)

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
│   │   ├── web-api.md              ← NestJS REST API routes
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
│   └── realtime.md                 ← real-time (Phase 2 — deferred)
│
└── infra/
    ├── env.md                      ← all environment variables
    ├── dev-workflow.md             ← local setup + sprint order
    ├── deployment.md               ← VPS Docker Compose deployment
    └── roadmap.md                  ← Phase 2 upgrade paths
```

---

## Naming Conventions

| Layer | Convention | Example |
|-------|-----------|---------|
| TypeScript / NestJS | camelCase fields, PascalCase types | `buyerProfileId`, `DemandRequest` |
| Prisma schema | camelCase (auto-maps to snake_case) | `proofCompletenessScore` |
| PostgreSQL | snake_case | `proof_completeness_score` |
| Python (AI service) | snake_case | `rerank_score`, `category_id` |
| API JSON bodies | camelCase | `{ "budgetMin": 100 }` |
| React components | PascalCase files | `MatchScore.tsx`, `StatusBadge.tsx` |
| Hooks | camelCase, `use` prefix | `useConversationMessages.ts` |

---

## Stack at a Glance

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 16 (App Router, TypeScript) |
| Backend API | NestJS 10 (TypeScript, port 4000) |
| Database | PostgreSQL (Docker) |
| ORM | Prisma 6 |
| Auth | JWT — magic link (Resend) + password |
| File storage | MinIO (Docker, S3-compatible) |
| Email (dev) | Mailhog SMTP trap |
| Email (prod) | Resend |
| Real-time | Phase 2 (Socket.io or SSE) |
| UI | shadcn/ui + Tailwind CSS |
| Client state | Zustand + TanStack Query |
| Background jobs | NestJS `@nestjs/schedule` |
| AI matching | Python · FastAPI · PyTorch · FAISS · BM25 |
| Deployment | VPS / Docker Compose (all services) |

Full rationale → [stack.md](stack.md)
