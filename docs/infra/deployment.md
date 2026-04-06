# Deployment

> App hosting: Vercel
> Backend services: Supabase (database, auth, storage, realtime, edge functions)
> AI service: Docker on VPS / dedicated GPU server (see section below)
> CI/CD: GitHub Actions (migrations only; Vercel handles app deployment automatically)

---

## Stack Topology

```
Browser
  └── Vercel
        ├── Next.js pages (SSR + static)
        ├── Next.js API routes (serverless functions)
        └── Edge middleware (auth guard, domain check)
              ├── Supabase Auth       — magic link, session management
              ├── Supabase Database   — PostgreSQL via Prisma (connection pooler)
              ├── Supabase Storage    — proof asset files (bucket: proof-assets)
              ├── Supabase Realtime   — live updates for conversations + notifications
              └── AI Matching Service — Docker container on VPS/GPU server
                    POST /search      — MultiStagePipeline (FAISS+BM25+BiEncoder)
              └── Supabase Functions  — background cron jobs (expiry, auto-close)
```

---

## First Deployment Checklist

### 1. Supabase Project Setup

```bash
# Install Supabase CLI
npm install -g supabase

# Login
supabase login

# Link to your Supabase project
supabase link --project-ref your-project-ref
```

- Create a new project at supabase.com.
- Note your project URL, anon key, and service role key.
- In Auth > Settings: set "Restrict signups" to allowed email domains.
- In Auth > Email: enable "Confirm email" (magic link delivery).

### 2. Database Migrations

```bash
# Apply all migrations to production
DATABASE_URL="postgresql://..." DIRECT_URL="postgresql://..." npx prisma migrate deploy
```

Run this locally the first time pointing at the production database. After that, run via CI (see below).

### 3. Supabase Storage

In Supabase Dashboard > Storage:
- Create a bucket named `proof-assets`.
- Set to public (for reads).
- Apply the insert policy: users can only upload to their own `user_id/` path prefix (see [backend/services/file-upload.md](../backend/services/file-upload.md)).

### 4. Supabase Realtime

In Supabase SQL Editor, run:

```sql
ALTER TABLE messages          REPLICA IDENTITY FULL;
ALTER TABLE evidence_requests REPLICA IDENTITY FULL;
ALTER TABLE notifications     REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE evidence_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

### 5. Vercel Setup

- Connect your GitHub repository to Vercel.
- Set all environment variables in Vercel Dashboard > Project > Settings > Environment Variables.
- Vercel auto-deploys on every push to `main`.

### 6. Edge Functions

```bash
# Deploy all background job functions
supabase functions deploy expire-demands
supabase functions deploy expire-listings
supabase functions deploy expire-offers
supabase functions deploy close-inactive-conversations

# Set required secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

In Supabase Dashboard > Edge Functions: set cron schedules per [background-jobs.md](../backend/services/background-jobs.md).

---

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Migrate and Deploy

on:
  push:
    branches: [main]

jobs:
  migrate:
    name: Run Prisma Migrations
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - run: npm ci

      - name: Apply database migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          DIRECT_URL:   ${{ secrets.DIRECT_URL }}

  # Note: Vercel deployment is triggered automatically by GitHub integration.
  # No explicit deploy step needed here.
```

Add `DATABASE_URL` and `DIRECT_URL` to GitHub repository secrets (Settings > Secrets and Variables > Actions).

---

## Vercel Configuration

```json
// vercel.json (only needed if customizing defaults)
{
  "functions": {
    "app/api/**": {
      "maxDuration": 30
    }
  }
}
```

The matching engine runs synchronously in the API route. `maxDuration: 30` gives it 30 seconds before Vercel times out the serverless function. This is sufficient for MVP with a small dataset.

---

## Domain and Email Setup

1. Add your custom domain in Vercel Dashboard > Domains.
2. In Resend: verify your sending domain (add DNS records).
3. Set `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_APP_DOMAIN` to your final domain.
4. In Supabase Auth: update "Site URL" to your production domain.
5. In Supabase Auth: add your production domain to "Redirect URLs" for magic link callbacks.

---

## AI Matching Service Deployment

The AI service (`multimodal-matching/`) is a FastAPI app that requires persistent memory for FAISS index + model weights (~3GB). It cannot run on Vercel serverless. Deploy on a VPS or GPU server.

### Local dev

```bash
cd multimodal-matching
uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload
```

### Docker (production)

```dockerfile
# multimodal-matching/Dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
CMD ["uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
```

```bash
docker build -t ai-matching .
docker run -d \
  -p 8000:8000 \
  -v $(pwd)/models:/app/models \
  -v $(pwd)/checkpoints:/app/checkpoints \
  --name ai-matching \
  ai-matching
```

### Training before deploy

```bash
python3 scripts/generate_large_dataset.py
python3 scripts/build_index.py
python3 scripts/train_pipeline.py --stage all --epochs 20
python3 scripts/build_index.py \
  --checkpoint checkpoints/biencoder/checkpoint_best.pt
```

### Environment variable

Set in Vercel + `.env.local`:

```bash
AI_SERVICE_URL=https://ai.yourdomain.com   # or http://your-vps-ip:8000
```
