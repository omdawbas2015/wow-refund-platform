# WOW Refund Platform — HANDOVER for the next Devin session

> **Read this file first.** It is self-contained: state of the system, what is done, what is missing, how to resume. Last updated 2026-04-27.
>
> **Active branch:** `devin/1777249813-continue-roadmap` (HEAD = `fc01778`, 64 commits ahead of `main`).
> **Source of truth:** v2/ directory only. The Vite/Express code at the repo root is **legacy and frozen** — do not touch it.

---

## 0. Operating contract (READ BEFORE TOUCHING ANYTHING)

The owner's instructions, restated verbatim from prior sessions:

1. **Never ask questions.** Work autonomously until your credit runs out.
2. **Every change = a separate git commit, pushed to GitHub immediately.** The owner switches accounts and continues from `git log` on GitHub. Lose a commit = lose work.
3. **Always start from the latest commit on GitHub** (`git pull` before working).
4. **`/cases` and `/promo` UI must not change.** The owner has spent multiple sessions polishing both — preserve their visual appearance and directory structure exactly. Backend logic is fine to extend; UI files (`page.tsx`, components in those folders, layouts) are off-limits.
5. **No screenshots / decorative work** — focus credit on system, planning, execution.
6. **Don't open PRs unless asked.** The owner reviews directly via GitHub commits.
7. **Don't merge to `main`.** The owner does that.
8. **Never commit `dev.db`, `.env*`, or anything under `node_modules`/`.next`.**

---

## 1. What is this project?

WOW Refund is an **enterprise refund-management platform** for a multi-country restaurant/retail group. Three actors:

- **Agents** raise refund cases per customer (one case can have multiple components: KNET / Apple Pay / Credit Card / Aura points).
- **Country managers** approve refunds via email or magic-link.
- **Refund-operations / finance** execute the actual refunds via daily KNET batch (Excel → Finance) and Aura batch (Aura team).

Adjacent modules: customer **promo compensation**, internal **stores communication**, **fraud signals**, **SLA tracking**, **scheduled cron sweeps**, **reports + Excel exports**.

---

## 2. Current state (verified 2026-04-27)

- **50 major routes tested** — every page returns HTTP 200 OK on `http://localhost:3000` after `pnpm dev`.
- **`pnpm typecheck` passes 100%** (4/4 packages: db, ui, validators, web).
- **Demo data seeded:** 6 users (different roles), 8 brands, 15 refund cases across all statuses, 17 components, 1 approval batch, 1 KNET batch, 1 Aura batch, 2 promo configs + 10 promo codes, 7 notifications.

### Login

- **Admin:** `admin@wow.local` / `admin123`
- **Country Manager (KW):** `manager.kw@wow.local` / `demo1234`
- **Agent (KW):** `agent.kw@wow.local` / `demo1234`
- **Agent (SA):** `agent.sa@wow.local` / `demo1234`
- **Operations:** `ops@wow.local` / `demo1234`

These are dev-only seeded accounts. Change them before going to production.

### Pages that exist and work

```
Public:        /[locale]/{login,signup,forgot,reset,set-password}
Public link:   /[locale]/approve/[token]                         (manager magic-link approval)

Dashboard:     /, /cases, /cases/new, /cases/[caseId]
Promo:         /promo, /promo/allocate, /promo/history,
               /promo/configs/new, /promo/configs/[id], /promo/pools/[poolId]
Operations:    /operations,
               /operations/{approvals,knet,aura}/new,
               /operations/{approvals,knet,aura}/[id]
Reports:       /reports, /reports/{cases,refunds,sla,agents,countries,audit,emails}
Notifications: /notifications
Search:        /search
Customers:     /customers/[email]
Help desk:     /help-desk/stores
User:          /profile, /changelog
Admin (16):    /admin, /admin/{users,users/[id],pending-approvals,
                                brands,countries,payment-methods,root-causes,
                                email-templates[/id],store-templates[/id],
                                audit-log,email-log,sla-rules,fraud-signals,
                                cron-status,system-info,settings}

API:           /api/health, /api/notifications, /api/auth/[...nextauth],
               /api/webhooks/power-automate, /api/cron/sla-breach-scan,
               /api/cron/fraud-scan,
               /api/export/{cases,refunds,sla,agents,audit,emails,knet-batch/[id]}
```

