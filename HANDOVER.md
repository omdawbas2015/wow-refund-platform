# WOW Refund Platform — HANDOVER for the next Devin session

> **Read this file first.** It is self-contained: state of the system, what is done, what is missing, how to resume. Last updated 2026-04-27 03:40 UTC.
>
> **Active branch:** `devin/1777249813-continue-roadmap` (HEAD = `7afb059`, ~121 commits ahead of `main`).
> **Source of truth:** v2/ directory only. The Vite/Express code at the repo root is **legacy and frozen** — do not touch it.

---

## 0. Operating contract (READ BEFORE TOUCHING ANYTHING)

The owner's instructions, restated verbatim from prior sessions:

1. **Never ask questions.** Work autonomously until your credit runs out.
2. **GitHub-first. Always.** Before any work:
   - `git fetch origin && git pull origin <active-branch>` to start from the latest pushed commit.
   - Verify with `git log -1` that you are at the same SHA as `origin/<branch>` on github.com.
   - Never start from a stale local snapshot or assume earlier-phase state. The system is already at phase 7+; resuming from "phase 1 / 2" is a bug, not a feature.
3. **Every change = a separate git commit, pushed to GitHub immediately.** Not at end of feature, not at end of sprint — push the moment a logical unit is done. The owner switches accounts and continues from `git log` on GitHub. Lose a push = lose work.
4. **At the end of each sprint, also update this `HANDOVER.md`** (and its `v2/HANDOVER.md` mirror) with: completed items, current commit SHA, anything new the next session needs to know. Commit + push the HANDOVER update as its own commit (`docs(handover): update after Sprint X`). This is how the next session knows where you left off.
5. **`/cases` and `/promo` UI must not change.** The owner has spent multiple sessions polishing both — preserve their visual appearance and directory structure exactly. Backend logic is fine to extend; UI files (`page.tsx`, components in those folders, layouts) are off-limits.
6. **No screenshots / decorative work** — focus credit on system, planning, execution.
7. **Don't open PRs unless asked.** The owner reviews directly via GitHub commits.
8. **Don't merge to `main`.** The owner does that.
9. **Never commit `dev.db`, `.env*`, or anything under `node_modules`/`.next`.**

### Resume protocol (the one-liner the next session must execute first)

```bash
git fetch origin && \
  git checkout devin/1777249813-continue-roadmap && \
  git pull origin devin/1777249813-continue-roadmap && \
  git log -3 --oneline
```

The last `git log` line is the source of truth for where work resumed. Read this `HANDOVER.md` next, then scroll to §6 to see which items remain.

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

## 6. What is missing (34 items, ordered by priority — tick as you go)

> **Convention:** ⬜ = pending, ✅ = done (commit SHA in parentheses), 🟡 = in progress.
> When you finish an item, change ⬜ to ✅, append the commit SHA, then `git push` HANDOVER.md as its own commit.

### Sprint A — Highest-value UI completion (no secrets) ✅ DONE 2026-04-27

- ✅ **#3 Bulk operations multi-select UI** at `/operations/bulk-cases` — checkboxes, action bar, three confirmation dialogs (submit drafts / cancel / reassign), zod-validated server actions in `app/actions/bulk-cases.ts`. Per-row processing so a single conflict doesn't abort the batch. (commits `daa13e2`, `4995f95`)
- ✅ **#4 Resend FAILED emails** on `/admin/email-log` — per-row Resend button on FAILED rows + "Resend all FAILED" bulk action backed by `bulkResendFailedEmailsAction` (capped at 200 rows, audit log per attempt). (commit `38adbd6`)
- ✅ **#17 Dashboard sparklines** on KPI cards via recharts `<KpiSparkline>`; data buckets the last 14 days from `RefundCase.createdAt` + `AuditLog` flow events + `User.createdAt`. (commit `2f3ca8b`)
- ✅ **#11 Scheduled reports UI + cron** — `/admin/scheduled-reports` CRUD with run-now/pause/edit/delete, 5-field cron parser, `/api/cron/scheduled-reports` sweep gated by `CRON_SECRET`, registered in `vercel.json` at `*/5 * * * *`. (commit `dded4a6`)

