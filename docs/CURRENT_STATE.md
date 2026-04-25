# Current Project State

Last saved state: after enterprise refund platform baseline implementation.

## What This Project Is

An internal refund operations portal for managing:

- Refund cases.
- Multi-component refunds.
- KNET and Aura external flows.
- Promo compensation.
- Approval batches.
- Email templates and logs.
- Admin configuration.
- Help desk records.
- Notifications and audit logs.

## Current Implementation Reality

The codebase is not a clean Next.js/NestJS monorepo yet. It is currently:

- React + Vite in `src/`.
- Express API in `server.ts`.
- Extra server modules in `server/`.
- Prisma schema in `prisma/schema.prisma`.
- PostgreSQL target database.

Treat current implementation as a working transitional app. Improve it in slices.

## Design Direction

The target UI is a calm enterprise operations system:

- Minimal.
- Dense but readable.
- Clear hierarchy.
- Low visual noise.
- Component-level refund clarity.
- Stripe/Google Admin/Notion inspired.

See `DESIGN.md`.

## Architecture Direction

The target backend should move toward:

```text
Controller -> Service -> Repository
```

Important service boundaries:

- Auth/RBAC service.
- Refund request service.
- Refund component service.
- Status rollup service.
- Email/template service.
- Automation service.
- Audit service.
- Notification service.

## Database Direction

Current Prisma schema was moved to PostgreSQL provider. A stricter normalized SQL target is documented in `docs/enterprise-schema.sql`.

Important target concept:

```text
refund_requests 1 -> many refund_components
```

Every component has its own status, payment type, amount, external reference, and optional ARN.

## Local Reference Knowledge

External repo/docs references are preserved under:

```text
docs/agent-references/
```

Do not delete them. Do not include them in TypeScript compilation. They are local knowledge for future agents.

## Commands

Install:

```bash
npm install
```

Validate:

```bash
npm run lint
npm run build
npx prisma validate
```

Generate Prisma Client:

```bash
npm run prisma:generate
```

Run dev:

```bash
npm run dev
```

Run production build:

```bash
npm run build
npm run start
```

Docker:

```bash
docker compose up --build
```

## Environment

Use `.env.example` as the template.

Required:

- `DATABASE_URL`
- `JWT_SECRET`
- `INTERNAL_WEBHOOK_SECRET`

Optional:

- `POWER_AUTOMATE_HELP_DESK_URL`
- `GEMINI_API_KEY`
- `APP_URL`

## Last Verified

These passed:

- TypeScript check via `npm run lint`.
- Production build via `npm run build`.
- Prisma schema validation with PostgreSQL URL.
- `node dist/server.mjs` starts.

Known warning:

- Vite reports a large JavaScript chunk. Future work should lazy-load large pages.