### Server actions (src/app/actions/)

```
admin.ts            cases.ts            knet-batches.ts     promo.ts
admin-extras.ts     emails.ts           magic-link.ts       saved-views.ts
approval-batches.ts fraud.ts            notifications.ts    sla-scan.ts
auth.ts             help-desk.ts        profile.ts
aura-batches.ts     batches.ts          (others)
```

---

## 3. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 App Router (RSC + Server Actions) |
| Language | TypeScript strict |
| Styling | Tailwind v4 + shadcn-style primitives + Stripe-inspired tokens (`#533afd` primary, Inter, blue shadows) |
| Icons | `lucide-react` only |
| Charts | `recharts` |
| Auth | Auth.js v5 Credentials provider — admin-approval signup, OTP forgot-password, first-login set-password, lockout after 5 failed attempts |
| DB | Prisma 6 + SQLite for dev (`v2/packages/db/prisma/dev.db`), Postgres-ready |
| i18n | `next-intl` — EN + AR with full RTL via logical CSS (`ps-*`, `pe-*`, `start-*`, `end-*`) |
| Email | Power Automate via outbound webhook (env-driven); console-log fallback in dev |
| Inbound | `/api/webhooks/power-automate` with HMAC verification |
| Monorepo | Turborepo + pnpm workspaces (`apps/web`, `packages/{db,ui,validators,config}`) |
| Hosting | Vercel-ready, not deployed |
| Cron | Vercel cron (`v2/vercel.json`): `/api/cron/sla-breach-scan` every 15min, `/api/cron/fraud-scan` hourly |
| Error tracking | Sentry — env var checked, SDK not installed yet |

---

## 4. Resume on a new account / new machine

```bash
git clone https://github.com/omdawbas2015/wow-refund-platform.git
cd wow-refund-platform
git checkout devin/1777249813-continue-roadmap

cd v2
pnpm install
pnpm db:push
SEED_DEMO_CASES=1 pnpm db:seed
pnpm dev
```

Open `http://localhost:3000`, sign in with `admin@wow.local` / `admin123`.

If the dev server shows stale builds after schema changes, **restart it** — Next.js build cache becomes stale after `prisma db push`.

---

## 5. Plan recap

The canonical plan is documented in two files. Read both:

1. **`v2/HANDOFF.md`** (327 lines) — original 7-phase handoff
2. **`v2/docs/ARCHITECTURE.md`** (326 lines) — extends to 8 phases (Phase 8 = polish)

Other reference docs:

- `ANALYSIS.md` (602 lines) — deep audit of the legacy app with P0/P1/P2 priority list. Many items applied to v2 already; some still outstanding (see §6 below).
- `docs/enterprise-refund-platform.md` (190 lines) — target architecture and Power Automate flow logic. Useful for understanding webhook contract.
- `DESIGN.md` (94 lines) — visual + UX contract.
- `AGENTS.md` (62 lines) — repo-level agent operating rules.
- `v2/docs/power-automate/README.md` (299 lines) — M365 outbound + inbound flow setup.
- `v2/docs/CRON.md` — cron auth + schedule.

---

## 6. What is missing (34 items, ordered by priority)

### Tier 1 — UI completion, no external secrets needed (Sprint A + B)

1. **Onboarding tour** (Phase 8) — first-login guided walkthrough across `/cases`, `/promo`, `/operations`, `/reports`.
2. **Changelog banner** (Phase 8) — top-bar dismissible banner pointing at `/changelog`. Page exists; banner doesn't.
3. **Bulk operations multi-select UI** on `/cases` (Phase 6) — server actions `bulkSubmitDrafts`, `bulkCancel`, `bulkReassignCases` already exist; just need checkboxes + bulk action bar.
4. **Resend FAILED emails** action button on `/admin/email-log` — page filters FAILED, no resend button yet.
5. **Currencies admin** page (Phase 5) — `CurrencyRegistry` schema exists.
6. **Branches admin** page (Phase 5) — `Branch` schema exists.
7. **Batch schedules admin** page (Phase 5).
8. **Automation rules admin** page (Phase 5).
9. **Backup settings** page (Phase 5).
10. **Module on/off toggles** distinct from feature flags (Phase 5).
11. **Scheduled reports UI** (ARCHITECTURE Phase 7) — `ScheduledReport` model exists, no UI/cron.
12. **Full AR translation pass** for `/admin/*` (Phase 7) — admin still mostly English.
13. **Dark-mode audit per screen** (Phase 7/8) — toggle works, no per-screen verification.
14. **Three-layer design tokens + Cairo / IBM Plex Sans Arabic font stack** (ANALYSIS P1) — primitives → semantic → component layers, plus Arabic fonts.
15. **Command palette ⌘K** with action verbs (ANALYSIS P1) — not just text search.
16. **FINANCE + AUDITOR roles** separation in RBAC (ANALYSIS P1) — currently rolled into ADMIN/OPERATIONS.
17. **Dashboard charts/sparklines** on KPI cards (HANDOFF §10).
18. **Exchange rate in-memory cache** (15min TTL) (ANALYSIS P1).
19. **Prisma indexes** on `RefundCase(status, countryId, createdAt)` and `PromoCode(type, countryId, value, status)` (ANALYSIS P1).

