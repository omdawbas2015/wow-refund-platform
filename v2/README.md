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

# Generate Prisma client + push schema to local SQLite
pnpm db:generate
pnpm db:push
pnpm db:seed

# Start dev server
pnpm dev
```

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
- `REDIS_URL` — Upstash Redis URL (for notifications + cache)

## Project Memory

- `HANDOFF.md` — current implementation state
- `ARCHITECTURE.md` — target architecture and flows
- `DESIGN.md` — design system reference
- `AGENTS.md` — agent operating rules

Read these before making durable changes.

## Status

**Phase 1** — Foundation (complete)
- [x] Monorepo scaffold (Turborepo + pnpm workspaces)
- [x] Prisma schema (40+ tables across 19 sections) + idempotent seed
- [x] Auth flows: login, signup-with-approval, OTP forgot-password, first-login set password
- [x] Admin panel skeleton (users, pending approvals with role + country assignment)
- [x] Design system base components (Stripe tokens, Inter, blue-tinted shadows)
- [x] i18n setup (AR + EN + RTL via next-intl)
- [x] Power Automate email dispatcher (stubbed in dev, webhook-ready for prod)
- [x] Inbound webhook route (`/api/webhooks/power-automate`)

See `docs/ARCHITECTURE.md` for the full roadmap and phase breakdown.
