# Backend — Student Secondhand Marketplace

NestJS 10 · PostgreSQL · Prisma · MinIO · Socket.IO  
Port: **4000** · Global prefix: `/api`

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 18 |
| PostgreSQL | ≥ 14 |
| MinIO | any (Docker recommended) |
| AI service (`multimodal-matching`) | running on port 8000 |

---

## Setup

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# App
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/marketplace

# JWT
JWT_SECRET=change-me-to-a-random-256-bit-secret
JWT_EXPIRES_IN=7d
MAGIC_LINK_EXPIRES_IN=15m

# Email (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=your@gmail.com

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=marketplace-assets
MINIO_USE_SSL=false
```

### 3. Start infrastructure (PostgreSQL + MinIO)

```bash
docker compose up -d postgres minio
```

Or if you're running them manually, make sure they're up before the next step.

### 4. Push database schema

```bash
npm run db:generate   # generate Prisma client
npx prisma db push    # push schema to DB (no migration file)
```

> For production use `npm run db:migrate:deploy` instead.

### 5. (Optional) Seed categories

```bash
npm run db:seed
```

### 6. Start the server

```bash
npm run dev   # watch mode — http://localhost:4000
```

---

## NPM Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | Start in watch mode (auto-restart on file change) |
| `npm run build` | Compile TypeScript → `dist/` |
| `npm run start` | Run compiled `dist/` |
| `npm run db:generate` | Regenerate Prisma client after schema changes |
| `npm run db:migrate` | Create a new migration file + apply |
| `npm run db:migrate:deploy` | Apply pending migrations (production) |
| `npm run db:seed` | Seed categories |
| `npm run db:studio` | Open Prisma Studio at http://localhost:5555 |

---

## API Docs (Swagger)

```
http://localhost:4000/api/docs
```

Authenticate: click **Authorize** → enter the JWT from `POST /api/auth/login` or from the `access_token` cookie.

---

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma      ← All models + enums
│   ├── migrations/        ← Migration history
│   └── seed.ts            ← Category seed data
└── src/
    ├── main.ts            ← Bootstrap: global prefix, validation pipe, Swagger
    ├── app.module.ts
    ├── auth/              ← Magic link + password auth, JWT, cookie
    ├── listings/          ← ProductListing CRUD + image upload (MinIO)
    ├── demands/           ← DemandRequest CRUD + trigger matching
    ├── matching/          ← Match engine: calls /score-pairs, saves MatchSnapshot
    ├── matches/           ← Match state machine, snapshot/interaction APIs
    ├── conversations/     ← Conversation CRUD, Socket.IO /chat gateway
    ├── offers/            ← Offer → counter-offer → accept flow
    ├── orders/            ← Order lifecycle, confirm, dispute, review
    ├── notifications/     ← Notification CRUD + Socket.IO /notifications gateway
    ├── ai/                ← Training data export, AI call/match logs
    ├── admin/             ← Admin-only: disputes, users, listings management
    ├── uploads/           ← Multipart file upload → MinIO
    ├── categories/        ← Category list
    └── prisma/            ← PrismaService (singleton)
```

---

## Key Flows

### Auth

```
POST /api/auth/register   → creates User + StudentProfile + BuyerProfile + SellerProfile
POST /api/auth/login      → returns JWT in httpOnly cookie
GET  /api/auth/me         → current user
```

Magic link: `POST /api/auth/magic-link` → email with token → `GET /api/auth/magic-link/verify?token=...`

### Create listing → matching runs automatically

```
POST /api/listings          → creates ProductListing
PATCH /api/listings/:id/publish  → status=active → triggers matching engine
  → calls /score-pairs on AI service (port 8000)
  → creates Match rows + MatchSnapshot for each candidate above threshold
```

### Match → conversation → order

```
POST /api/matches/:id/acknowledge  → buyer + seller both accept
  → Conversation opened automatically
POST /api/conversations/:id/messages   → chat
POST /api/orders (via OrderRequest flow)
PATCH /api/orders/:id/confirm-complete  → buyer or seller confirms
  → both confirmed → status=completed + interactions logged
```

---

## Environment: AI Service

The matching engine calls a FastAPI service on port 8000:

| Endpoint | Model | Used for |
|----------|-------|----------|
| `POST /score-pairs` | SentenceTransformer | Demand ↔ listing similarity |
| `POST /vision/extract` | Florence-2-base | Caption + OCR from listing images |
| `POST /vision/filter` | CLIP ViT-L/14 | Image relevance filter |

Start the AI service from the `multimodal-matching/` directory — see its README.

---

## Database

Models (key ones):

| Model | Table |
|-------|-------|
| User, StudentProfile, BuyerProfile, SellerProfile | users, *_profiles |
| DemandRequest | demand_requests |
| ProductListing | product_listings |
| Match | matches |
| MatchSnapshot | match_snapshots — LTR features per match |
| MatchInteraction | match_interactions — user action event stream |
| Conversation, Message | conversations, messages |
| Offer | offers |
| Order | orders |
| RatingReview, Dispute | rating_reviews, disputes |
| AiMatchLog, AiCallLog | ai_match_logs, ai_call_logs |

Full schema: `prisma/schema.prisma`
