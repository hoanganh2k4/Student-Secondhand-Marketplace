# Environment Variables

> Backend: `backend/.env` — never commit this file.
> Frontend: `frontend/.env.local` — never commit this file.
> Committed templates: `backend/.env.example` and `frontend/.env.example` (all keys present, values empty).

---

## Backend (`backend/.env`)

```bash
# ─── DATABASE ─────────────────────────────────────────────────────────────────

# PostgreSQL connection string (Docker in dev, managed DB in prod)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/student_marketplace

# ─── AUTH ─────────────────────────────────────────────────────────────────────

# Random 256-bit secret for signing JWTs
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your-256-bit-secret-here

# JWT expiry (default: 7d)
JWT_EXPIRES_IN=7d

# Comma-separated list of allowed university email domains
ALLOWED_EMAIL_DOMAINS=university.edu,partner-university.edu

# ─── EMAIL ────────────────────────────────────────────────────────────────────

# Dev: Mailhog SMTP (no auth needed)
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_FROM=noreply@yourmarketplace.com

# Prod: set RESEND_API_KEY instead of SMTP_* variables
# RESEND_API_KEY=re_your_resend_api_key

# ─── MINIO (S3-compatible file storage) ───────────────────────────────────────

MINIO_ENDPOINT=http://localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=proof-assets

# ─── APP CONFIG ───────────────────────────────────────────────────────────────

# Public URL of the frontend app (used in email link templates)
APP_URL=http://localhost:3000

# NestJS port (default: 4000)
PORT=4000

# ─── AI MATCHING SERVICE ──────────────────────────────────────────────────────

# URL of the multimodal-matching FastAPI service
# dev: http://localhost:8000  |  prod: http://your-vps-ip:8000
AI_SERVICE_URL=http://localhost:8000
```

---

## Frontend (`frontend/.env.local`)

```bash
# URL of the NestJS backend (used in server components + route handlers)
NEXT_PUBLIC_API_URL=http://localhost:4000/api
```

The frontend does **not** need any auth secrets — it reads the `access_token` via httpOnly cookie automatically.

---

## Variable Reference

### Backend

| Variable | Required | Used by | Purpose |
|----------|----------|---------|---------|
| `DATABASE_URL` | Yes | Prisma | PostgreSQL connection string |
| `JWT_SECRET` | Yes | `JwtModule` | Signs and verifies access tokens |
| `JWT_EXPIRES_IN` | No | `JwtModule` | Token TTL (default `7d`) |
| `ALLOWED_EMAIL_DOMAINS` | Yes | `AuthService` | University domain allowlist |
| `SMTP_HOST` | Yes (dev) | `MailService` | Mailhog host in dev |
| `SMTP_PORT` | Yes (dev) | `MailService` | Mailhog SMTP port |
| `SMTP_FROM` | Yes | `MailService` | Sender address |
| `RESEND_API_KEY` | Yes (prod) | `MailService` | Resend transactional email |
| `MINIO_ENDPOINT` | Yes | `UploadService` | MinIO API URL |
| `MINIO_ACCESS_KEY` | Yes | `UploadService` | MinIO access key |
| `MINIO_SECRET_KEY` | Yes | `UploadService` | MinIO secret key |
| `MINIO_BUCKET` | Yes | `UploadService` | Bucket name for proof assets |
| `APP_URL` | Yes | Email templates | Base URL for links in emails |
| `PORT` | No | NestJS bootstrap | HTTP port (default 4000) |
| `AI_SERVICE_URL` | Yes | `MatchingService` | Base URL of the Python AI microservice |

### Frontend

| Variable | Required | Used by | Purpose |
|----------|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | Yes | Server components, route handlers | NestJS backend base URL |

---

## Prisma datasource block (`backend/prisma/schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

Only one URL is needed — no pgBouncer in local Docker setup.

---

## Docker Compose Services

All infrastructure services are defined in `docker-compose.yml` at the repo root:

| Service | Env vars used | Default values |
|---------|--------------|----------------|
| PostgreSQL | `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` | `student_marketplace`, `postgres`, `postgres` |
| MinIO | `MINIO_ROOT_USER`, `MINIO_ROOT_PASSWORD` | `minioadmin`, `minioadmin` |
| Mailhog | none (no auth) | SMTP port 1025, UI port 8025 |