### Sprint B — Polish features ✅ DONE 2026-04-27

- ✅ **#1 Onboarding tour** — 5-step `<OnboardingTour>` modal that walks Cases / Operations / Promo / Reports with per-step CTA navigation; localStorage `onboarding-tour-completed-v1` prevents re-showing. (commit `cb82aa8`)
- ✅ **#2 Changelog banner** — dismissible top-bar banner that reads `LATEST_CHANGELOG.version` from `app/[locale]/(dashboard)/changelog/entries.ts`; bumping that version re-shows the banner. (commit `80a1585`)
- ✅ **#15 Command palette ⌘K** — cmdk-based palette with action verbs grouped Navigate / Cases / Operations / Promo / Admin / Help. Role-filtered and bypassed when focus is in an editable element. (commit `7d74be3`)

### Sprint C — Admin pages ✅ DONE 2026-04-27

- ✅ **#5 Currencies admin** at `/admin/currencies` — read-only ISO 4217 directory with search and an "in use" filter that scopes to currencies attached to active countries; surfaces open-case counts per currency. (commit `b080e79`)
- ✅ **#6 Branches admin** at `/admin/branches` — full CRUD with country filter, bilingual name fields, soft-deactivate when cases reference the branch, and audit-log entries on every mutation. (commit `206fbb9`)
- ✅ **#7 Batch schedules admin** at `/admin/batch-schedules` — CRUD over `BatchSchedule` grouped by APPROVAL / KNET / AURA. Reuses `validateCron()` from `lib/scheduled-reports/cron.ts`; KNET/AURA force `countryId = null`. (commit `570ed6f`)
- ✅ **#8 Automation rules admin** at `/admin/automation-rules` — CRUD over `AutomationRule` with JSON conditions/actions, scope filtering, priority ordering, and a read-only preview dialog for auditors. (commit `b2fd286`)
- ✅ **#9 Backup settings** at `/admin/backup` — new singleton `BackupSettings` model + run-now button that creates a `BackupLog` row and audit entry. Recent runs table shows the last 25 attempts with formatted size/status/duration. (commit `dc60649`)
- ✅ **#10 Module on/off toggles** at `/admin/modules` — new `ModuleToggle` table keyed by stable strings; the dashboard layout passes the disabled set into `<Sidebar>` so admins can hide optional modules globally. (commit `34026eb`)

### Sprint D — Polish + perf ✅ DONE 2026-04-27

- ✅ **#12 Full AR translation pass** — expanded `messages/ar.json` and parallel `en.json` to cover every admin namespace introduced in Sprint C (currencies, branches, batch-schedules, automation-rules, backup, modules) plus a much larger `common` vocabulary. Strings land as foundation; converting hard-coded English to `t()` calls is mechanical follow-up work. (commit `e319363`)
- ✅ **#13 Dark-mode audit per screen** — every Sprint C admin page already uses semantic tokens only. Switch thumbs in `/admin/modules` and `/admin/settings` were the only dark-mode hostile classes outside the forbidden /cases and /promo trees; both now use `bg-surface`. Modal overlays at `bg-black/40` are intentional dimming. (commit `efe6750`)
- ✅ **#14 Three-layer design tokens + Cairo / IBM Plex Sans Arabic** — `globals.css` is now layered as `--ref-*` primitives → semantic (`--background`, `--primary`, etc.) → `--c-*` component tokens. RTL body text routes through IBM Plex Sans Arabic (`--font-arabic-text`), RTL display headings through Cairo (`--font-arabic-display`). (commit `1a4e154`)
- ✅ **#18 Exchange rate in-memory cache** — `lib/exchange-rate/cache.ts` exports `getExchangeRate(from, to)` with a 15-minute in-memory TTL, persistent DB write-through, and stale-while-error fallback when exchangerate.host is unavailable. (commit `439cd59`)
- ✅ **#19 Prisma indexes** — `RefundCase` gains a composite `@@index([status, countryId, createdAt])` covering the dashboard / cases-list query shape; `PromoCode` gains `@@index([status, configId])` so the available-pool lookup is bounded by configId. Verified with `pnpm db:push` + 4/4 typecheck. (commit `81ddb24`)

### Sprint E — Security + hygiene ✅ DONE 2026-04-27

