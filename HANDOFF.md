# Project Handoff Memory

This file preserves the current state of the project for any future agent or developer. Start here before making changes.

## Current Goal

Build a world-class enterprise refund management web application with:

- Multi-source refund execution.
- Component-level refund lifecycle.
- PostgreSQL-backed normalized data model.
- Power Automate integrations.
- Enterprise control panel for templates, teams, workflows, automation, and logs.
- Premium operational UX inspired by Stripe Dashboard, Google Admin Console, and Notion.

## Current Stack

- Frontend: React, Vite, TypeScript, Tailwind CSS, shadcn-style UI, TanStack Query, lucide icons.
- Backend: Node.js, Express, Prisma.
- Database target: PostgreSQL.
- Automation target: Microsoft Power Automate via authenticated webhooks.

The user prefers a production-grade final direction with Next.js and NestJS, but the existing codebase is Vite + Express. Do not rewrite everything at once unless explicitly requested. Continue incrementally.

## Important Files

- `AGENTS.md`: project-level operating rules for coding agents.
- `DESIGN.md`: durable UI/UX rules and page-specific design guidance.
- `docs/enterprise-refund-platform.md`: target architecture, API structure, Power Automate logic, migration plan.
- `docs/enterprise-schema.sql`: normalized PostgreSQL target schema.
- `docs/agent-references/REFERENCE_SUMMARY.md`: summary of downloaded external references.
- `docs/agent-references/`: local copies of the external repos/docs the user asked to learn from.
- `src/pages/RefundExecutionDashboard.tsx`: redesigned component-level refund execution desk.
- `src/lib/api.ts`: shared axios client with token handling.

## External References Saved Locally

The following references are already downloaded and should be reused instead of re-learning from the web:

- `docs/agent-references/gitagent/`
- `docs/agent-references/antigravity-skills/`
- `docs/agent-references/vercel-labs-skills/`
- `docs/agent-references/ui-ux-pro-max-skill/`
- `docs/agent-references/awesome-design-md/`
- `docs/agent-references/stitch-design-modes/`

These are intentionally stored as local reference knowledge, not runtime app code. TypeScript excludes them via `tsconfig.json`.

## Changes Already Implemented

- Added project instruction memory: `AGENTS.md`.
- Added project design system memory: `DESIGN.md`.
- Downloaded and preserved the user's requested external references under `docs/agent-references/`.
- Added `docs/agent-references/REFERENCE_SUMMARY.md`.
- Added enterprise target architecture and migration plan in `docs/enterprise-refund-platform.md`.
- Added normalized PostgreSQL target schema in `docs/enterprise-schema.sql`.
- Switched Prisma provider from SQLite to PostgreSQL.
- Updated `.env.example` for PostgreSQL, `JWT_SECRET`, and `INTERNAL_WEBHOOK_SECRET`.
- Updated Docker Compose to use PostgreSQL and environment-provided secrets.
- Changed production build output from `dist/server.cjs` to `dist/server.mjs`.
- Added Prisma generation to `npm run build`.
- Added `src/lib/api.ts` shared API client.
- Removed global axios interceptor from `src/App.tsx`; new work should use `src/lib/api.ts`.
- Added missing React type packages.
- Excluded `docs/agent-references` from TypeScript compilation.
- Hardened JWT secret behavior in production.
- Added `authenticateInternal` middleware for Power Automate/internal endpoints.
- Protected internal endpoints:
  - `POST /api/internal/generate-approval-batch`
  - `POST /api/internal/cases/batch-drafts`
  - `POST /api/internal/cases/external-approve`
- Rebuilt `RefundExecutionDashboard` as a component-level smart execution table.

## Verification Status

The following passed after the latest implementation:

```bash
npm run lint
npm run build
npx prisma validate
node dist/server.mjs
```

Runtime note: `node dist/server.mjs` starts successfully. A live PostgreSQL database is still needed for real data operations.

## Known Remaining Work

High priority:

- Create real Prisma migrations for PostgreSQL instead of relying on `db push`.
- Split `server.ts` into route modules, services, and repositories.
- Replace duplicated page-level axios calls with `src/lib/api.ts`.
- Implement real RBAC tables and permission checks, not only `ADMIN` and `AGENT`.
- Add pagination to list endpoints.
- Add proper Power Automate payload validation and retry/escalation records.
- Add WebSocket or SSE notifications.

Medium priority:

- Code-split large frontend pages to reduce the current large bundle warning.
- Normalize visual tokens in `src/index.css`.
- Redesign Enterprise Control into modular settings pages.
- Improve Dashboard and Order Details with component-level payment breakdown and timeline.
- Add automated tests for refund status rollup logic.

Security priority:

- Never commit real `.env` files.
- Require strong `JWT_SECRET` and `INTERNAL_WEBHOOK_SECRET` in production.
- Protect all automation callbacks with `x-internal-secret`.
- Remove any demo-only auto-admin bootstrap before real production deployment.

## How To Continue

1. Read `HANDOFF.md`.
2. Read `AGENTS.md` and `DESIGN.md`.
3. Check `docs/enterprise-refund-platform.md` for the target architecture.
4. Check `docs/enterprise-schema.sql` before changing database shape.
5. Use `docs/agent-references/` for local reference knowledge.
6. Run `npm run lint` and `npm run build` before declaring work complete.

## Recommended Next Task

Implement the next enterprise hardening slice:

1. Move refund status rollup into a shared service.
2. Add a bulk component endpoint:
   `POST /api/refund-components/bulk-mark-refunded`
3. Refactor `RefundExecutionDashboard` to call that endpoint.
4. Add audit logs for every component status change.
5. Add pagination/filter query params to `/api/cases` or create `/api/refund-components`.
