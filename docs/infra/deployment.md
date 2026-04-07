# Deployment

> All services run on a single VPS via Docker Compose.
> CI/CD: GitHub Actions (run migrations; build + push images).
> No Vercel, no Supabase, no serverless functions.

---

## Stack Topology

```
Browser
  └── Nginx (reverse proxy, port 443 / 80)
        ├── Next.js frontend     (port 3000)  — SSR + static pages
        └── NestJS REST API      (port 4000)  — /api prefix
              ├── PostgreSQL     (port 5432)  — Prisma ORM
              ├── MinIO          (port 9000)  — proof-assets bucket
              ├── Mailhog / Resend             — transactional email
              └── AI Matching Service (port 8000) — FastAPI + FAISS
```

---

## docker-compose.yml (production)

```yaml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_DB:       student_marketplace
      POSTGRES_USER:     postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data

  minio:
    image: minio/minio
    restart: always
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER:     ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"   # API (private — only backend accesses this)
      - "9001:9001"   # Console (restrict access in prod)

  backend:
    build: ./backend
    restart: always
    depends_on: [postgres, minio]
    env_file: ./backend/.env
    ports:
      - "4000:4000"

  frontend:
    build: ./frontend
    restart: always
    depends_on: [backend]
    env_file: ./frontend/.env.local
    ports:
      - "3000:3000"

  ai:
    build: ./multimodal-matching
    restart: always
    ports:
      - "8000:8000"
    volumes:
      - ./multimodal-matching/models:/app/models
      - ./multimodal-matching/checkpoints:/app/checkpoints

volumes:
  postgres_data:
  minio_data:
```

---

## First Deployment Checklist

### 1. Provision VPS

- Minimum: 4 vCPU, 8 GB RAM, 80 GB SSD (AI model weights ~3 GB)
- Install Docker + Docker Compose
- Open ports: 80, 443, 22 (SSH)

### 2. Clone Repository

```bash
git clone https://github.com/your-org/student-marketplace.git
cd student-marketplace
```

### 3. Configure Environment Files

```bash
cp backend/.env.example backend/.env
# Edit: DATABASE_URL, JWT_SECRET, MINIO_*, ALLOWED_EMAIL_DOMAINS, RESEND_API_KEY, APP_URL

cp frontend/.env.example frontend/.env.local
# Edit: NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

### 4. Run Prisma Migrations

```bash
docker compose run --rm backend npx prisma migrate deploy
docker compose run --rm backend npx prisma db seed
```

### 5. Create MinIO Bucket

```bash
docker compose up -d minio
# Wait ~5 seconds for MinIO to start, then:
docker compose exec minio mc alias set local http://localhost:9000 $MINIO_ACCESS_KEY $MINIO_SECRET_KEY
docker compose exec minio mc mb local/proof-assets
docker compose exec minio mc anonymous set download local/proof-assets
```

### 6. Train AI Model (first time only)

```bash
docker compose run --rm ai python3 scripts/generate_large_dataset.py
docker compose run --rm ai python3 scripts/build_index.py
docker compose run --rm ai python3 scripts/train_pipeline.py --stage all --epochs 20
docker compose run --rm ai python3 scripts/build_index.py \
  --checkpoint checkpoints/biencoder/checkpoint_best.pt
```

### 7. Start All Services

```bash
docker compose up -d
```

### 8. Configure Nginx

```nginx
# /etc/nginx/sites-available/student-marketplace
server {
    listen 443 ssl;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy

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

      - run: cd backend && npm ci

      - name: Apply database migrations
        run: cd backend && npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}

  deploy:
    name: Deploy to VPS
    needs: migrate
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: SSH deploy
        uses: appleboy/ssh-action@v1
        with:
          host:     ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key:      ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/student-marketplace
            git pull origin main
            docker compose build backend frontend
            docker compose up -d backend frontend
```

Add `DATABASE_URL`, `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` to GitHub repository secrets.

---

## Domain and Email Setup

1. Point `yourdomain.com` A record → VPS IP.
2. Point `api.yourdomain.com` A record → VPS IP.
3. Install SSL with Certbot: `certbot --nginx -d yourdomain.com -d api.yourdomain.com`
4. In Resend: verify your sending domain, add DNS records.
5. Update `APP_URL=https://yourdomain.com` in `backend/.env`.
6. Update `NEXT_PUBLIC_API_URL=https://api.yourdomain.com/api` in `frontend/.env.local`.

---

## AI Matching Service

The AI service requires persistent memory for FAISS index + model weights (~3 GB). It runs as a Docker container alongside the other services.

To retrain after new listings data accumulates:

```bash
docker compose exec ai python3 scripts/build_index.py
```

No full retraining needed — only the FAISS index needs to be rebuilt.
