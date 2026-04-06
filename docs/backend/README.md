# Backend Docs

```
backend/
├── schema.prisma.md     ← Prisma schema — the single source of truth for all data
├── state-machines.md    ← TypeScript state transition code for every object
│
├── api/                 ← API contracts (request/response shapes, auth, error codes)
│   ├── web-api.md       ← Next.js API routes (all /api/* endpoints)
│   └── ai-api.md        ← FastAPI AI service (POST /search, GET /health)
│
├── objects/             ← Domain objects — fields, business rules, state diagram, API endpoints
│   └── README.md        ← object relationship map + index
│
└── services/            ← How each feature is implemented
    ├── auth.md          ← Supabase Auth, middleware, RLS policies
    ├── matching-engine.md ← Rule-based scoring: weights, normalizers, score computation
    ├── matching-ai.md   ← AI pipeline: BiEncoder, FAISS, BM25, reranker, training
    ├── file-upload.md   ← Proof asset upload: route, bucket policy, completeness score
    ├── notifications.md ← Email dispatch via Resend + in-app notification write
    └── background-jobs.md ← Cron jobs: expiry, auto-close conversations
```

**Quick rule:** if you want to know *what* a domain concept is → `objects/`. If you want to know *how* something is implemented → `services/`.