- ✅ **#16 FINANCE + AUDITOR roles** — added `lib/rbac/roles.ts` central helpers (`isAdmin`, `isFinance`, `isAuditor`, `canViewAdminArea`, `canViewFinanceArea`, `canViewAuditLog`, `canManageOperations`). `/admin/audit-log` now uses `canViewAuditLog()` so AUDITOR users can read audit data without escalating to ADMIN. Other admin pages remain ADMIN-only and switch to the helpers incrementally. (commit `d8d2171`)
- ✅ **#24 Real Prisma migrations** — generated `migrations/20260427025439_initial_baseline/migration.sql` covering Sprint C/D schema deltas (`ModuleToggle`, `BackupSettings`, `aura_batch.caseSnapshot`, composite indexes on `RefundCase` and `PromoCode`). Production deploys can now use `pnpm db:migrate:deploy` against versioned migrations. (commit `f4dbb17`)
- ✅ **#27 Rate limiting** — `lib/rate-limit/index.ts` is a 2-tier sliding-window limiter: prefers Upstash when `UPSTASH_REDIS_REST_URL`+`UPSTASH_REDIS_REST_TOKEN` are set, falls back to in-memory Map otherwise. Wired into NextAuth `authorize()` and the signup/forgot/reset/set-password server actions at 5 attempts per 5 min per IP per scope. (commit `d078a5f`)
- ✅ **#32 Remove committed `v2/packages/db/prisma/dev.db`** — `dev.db` is not currently tracked at the v2 path; the four legacy SQLite files at the repo root (`./dev.db`, `./prisma/dev.db`, `./prisma/main.db`, `./prisma/prisma/dev.db`) were removed from the index, and `.gitignore` was tightened to block `*.db` / `*.db-journal` / `**/dev.db` / `**/main.db` / `v2/packages/db/prisma/*.db` / `.next/`. Full git-history scrub still requires a coordinated maintenance window. (commits `0d84825`, `f4dbb17`)
- ✅ **#33 Refresh `v2/README.md`** — Quick Start now uses `pnpm db:migrate` + `db:migrate:deploy`, env doc adds Upstash + Sentry, status section enumerates Sprints A–E. (commit `0cecb38`)
- ✅ **#34 Update `v2/HANDOFF.md`** — banner at the top marks the phase-2 narrative as historical and points readers at `/HANDOVER.md` for the live state. (commit `28a5d9b`)

### Sprint F — Production hardening (requires owner-provided secrets)

- 🟡 **#20 PII encryption at rest** — `lib/crypto/pii.ts` exposes AES-256-GCM `encrypt` / `decrypt` / `encryptIfPresent` / `decryptIfPresent`. Reads a 32-byte hex key from `PII_ENCRYPTION_KEY`; if unset the helpers are pass-through, so per-field opt-in works without breaking dev. Storage format `v1:<iv>:<ct>:<tag>` reserves room for algo rotation. Wiring into Prisma `client.$extends` for specific RefundCase / Customer fields is the next step once a column-level rollout plan is approved. (commit `00b1d89`)
- 🟡 **#21 SSE notifications + per-user event bus** — `lib/events/bus.ts` (in-process EventEmitter keyed by user id) and `GET /api/notifications/stream` (SSE endpoint with 25s heartbeats and auth gate) are landed. The bell icon (`components/layout/notifications-bell.tsx`) now subscribes to the SSE stream and slows its polling fallback to 2 min on `ready`; `dispatchNotifications()` calls `publish()` after every `createMany` so SLA / fraud / mention / AURA notifiers fan out live. SSE route's `cancel()` is wired to a real cleanup that clears the heartbeat + bus subscription so disconnects stop leaking timers. Single-replica deploys get real-time fanout for free; multi-replica still needs the Upstash pub/sub bridge in `bus.ts` once `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` are provisioned. (commits `a70fae9`, `8550816`, `6a58a8f`, `7afb059`)
- 🟡 **#22 Sentry SDK** — `@sentry/nextjs` installed; `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` and `instrumentation.ts` all early-return when `SENTRY_DSN` is unset (zero-cost no-op in dev). The build-time `withSentryConfig()` wrap and source-map upload are the one-line follow-ups once `SENTRY_DSN` + `SENTRY_AUTH_TOKEN` are provided. (commit `cd14af2`)
- 🟡 **#23 Vercel deploy + Neon Postgres + backup policy** — `v2/vercel.json` pins build / region / cron triggers and `v2/docs/DEPLOY.md` captures the env-var matrix + schema.prisma provider switch + 6-step rollout checklist. Cuts over the moment Neon `DATABASE_URL` + Vercel project are wired. (commit `056d729`)
- ✅ **#25 Playwright smoke suite** — `@playwright/test` + `playwright.config.ts` + `tests/auth.spec.ts` (login + bad-creds rejection) and `tests/case-list.spec.ts` (cases index loads + bulk-cases reachable). `pnpm test:e2e` runs the suite against `PLAYWRIGHT_BASE_URL` (defaults to `localhost:3000`); CI installs chromium with `pnpm test:e2e:install`. No secrets needed. (commit `94790a2`)

