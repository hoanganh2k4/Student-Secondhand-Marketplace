# Development Workflow

---

## Prerequisites

- Docker + Docker Compose
- Node.js 20+
- Python 3.10+ (for AI service only)

---

## Local Setup

### 1. Start infrastructure services

```bash
# From repo root
docker compose up -d
```

This starts:
| Service | URL |
|---------|-----|
| PostgreSQL | `localhost:5432` |
| MinIO (S3 storage) | API `localhost:9000` · Console `http://localhost:9001` |
| Mailhog (email trap) | SMTP `localhost:1025` · UI `http://localhost:8025` |

MinIO credentials: `minioadmin / minioadmin`

---

### 2. Backend (NestJS)

```bash
cd backend

# First time: install dependencies
npm install

# Copy env and fill in JWT_SECRET (generate a random 256-bit string)
cp .env.example .env

# Generate Prisma client
npm run db:generate

# Run migrations (creates all tables)
npm run db:migrate

# Seed categories
npm run db:seed

# Start dev server (hot reload)
npm run dev
```

Backend runs at `http://localhost:4000/api`.

---

### 3. Frontend (Next.js)

```bash
cd frontend

# First time: install dependencies
npm install

# Copy env (no secrets needed — just points to backend)
cp .env.example .env.local

# Start dev server
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

### 4. Test the auth flow

1. Open `http://localhost:3000` → redirected to `/login`
2. Enter any email → click **Send magic link**
3. Open Mailhog at `http://localhost:8025` → click the magic link
4. Complete onboarding → land on dashboard

---

## AI Service (optional)

```bash
cd multimodal-matching

pip install -r requirements.txt

# First time: generate data + train
python3 scripts/generate_large_dataset.py
python3 scripts/build_index.py
python3 scripts/train_pipeline.py --stage all --epochs 20
python3 scripts/build_index.py --checkpoint checkpoints/biencoder/checkpoint_best.pt

# Start API
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

Service runs at `http://localhost:8000`.

---

## Prisma Workflow

All Prisma commands run from `backend/`:

```bash
# After editing prisma/schema.prisma
npm run db:migrate          # create + apply migration
npm run db:generate         # regenerate Prisma client

# After generate, sync schema to frontend (Prisma client used by frontend too)
cp prisma/schema.prisma ../frontend/prisma/schema.prisma
cd ../frontend && npm run db:generate

npm run db:studio           # browse DB in GUI (http://localhost:5555)
npm run db:migrate:deploy   # apply migrations in production
```

---

## Environment Variables

| File | Purpose |
|------|---------|
| `backend/.env` | JWT secret, DB URL, MinIO, Mailhog config |
| `frontend/.env.local` | Backend API URL only |

See [env.md](env.md) for full variable reference.

---

## Branch Strategy

```
main          ← production
dev           ← integration; PRs merge here first
feature/*     ← individual feature branches
fix/*         ← bug fixes
```

---

## Recommended Sprint Order

| Sprint | Deliverables |
|--------|-------------|
| 1 | Auth (magic link + password login, JWT, onboarding form) |
| 2 | Category seed + ProductListing creation + file upload to MinIO |
| 3 | DemandRequest creation + Matching engine v1 |
| 4 | Match records + notifications |
| 5 | Conversation + Verification stage |
| 6 | Clarification stage (real-time chat) |
| 7 | Offer + counter-offer + Order creation |
| 8 | Order confirmation + RatingReview |
| 9 | Dispute filing + Admin dashboard |
| 10 | Background jobs (expiry, auto-close) |
| 11 | Polish: rate limiting, empty states, skeleton loading |
| 12 | QA, performance, deployment hardening |

---

## Useful Commands

```bash
# Type-check frontend
cd frontend && npx tsc --noEmit

# Type-check backend
cd backend && npx tsc --noEmit

# Lint frontend
cd frontend && npm run lint

# Build backend
cd backend && npm run build

# Build frontend
cd frontend && npm run build
```
