# Gx-Portal

Next.js 15 + NestJS 10 monorepo portal for Genolyx analysis workflows.

## Architecture

```
Browser (Next.js :3000)
    ↓ REST + httpOnly cookie
NestJS BFF (:4000)   ← Auth + API proxy
    ↓ HTTP + X-API-Key
gx-daemon (:8010)    ← Unchanged FastAPI service
```

## Monorepo structure

```
gx-portal/
├── apps/
│   ├── web/     # Next.js 15, App Router
│   └── api/     # NestJS 10
└── packages/
    └── types/   # Shared TypeScript types (@gx-portal/types)
```

## Quick start (development)

### Prerequisites
- Node.js ≥ 18
- pnpm 8 (`npm install -g pnpm@8`)
- gx-daemon running on :8010

### Install

```bash
cd /home/ken/gx-portal
pnpm install
```

### Environment

```bash
cp apps/api/.env.example apps/api/.env
# Edit JWT_SECRET and DAEMON_URL

cp apps/web/.env.example apps/web/.env.local
```

### Run (dev)

```bash
# Terminal 1 — API
cd apps/api && npm run dev

# Terminal 2 — Web
cd apps/web && npm run dev
```

Open http://localhost:3000

Default credentials: **admin / admin1234** (change on first login!)

---

## Docker (production)

```bash
cp apps/api/.env.example apps/api/.env
# Set JWT_SECRET=<random>

docker compose up -d --build
```

Open http://localhost:8090

---

## Features

| Feature | Path |
|---------|------|
| Login | `/login` |
| Dashboard | `/dashboard` |
| Orders | `/orders` |
| Review (Variants, Dark Genes, PGx, Coverage/IGV, Report) | `/review/:orderId` |
| Admin – Clients | `/admin/clients` |
| Admin – Labs | `/admin/labs` |
| Admin – Users | `/admin/users` |

## Entity model

```
Client
  ├── type: Managing | Service
  ├── sequencing_data_method: Remote | Local
  ├── service_codes: string[]   ← allowed gx-daemon services
  └── Labs[]

Lab
  ├── client_id → Client
  └── service_codes: string[]

User
  ├── role: admin | client | lab
  ├── client_id? → Client   (if role = client)
  └── lab_id?    → Lab      (if role = lab)
```
