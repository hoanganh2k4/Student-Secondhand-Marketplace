# Backend Docs

```
backend/src/
├── auth/                ← JWT auth, bcrypt, guards, ws-token endpoint
├── users/               ← User CRUD, profile management
├── listings/            ← ProductListing CRUD + MinIO file upload
├── demands/             ← DemandRequest CRUD
├── matches/             ← Match creation, acknowledge (buyer/seller), open conversation
├── conversations/       ← Chat messages, stage advance, OrderRequest two-step flow
│   └── conversations.gateway.ts  ← Socket.IO /chat namespace (realtime)
├── orders/              ← Order confirm, cancel, dispute, review
│   └── orders.gateway.ts         ← Socket.IO /orders namespace (realtime)
├── notifications/       ← In-app notifications + email via Nodemailer SMTP
├── ai/                  ← Florence-2 vision analysis (fire-and-forget)
├── prisma/              ← PrismaService singleton
└── app.module.ts        ← Root module
```

**API base:** `http://localhost:4000/api` (global prefix)

**WebSocket namespaces:**
- `/chat` — realtime conversation messages + order events
- `/orders` — realtime order status updates

---

**Quick rule:** if you want to know *what* a domain concept is → `objects/`. If you want to know *how* something is implemented → `services/`.

---

## Module Summary

| Module | Key responsibilities |
|--------|----------------------|
| `AuthModule` | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `GET /auth/logout`, `GET /auth/ws-token` (returns JWT for WebSocket auth) |
| `UsersModule` | `GET/PATCH /users/me`, profile sub-resources |
| `ListingsModule` | CRUD for `ProductListing`, `POST /listings/:id/upload` (MinIO) |
| `DemandsModule` | CRUD for `DemandRequest` |
| `MatchesModule` | `GET /matches`, `POST /matches/:id/acknowledge` (buyer or seller) |
| `ConversationsModule` | Messages, stage advance, OrderRequest flow, WebSocket gateway |
| `OrdersModule` | Confirm, cancel, dispute, review, WebSocket gateway |
| `NotificationsModule` | `GET /notifications`, `PATCH /notifications/:id/read` |
| `AiModule` | Vision analysis via Florence-2 (called internally) |

---

## Auth

- **JWT** stored in `access_token` httpOnly cookie (7-day expiry)
- `JwtAuthGuard` on all protected routes (extracted from cookie)
- **WebSocket auth**: client calls `GET /api/auth/ws-token` → returns `{ token }` → passes as `socket.auth.token`
- Passwords hashed with bcrypt (10 rounds)
- No Supabase — all auth is custom NestJS + Prisma

## Database

- PostgreSQL via Prisma 6
- All IDs are `String @id @default(uuid())` (stored as `TEXT` in Postgres, not native UUID type)
- See [`schema.prisma.md`](schema.prisma.md) for full schema