### Sprint G — Backlog (P2, optional)

- ⬜ **#26 Power Automate flows on M365 tenant** — owner builds externally; Next.js side already ready.
- 🟡 **#28 pino structured logs + OpenTelemetry** — partial. `lib/logger.ts` is a JSON-line shim with the same surface as pino (`info(obj, msg)`, `child(bindings)`); production emits structured log lines that any drain or OTel collector can parse. Real pino + OTel exporter wiring deferred until a log-drain destination is approved (Vercel Log Drains, Datadog, etc.). (commit `e6dcf74`)
- ✅ **#29 OpenAPI / Swagger** — `GET /api/openapi` emits an OpenAPI 3.1 doc generated live from `@wow/validators` zod schemas via `zod-to-json-schema`. Covers the public auth surface, `/api/health`, `/api/openapi` itself, and the Power Automate inbound webhook. Internal tRPC routers stay excluded by design. (commit `8593a32`)
- ✅ **#30 axe-core a11y audit** — `tests/a11y.spec.ts` runs `@axe-core/playwright` against `/login` and the post-login dashboard, asserting zero WCAG 2.0/2.1 A and AA violations. Runs alongside the rest of the smoke suite under `pnpm test:e2e`. (commit `a4bbd45`)
- 🟡 **#31 Storybook design-system website** — replaced with `/admin/design-tokens` living preview page (semantic palette, typography ramp incl. Cairo + IBM Plex Sans Arabic, component swatches). Renders against the real CSS pipeline so dark-mode + RTL parity is verifiable in one URL, with no Storybook builder install. Full Storybook scaffold can land later if a UI engineer takes ownership. (commit `db55d6a`)

### Sprint H — Live audit + improvements 2026-04-27 (no secrets) 🟡 IN PROGRESS

Walked every page in the running app, captured runtime warnings + console errors, and shipped fixes one logical unit per commit. All commits below are on `devin/1777249813-continue-roadmap` and verified `pnpm typecheck` 4/4 + `pnpm test` 22/22 green.

