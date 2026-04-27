# WOW Refund v2 — Enterprise Refund Management Platform

Production-grade rebuild of the refund platform for multi-country, multi-brand operations with Power Automate email integration.

## Stack

- **Framework:** Next.js 15 (App Router, RSC, Server Actions)
- **API:** tRPC v11 (type-safe, end-to-end)
- **Database:** Prisma 6 + PostgreSQL (Neon managed) · SQLite for local dev
- **Auth:** Auth.js v5 (credentials) with admin-approval signup flow
- **UI:** shadcn/ui + Tailwind v4 + Radix primitives
- **Design:** Stripe-inspired visual language (Inter font, blue-tinted multi-layer shadows)
- **i18n:** next-intl (Arabic + English, full RTL support)
- **Email:** Power Automate webhooks (outbound + inbound replies)
- **Cache/Realtime:** Redis (Upstash) for notifications, exchange rates, rate limiting
- **Observability:** Sentry (errors + session replay)
- **Hosting:** Vercel (web) + Neon (database)
- **Monorepo:** Turborepo + pnpm workspaces

## Monorepo Layout

```
v2/
├── apps/
│   └── web/                    # Next.js 15 application
├── packages/
│   ├── db/                     # Prisma schema, client, migrations, seed
│   ├── ui/                     # Shared React components
│   ├── validators/             # Shared Zod schemas
│   └── config/                 # Shared TS / ESLint / Tailwind configs
├── DESIGN.md                   # Visual design system (Stripe-inspired)
├── ARCHITECTURE.md             # System architecture & flows
├── AGENTS.md                   # Per-project agent operating rules
└── README.md
```

## Quick Start

```bash
# From v2/ directory
pnpm install

# Generate Prisma client + apply migrations to local SQLite
pnpm db:generate
pnpm db:migrate           # dev: runs `prisma migrate dev` (creates DB if needed)
SEED_DEMO_CASES=1 pnpm db:seed

# Start dev server
pnpm dev
```

`pnpm db:push` is still available for fast schema iteration but real
production deploys must use `pnpm db:migrate:deploy` to apply versioned
migrations from `packages/db/prisma/migrations/`.

Local URL: <http://localhost:3000>

Default admin (from seed):
- Email: `admin@wow.local`
- Password: `admin123` (change immediately in production)

## Scripts

- `pnpm dev` — run all apps in dev mode
- `pnpm build` — build all packages + apps
- `pnpm lint` — lint all packages
- `pnpm typecheck` — type-check everything
- `pnpm test` — run all tests
- `pnpm db:studio` — open Prisma Studio
- `pnpm format` — format all files with Prettier

## Environment

See `apps/web/.env.example` for required variables. Minimal local setup works with the defaults (SQLite + stubbed Power Automate).

For production:
- `DATABASE_URL` — PostgreSQL connection string (Neon recommended)
- `AUTH_SECRET` — NextAuth secret (generate via `openssl rand -hex 32`)
- `POWER_AUTOMATE_WEBHOOK_URL` — outbound email webhook
- `POWER_AUTOMATE_SIGNING_SECRET` — HMAC shared secret
- `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — Redis for
  rate limiting and notifications. The auth rate limiter (5 attempts /
  5 min / IP / scope) silently falls back to in-memory when these are
  unset, but production deployments behind multiple replicas MUST set
  them so the limiter is consistent across instances.
- `SENTRY_DSN` — error + session replay (optional but recommended).

## Project Memory

- `HANDOFF.md` — current implementation state
- `ARCHITECTURE.md` — target architecture and flows
- `DESIGN.md` — design system reference
- `AGENTS.md` — agent operating rules

Read these before making durable changes.

## Status

**Phase 7+ — substantially complete.** 50+ routes verified 200 OK,
typecheck 100% across 4 packages, demo data seeded. Sprints A → E from
the HANDOVER roadmap (bulk operations, KPI sparklines, scheduled
reports, command palette, currencies/branches/batch-schedules/
automation-rules/backup admin pages, module on/off toggles, three-layer
design tokens, exchange-rate cache, Prisma indexes, AUDITOR/FINANCE
RBAC helpers, /api/auth rate limiting, real Prisma migrations) have
landed. Sprint F (Upstash, Sentry, Vercel + Neon) is gated on
owner-provided secrets.

For the authoritative current state, the 34-item roadmap, and the
next-Devin onboarding guide, **read [`/HANDOVER.md`](../HANDOVER.md)**
at the repo root first. Original phase roadmap is in
[`v2/HANDOFF.md`](./HANDOFF.md) and
[`v2/docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).
