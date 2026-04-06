# Stack Decision

> Scope: MVP. See [roadmap.md](infra/roadmap.md) for Phase 2 upgrade paths.

---

## Core Principle

Choose technologies that minimize operational complexity while supporting the full domain model (state machines, relational data, file uploads, real-time updates). For an MVP student project, this means a self-hosted local stack with zero cloud cost during development.

---

## Chosen Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Frontend | Next.js 14 (App Router, TypeScript) | UI only; calls NestJS API; large ecosystem |
| Backend API | NestJS 10 (TypeScript) | Standalone REST server; modular architecture; decorator-based |
| Database | PostgreSQL (Docker) | Fully local; no cloud dependency during dev |
| ORM | Prisma | Type-safe schema management; great migration tooling |
| Auth | JWT — magic link + password | Self-hosted; magic link via email; no external auth service |
| File Storage | MinIO (Docker, S3-compatible) | Fully local; same `@aws-sdk/client-s3` code works for R2/S3 in prod |
| Email | Mailhog (Docker) → Resend (prod) | Local email trap for dev; swap to Resend for production |
| Real-time | To be decided (Phase 2) | Socket.io or Supabase Realtime when needed |
| UI Components | shadcn/ui + Tailwind CSS | Unstyled primitives; fast to customize |
| State (client) | Zustand + TanStack Query | Zustand for UI state; TanStack Query for server state/caching |
| Matching Engine (rule-based) | NestJS service (synchronous) | Triggered on demand/listing creation |
| Matching Engine (AI/semantic) | Python · FastAPI · PyTorch · FAISS | Separate microservice; MultiStagePipeline; multilingual BiEncoder |
| Background Jobs | NestJS scheduled tasks (`@nestjs/schedule`) | Expiry jobs, inactivity auto-close |
| Deployment | VPS/Docker Compose (all services) | Single host for backend + DB + MinIO |

---

## What Is Explicitly Not Used in MVP

- **Supabase** — replaced by self-hosted PostgreSQL + MinIO + Mailhog
- **Redis** — not needed until rate limiting at scale
- **Separate WebSocket server** — deferred to Phase 2
- **Payment gateway** — out of scope per `rules.md`
- **LLM API calls in hot path** — replaced by local BiEncoder

---

## Related Docs

| Topic | File |
|-------|------|
| Repository & folder structure | [frontend/repo-structure.md](frontend/repo-structure.md) |
| Database schema (Prisma) | [backend/schema.prisma.md](backend/schema.prisma.md) |
| Auth implementation | [backend/services/auth.md](backend/services/auth.md) |
| Matching engine (rule-based) | [backend/services/matching-engine.md](backend/services/matching-engine.md) |
| AI matching microservice | [backend/services/matching-ai.md](backend/services/matching-ai.md) |
| State machines | [backend/state-machines.md](backend/state-machines.md) |
| API routes (web) | [backend/api/web-api.md](backend/api/web-api.md) |
| API routes (AI service) | [backend/api/ai-api.md](backend/api/ai-api.md) |
| File upload | [backend/services/file-upload.md](backend/services/file-upload.md) |
| Notifications | [backend/services/notifications.md](backend/services/notifications.md) |
| Background jobs | [backend/services/background-jobs.md](backend/services/background-jobs.md) |
| Environment variables | [infra/env.md](infra/env.md) |
| Deployment | [infra/deployment.md](infra/deployment.md) |
| Development workflow | [infra/dev-workflow.md](infra/dev-workflow.md) |