### Tier 2 — Production hardening, requires secrets / services (Sprint C)

20. **PII encryption at rest** (AES-GCM in Prisma middleware) — HANDOFF Phase 7.
21. **WebSocket / SSE notifications** via Upstash Redis pub/sub — HANDOFF Phase 6 + ANALYSIS P1. **Needs `UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN` from owner.**
22. **Sentry SDK** wiring — HANDOFF Phase 7. **Needs `SENTRY_DSN` from owner.**
23. **Vercel deploy + Neon Postgres + backup policy** — HANDOFF Phase 7. **Needs Vercel token + `DATABASE_URL` from owner.**
24. **Real Prisma migrations** (`prisma migrate deploy`, replace `db push`) — ANALYSIS P1.
25. **Playwright smoke suite** (auth + case lifecycle) — HANDOFF Phase 7.
26. **Power Automate flows on M365 tenant** — HANDOFF §10. Owner builds externally; Next.js side ready (see `v2/docs/power-automate/README.md`).
27. **Rate limiting** on `/api/auth/*` — ANALYSIS P0.

### Tier 3 — Backlog (P2)

28. **pino structured logs + OpenTelemetry** (ANALYSIS P2).
29. **OpenAPI/Swagger** generation from zod (ANALYSIS P2).
30. **axe-core a11y audit** in CI (ANALYSIS P2).
31. **Storybook** design-system website (ANALYSIS P2).

### Data hygiene

32. Remove committed `v2/packages/db/prisma/dev.db` from git history; add to `.gitignore` (ANALYSIS P0).
33. Refresh `v2/README.md` — currently says Phase 1 only, very stale.
34. Update `v2/HANDOFF.md` to reflect post-Phase-2 state (it ends at Phase 2).

---

## 7. How to ask the owner for missing secrets

The owner explicitly said: **don't ask questions during execution.** But for items #21–#23 you cannot proceed without secrets. The correct pattern is:

1. **Skip those items** for now, work on Tier 1 + Tier 2 items that don't need secrets.
2. **At the end of your run**, send a single non-blocking message listing which secrets you would need to do the remaining items, with concrete provisioning hints (links, CLI commands).
3. **Do not block** waiting for a reply.

For each secret use `secrets` tool with `action="request"`, `should_save=true`, `save_scope="org"` so it survives across sessions.

Example provisioning hints you can give the owner:

- **`UPSTASH_REDIS_URL` + `UPSTASH_REDIS_TOKEN`** — sign up at upstash.com (free tier ok), create Redis DB, copy REST URL + token.
- **`SENTRY_DSN`** — sentry.io → create project (Next.js) → Settings → Client Keys (DSN).
- **`DATABASE_URL`** — neon.tech → create project → copy pooled connection string.
- **Vercel token** — vercel.com/account/tokens → create token with full scope, valid 1 year.
- **`POWER_AUTOMATE_OUTBOUND_URL` + `POWER_AUTOMATE_INBOUND_SECRET`** — owner builds the M365 flows; outbound URL is the trigger URL, inbound secret is shared HMAC.

---

## 8. Build process — every change = commit + push

```bash
# always pull before starting
git pull origin <current-branch>

# work on a feature
# ... edit files ...
cd v2 && pnpm typecheck   # MUST pass
git add -A && git commit -m "feat(v2-onboarding): add first-login tour"
git push origin <current-branch>
```