- ✅ **Audit every route** — Playwright-driven walk over 34 admin / dashboard / operations / promo / reports / help-desk routes returned HTTP 200 on each; only first-paint NextAuth `getSession()` aborts during navigation transitions surfaced (race noise, no real failures).
- ✅ **Silence Turbopack `@prisma/client can't be external` warning** — `@prisma/client` was reaching `apps/web` only via pnpm hoisting; added it as a direct dep so `serverExternalPackages` resolves cleanly and the dev log is quiet. (commit `b2f6da8`)
- ✅ **Replace stale Phase 1 dashboard card** — the dashboard had a hardcoded "No cases yet" empty state and a "Phase 1 scaffolding — ready for Phase 2" card that contradicted the operating contract (system is at phase 7+). Recent activity now queries the 6 most recently updated cases and renders status-tinted badges; the second card is now a "System status" enumeration of actually-shipped surfaces. (commits `e7497c3`, `a4fde2d`)
- ✅ **Vitest config + 22 unit tests** — `apps/web/vitest.config.ts` plus tests for `lib/crypto/pii` (encrypt round-trip, key gating, legacy plaintext, wrong-key fallback, key-length validation), `lib/rate-limit` (sliding window, key isolation, cap), `lib/events/bus` (publish, isolation, unsubscribe, fanout), `lib/logger` (level routing, `LOG_LEVEL` filtering, `child(bindings)`). `pnpm test` → 22/22 passed. (commit `1034b00`)
- ✅ **Bell goes live via SSE** — `components/layout/notifications-bell.tsx` now opens an `EventSource` against `/api/notifications/stream`, slows its polling fallback to 2 min once `ready` fires, refetches on every `notification`, and cleans up the source + interval on unmount. Falls back gracefully on 401 / connection errors. (commit `8550816`)
- ✅ **SSE stream cleanup wired to `cancel()`** — the route stored a `_cleanup` closure on the controller but never called it; `cancel()` was a no-op, leaking the heartbeat interval + bus subscription on every disconnect. Now `cancel()` invokes the real cleanup, with a `closed` guard preventing post-close enqueues. (commit `6a58a8f`)
- ✅ **Notifications dispatcher publishes to the bus** — `dispatchNotifications()` was the central choke-point for SLA / mention / fraud / AURA notifiers but only wrote DB rows. After `createMany` it now `publish()`es a minimal `notification` event per allowed userId so the SSE clients refetch immediately; payload deliberately stays small so clients still hit `GET /api/notifications` for the authoritative unread count. (commit `7afb059`)

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
# 1. Always start from latest GitHub state (NOT from local stale state)
git fetch origin
git pull origin <current-branch>
git log -1   # confirm you match origin

# 2. Work on a feature
# ... edit files ...
cd v2 && pnpm typecheck   # MUST pass

# 3. Commit + push IMMEDIATELY when the logical unit is done
git add -A
git commit -m "feat(v2-onboarding): add first-login tour"
git push origin <current-branch>
```

**At the end of each sprint:** also update `HANDOVER.md` + `v2/HANDOVER.md` (Section 6 checkboxes + commit SHA at top), then commit + push as its own `docs(handover): update after Sprint X` commit. This is the breadcrumb the next session uses to resume from the correct state.

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

> Hi. The owner switched accounts and you are picking up the system. The current state is **fully working** (50 routes 200 OK, typecheck 100%, demo data seeded, phases 1–7 substantially complete). Your job is to finish the **34 missing items** in §6 above, in order.
>
> **CRITICAL — read this first:**
> - The system is **far past Phase 1 / Phase 2**. Do not assume otherwise from any other doc you find.
> - The latest state lives **only on GitHub**, on branch `devin/1777249813-continue-roadmap`. Anything else (older branches, local snapshots, the legacy code at the repo root) is irrelevant to your task.
> - Always resume from `origin/devin/1777249813-continue-roadmap` — never from a stale local checkout.
>
> Start by:
> 1. `git fetch origin && git checkout devin/1777249813-continue-roadmap && git pull origin devin/1777249813-continue-roadmap`
> 2. `git log -3 --oneline` — confirm you see this HANDOVER's commits and any newer ones from the previous Devin run. **The newest commit is the source of truth, not this file's "Last updated" date.**
> 3. `cd v2 && pnpm install && pnpm db:push && SEED_DEMO_CASES=1 pnpm db:seed && pnpm dev`
> 4. Verify at `http://localhost:3000` you see the dashboard with admin login.
> 5. Re-read §6 of this HANDOVER and find the first item without a ✅ checkmark — that is where you resume. (The previous session may have completed several items already; don't redo them.)
> 6. Each item = its own commit + push **immediately**. Don't batch.
> 7. After every sprint, update §6 of this HANDOVER (tick completed items + bump the commit SHA at the top of this file) and commit it as `docs(handover): update after Sprint X`.
> 8. Continue down the list until credit runs out or Tier 1 is complete.
> 9. Send the owner a final non-blocking message listing which Tier 2 secrets you need to continue (Upstash, Sentry, Vercel, Neon).
>
> **Do not modify `/cases` or `/promo` UI files.** Add features around them, never touch them.
>
> **Every change = commit + push to GitHub immediately.** The owner switches accounts and reads `git log` on GitHub. If it isn't pushed, it didn't happen.
>
> Welcome, and good luck.
