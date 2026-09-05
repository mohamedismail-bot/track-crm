# 0001: Full-stack Next.js monolith over separate NestJS API + Next.js frontend

The initial scaffold used Hono + Prisma + SQLite API with a separate Next.js dashboard. An alternative proposal recommended NestJS + PostgreSQL as a standalone API with a Next.js frontend. We chose to build as a single Next.js App Router monolith with Prisma + PostgreSQL instead.

**Considered Options:**
- Separate NestJS API + Next.js frontend (spec recommendation)
- Python FastAPI + Next.js frontend
- Hono + Prisma (existing scaffold, evolving it)
- Next.js App Router full-stack monolith + Prisma + PostgreSQL

**Why Next.js monolith:**
- Single codebase, single deployment (Vercel). No API gateway, no CORS config, no two services to manage.
- Server Components + Server Actions give typed, zero-boilerplate data access without building a REST API layer first.
- Prisma + PostgreSQL is portable across local dev (SQLite) and production without schema changes.
- shadcn/ui + TanStack Table + @hello-pangea/dnd are all native React ecosystem, no framework impedance mismatch.
- NestJS module ceremony buys nothing for a CRUD-heavy internal tool — the "create module / create service / create controller" pattern adds boilerplate without domain benefit.
- The monorepo structure is preserved (`apps/web` for the Next.js app, `packages/shared` for shared types); an API can be extracted later if a separate mobile app or third-party integration needs a public REST/GraphQL surface.

**Consequences:**
- API routes live under `app/api/` and share the same Prisma client as server components. This is intentional coupling for speed, not accidental.
- If a public API is needed later (e.g., mobile app), extract `app/api/` into a standalone Hono/NestJS service and share types via `packages/shared`.
- File uploads and background jobs must be handled within Next.js runtime constraints (no long-running processes); use Vercel Blob for storage and a queue (e.g., Inngest or Trigger.dev) if background processing is needed.