**Commit message style:** Conventional Commits with scope. Examples:
- `feat(v2-cases): bulk multi-select on /cases`
- `feat(v2-admin): currencies CRUD page`
- `fix(v2-batches): close TOCTOU race in approve`
- `chore(v2-db): add index on RefundCase(status, countryId, createdAt)`

**Before pushing always:**
- `pnpm typecheck` (4/4 must pass)
- No `dev.db`, `.env`, `node_modules`, `.next` staged
- `/cases/*` and `/promo/*` UI files untouched (unless explicitly asked)

---

## 9. Branch hygiene

- **`main`** = phase 1 only, do not push to it.
- **`promo-uiux-round3`** = the polished `/cases` + `/promo` UI baseline. Do not modify.
- **`devin/1777249813-continue-roadmap`** = active working branch. Push here.
- 50+ historical phase branches exist (`devin/*-v2-phase-N`). Treat as archive only — they are already integrated into the active branch.

---

## 10. Files & directories — quick reference

```
wow-refund-platform/
├── HANDOVER.md                <- THIS FILE (read first)
├── AGENTS.md                  <- agent operating rules (still apply)
├── DESIGN.md                  <- visual + UX contract
├── ANALYSIS.md                <- 602-line audit (P0/P1/P2 list)
├── HANDOFF.md                 <- legacy app handoff (v1 only)
├── docs/                      <- legacy app docs (Vite/Express era)
│   ├── enterprise-refund-platform.md
│   ├── enterprise-schema.sql
│   └── CURRENT_STATE.md
└── v2/                        <- ALL NEW WORK LIVES HERE
    ├── HANDOFF.md             <- 7-phase plan, end of Phase 2
    ├── README.md              <- stale, refresh
    ├── apps/web/              <- Next.js app
    │   └── src/app/
    │       ├── [locale]/(dashboard)/   <- all routes (cases, promo, operations, reports, admin)
    │       ├── [locale]/(auth)/        <- login, signup, forgot, reset
    │       ├── api/                    <- API routes (webhooks, cron, export, health)
    │       └── actions/                <- server actions
    ├── packages/
    │   ├── db/                <- Prisma schema (40+ tables) + seeds
    │   ├── ui/                <- shared design tokens
    │   ├── validators/        <- zod schemas + state machines
    │   └── config/            <- shared tsconfig / eslint
    ├── docs/
    │   ├── ARCHITECTURE.md    <- 8-phase roadmap, deep dive
    │   ├── CRON.md            <- cron schedule + auth
    │   └── power-automate/    <- M365 flow setup (owner-side)
    └── vercel.json            <- cron schedule for production
```

---

## 11. Off-limits — do NOT touch

- `v2/apps/web/src/app/[locale]/(dashboard)/cases/**` (all `*.tsx`)
- `v2/apps/web/src/app/[locale]/(dashboard)/promo/**` (all `*.tsx`)
- Anything at the repo root **except** the four `.md` files (`HANDOVER.md`, `AGENTS.md`, `DESIGN.md`, `ANALYSIS.md`) and this guide
- The legacy `server.ts`, `prisma/`, `src/` at repo root (frozen)

If you genuinely need to add backend logic that involves a `/cases` or `/promo` page, add it to a server action or new sub-route — never edit those page components directly.

---

## 12. Direct instruction to the next Devin session

> Hi. The owner switched accounts and you are picking up the system. The current state is **fully working** (50 routes 200 OK, typecheck 100%, demo data seeded). Your job is to finish the **34 missing items** in §6 above, in order.
>
> Start by:
> 1. `git pull origin devin/1777249813-continue-roadmap`
> 2. `cd v2 && pnpm install && pnpm db:push && SEED_DEMO_CASES=1 pnpm db:seed && pnpm dev`
> 3. Verify at `http://localhost:3000` you see the dashboard with admin login.
> 4. Pick **item #1** from §6 (onboarding tour) and start. Each item = its own commit + push.
> 5. Continue down the list until your credit runs out or all Tier 1 items are done.
> 6. Send the owner a final non-blocking message listing which Tier 2 secrets you need to continue (Upstash, Sentry, Vercel, Neon).
>
> **Do not modify `/cases` or `/promo` UI files.** Add features around them, never touch them.
>
> **Every change = commit + push.** The owner switches accounts and reads `git log` on GitHub.
>
> Welcome, and good luck.
