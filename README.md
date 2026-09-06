# Parishia Smart

Creator outreach, tracking, and gifting workspace: a dashboard, API backend, and mobile app for tracking creators, engagements, deliverables, and gifts.

## Packages

| Package                  | Path             | Description                                  |
| ------------------------ | ---------------- | -------------------------------------------- |
| `@parishia-smart/api`    | `apps/api`       | Hono API server + Prisma + SQLite/Postgres   |
| `web`                    | `apps/web`       | Next.js dashboard                            |
| `mobile`                 | `apps/mobile`    | React Native (Expo) mobile app               |
| `@parishia-smart/shared` | `packages/shared`| Shared types                                 |

## Requirements

- Node.js 20+ (this repo was set up with Node 24)
- pnpm (`corepack enable`)

## Setup

```bash
corepack enable
pnpm install
```

## Run the API

```bash
pnpm --filter @parishia-smart/api db:generate
pnpm --filter @parishia-smart/api db:migrate   # creates apps/api/prisma/dev.db
pnpm --filter @parishia-smart/api db:seed      # sample data
pnpm --filter @parishia-smart/api dev          # http://localhost:4000
```

To use Postgres instead of SQLite:

1. Create a Postgres database.
2. In `apps/api/prisma/schema.prisma`, change `provider = "sqlite"` → `"postgresql"`.
3. Set `DATABASE_URL="postgresql://user:pass@localhost:5432/parishiasmart"` in `apps/api/.env`.
4. Run `pnpm --filter @parishia-smart/api db:migrate`.

## Run the dashboard

```bash
pnpm --filter web dev    # http://localhost:3000
```

The dashboard reads the API at `http://localhost:4000` (override with the `NEXT_PUBLIC_API_URL` env var).

## Run the mobile app

```bash
pnpm --filter mobile start   # then press i / a / w, or scan QR with Expo Go
```

The mobile app expects the API at `http://localhost:4000`. When testing on a physical device,
set `API_BASE` in `apps/mobile/src/api.ts` to your machine's LAN IP.

## API endpoints

- `GET /health`
- `GET/POST /api/contacts`, `GET/PATCH/DELETE /api/contacts/:id`
- `GET/POST /api/deals`, `GET/PATCH/DELETE /api/deals/:id`
- `GET/POST /api/activities`, `DELETE /api/activities/:id`
- `GET /api/stats` — dashboard stats