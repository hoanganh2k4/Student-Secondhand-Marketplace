# Environment Variables

> File: `.env.local` (local dev) — never commit this file.
> Committed template: `.env.example` (all keys present, values empty).

---

## All Variables

```bash
# ─── SUPABASE ────────────────────────────────────────────────────────────────

# Public (safe to expose to browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Private (server-only — never expose to client)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ─── DATABASE ─────────────────────────────────────────────────────────────────

# Pooled connection — used by Prisma at runtime (via Supabase connection pooler)
DATABASE_URL=postgresql://postgres:[password]@db.your-project.supabase.co:6543/postgres?pgbouncer=true

# Non-pooled — used by Prisma Migrate (must bypass pgBouncer for DDL)
DIRECT_URL=postgresql://postgres:[password]@db.your-project.supabase.co:5432/postgres

# ─── EMAIL ────────────────────────────────────────────────────────────────────

RESEND_API_KEY=re_your_resend_api_key

# ─── APP CONFIG ───────────────────────────────────────────────────────────────

# Comma-separated list of allowed university email domains
ALLOWED_EMAIL_DOMAINS=university.edu,partner-university.edu

# Public app URL (used in email links)
NEXT_PUBLIC_APP_URL=https://yourmarketplace.com
NEXT_PUBLIC_APP_DOMAIN=yourmarketplace.com

# ─── STORAGE ──────────────────────────────────────────────────────────────────

SUPABASE_STORAGE_BUCKET=proof-assets

# ─── AI MATCHING SERVICE ──────────────────────────────────────────────────────

# URL of the multimodal-matching FastAPI service
# dev: http://localhost:8000  |  prod: http://your-vps-ip:8000 or https://ai.yourdomain.com
AI_SERVICE_URL=http://localhost:8000
```

---

## Variable Reference

| Variable | Public? | Used by | Purpose |
|----------|---------|---------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Client + Server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Client + Server | Supabase anon (RLS-enforced) key |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server only | Bypasses RLS for admin ops |
| `DATABASE_URL` | No | Prisma (runtime) | Pooled connection via pgBouncer |
| `DIRECT_URL` | No | Prisma (migrate) | Direct connection for migrations |
| `RESEND_API_KEY` | No | Server only | Email sending |
| `ALLOWED_EMAIL_DOMAINS` | No | Middleware + API | University email domain allowlist |
| `NEXT_PUBLIC_APP_URL` | Yes | Email templates | Base URL for links in emails |
| `NEXT_PUBLIC_APP_DOMAIN` | Yes | Email from address | Sender domain |
| `SUPABASE_STORAGE_BUCKET` | No | Upload route | Bucket name for proof assets |
| `AI_SERVICE_URL` | No | Server only | Base URL of the Python AI matching microservice |

---

## prisma/schema.prisma datasource block

Both `DATABASE_URL` and `DIRECT_URL` must be set for Prisma to work with Supabase's connection pooler:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

`url` uses the pooled connection (port 6543) for runtime queries.
`directUrl` uses the direct connection (port 5432) for `prisma migrate` commands which require a persistent connection.

---

## Supabase Edge Functions secrets

Edge Functions read secrets from `Deno.env.get()`. Set these in Supabase Dashboard under **Edge Functions → Secrets**, or via CLI:

```bash
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

These are automatically available in all Edge Functions and do not need to be in `.env.local`.
