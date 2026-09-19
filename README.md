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

Runs on **:8090** and can sit alongside local dev (`:3000` / `:4000`).

```bash
# Optional: root .env for compose (JWT_SECRET, CORS_ORIGINS, …)
# cp apps/api/.env.example .env   # then edit JWT_SECRET

docker compose up -d --build
```

| Env | URL |
|-----|-----|
| Development | http://localhost:3000 |
| Production (Docker) | http://localhost:8090 |

Prod uses its own SQLite volume (`gx-portal-data`); default login is still **admin / admin1234** on first boot.

---

## GX Portal inbound API

The **external GX order portal** calls **this** NestJS API (not gx-daemon).

Production (nginx): `https://service.genolyx.com/api/v1/...`

| Method | Path | Role |
|---|---|---|
| `GET` | `/v1/order-schema?service_code=CARRIER` | Create Order field schema |
| `POST` | `/v1/orders` | Accept GX `order_id`, download FASTQ in background, start gx-daemon |
| `POST` | `/v1/orders/{order_id}/send-report` | Portal UI — send latest `Report_*.pdf` to `callback.report_url` |

Auth for schema/create: `Authorization: Bearer {GX_EXTERNAL_API_KEY}` (or `EXTERNAL_API_KEY`).  
PDF callback to GX: `GX_CALLBACK_API_KEY`.

Orders list **Download field JSON** exports the same schema GX can import. `order_id`, hospital/doctor/MRN, `sample_id`, and FASTQ stay outside `service_data`.

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
  ├── order_prefix: string     ← 2-letter code in order IDs (e.g. GX)
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

Portal order registry (portal.db)
  ├── order_id (PK)           ← canonical ID, same key in gx-daemon
  ├── client_id → Client
  ├── legacy_order_id         ← original ID after migration (shown as Description)
  └── service_code

Order ID format: {Service}{Client}{YYMM}{seq4}
  CS / SN / WE / HS + GX + 2607 + 0001  →  CSGX26070001
```
