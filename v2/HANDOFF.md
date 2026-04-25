# WOW Refund Platform v2 — Handoff

> **Purpose:** Everything a new engineer (or a new Devin session on a different account) needs to pick up this project from exactly where it was left off.
>
> **Last updated:** 2026-04-25 — end of Phase 2.
> **Active branch:** `devin/1777094132-v2-phase-2-refund-cases`
> **Latest PR:** https://github.com/omdawbas2015/wow-refund-platform/pull/2 (open, awaiting merge)
> **Previous PR:** https://github.com/omdawbas2015/wow-refund-platform/pull/1 (merged — Phase 1 foundation)

---

## 0. How to resume in a new session / account

1. Fork or take over the repo `omdawbas2015/wow-refund-platform`. All v2 work lives under the `v2/` subfolder; the legacy app at the repo root is frozen and should not be touched.
2. Clone and bootstrap:
   ```bash
   git clone https://github.com/omdawbas2015/wow-refund-platform.git
   cd wow-refund-platform/v2
   pnpm install
   pnpm db:push
   SEED_DEMO_CASES=1 pnpm db:seed
   pnpm dev
   ```
3. Sign in locally with `admin@wow.local` / `admin123` (seeded admin).
4. Check out the active branch to continue Phase 2 polish, or branch off `main` for Phase 3.
   ```bash
   git fetch && git checkout devin/1777094132-v2-phase-2-refund-cases
   ```
5. Read this file, then `v2/docs/ARCHITECTURE.md`, then the PR bodies for #1 and #2 to understand the mental model.
6. Before starting new work, confirm the required secrets are present (see §8). For anything that sends email or integrates with Power Automate / Postgres / Vercel, request the missing secrets from the owner *before* writing code that assumes they exist.

---

## 1. Product summary

WOW Refund is an enterprise refund-management platform for a multi-country restaurant/retail group. Agents raise refund cases per customer; country managers approve by email; finance / refund-operations staff execute the actual refund per payment method. Adjacent modules handle customer promo compensation, internal help desk, and stores communication.

**Users & roles** (seeded in `roles.ts`):
- `ADMIN` — full access.
- `MANAGER` — country manager; approves refunds via email.
- `OPERATIONS` — finance / refund-ops staff; executes KNET and Aura batches.
- `TEAM_LEAD` — front-line supervisor.
- `AGENT` — creates refund cases, sends promos.
- `STORES` — restricted to stores communication module.
- `READ_ONLY` — dashboards / reports only.

Permission matrix is dynamic (stored in DB, editable by admin). Default mapping is in `packages/db/prisma/seed/roles.ts`.

---

## 2. Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 App Router | RSC + server actions throughout |
| Language | TypeScript strict | All packages typecheck clean |
| Styling | Tailwind v4 + shadcn-style primitives | Stripe-inspired design tokens (see `DESIGN.md` at repo root) |
| Icons | `lucide-react` | No external icon libs |
| Auth | Auth.js v5 (Credentials provider) | Admin-approval signup flow; forgot-password via OTP |
| DB | Prisma 6 + SQLite (dev), Postgres (prod-ready) | `packages/db/prisma/schema.prisma` is the source of truth |
| i18n | `next-intl` | EN + AR with full RTL; logical CSS throughout |
| Email | Power Automate via webhook | Dispatcher stub falls back to console logging when webhook URL missing |
| Monorepo | Turborepo + pnpm workspaces | `apps/web` + `packages/{db,ui,validators,config}` |
| Hosting | Vercel-ready | Not deployed yet |
| Error tracking | Sentry — planned, not installed | |

`pnpm typecheck` and `pnpm build` must stay green on every PR.

---

## 3. Repository layout

```
wow-refund-platform/
├── v2/                              <- all new work
│   ├── apps/web/                    <- Next.js app
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── [locale]/
│   │   │   │   │   ├── (auth)/          login, signup, forgot, set-password
│   │   │   │   │   └── (dashboard)/     dashboard, cases, admin/*, reports/*
│   │   │   │   ├── api/
│   │   │   │   │   ├── auth/[...nextauth]/
│   │   │   │   │   └── webhooks/power-automate/   inbound reply handler
│   │   │   │   └── actions/              server actions (cases.ts, notes.ts, ...)
│   │   │   ├── components/ui/            shadcn-style primitives + domain widgets
│   │   │   ├── lib/                      auth, db, email, intl helpers
│   │   │   └── middleware.ts             next-intl + auth gate
│   │   └── messages/{en,ar}.json         translation catalogs
│   ├── packages/
│   │   ├── db/          Prisma schema + seed (40+ tables)
│   │   ├── ui/          shared design tokens
│   │   ├── validators/  zod schemas + case-status state machine
│   │   └── config/      shared tsconfig / eslint
│   └── docs/
│       ├── ARCHITECTURE.md   deep dive — read this second
│       └── CURRENT_STATE.md  (optional checkpoint file)
├── AGENTS.md            repo-level agent guide (applies to v2 too)
├── DESIGN.md            visual system
└── HANDOFF.md           THIS FILE (also mirrored at v2/HANDOFF.md)
```

Legacy code at the repo root is frozen — do not modify.

---

## 4. Feature scope — the 19 agreed features

This is the master list agreed with the product owner. Anything outside it is out of scope without explicit approval.

**Core UX & workflow**
1. In-app notifications (bell, real-time via polling today, WebSocket later)
2. SLA tracking + auto-escalation (dynamic rules, admin-editable)
3. Customer lookup / history (all prior cases + promos per customer)
4. Duplicate case detection (warn before insert; allow "Create anyway")
5. Notes with `@mentions` on refund cases → notify mentioned user
6. Bulk operations (approve / export / assign) on cases list
7. Global search (Ctrl+K)
8. Saved filters / views (shareable links)
9. Manager delegation (deputy for out-of-office)

**Security & governance**
10. Soft delete + 90-day recovery (never hard-delete cases)
11. Password policy + failed-login lockout (admin lockout already wired)
12. Encrypted PII at rest (customer_email, customer_phone)

**Reporting & anti-fraud**
13. Scheduled email reports (weekly/monthly via Power Automate)
14. Fraud detection signals + agent-facing promo history preview
15. Inbound customer replies → notification to all agents + admin
16. Agent performance dashboard (cases raised + promo budget used only)

**Onboarding & polish**
17. Onboarding tour (first-time agent)
18. Keyboard-shortcuts panel (`?` to open)
19. In-app changelog ("What's new" banner)

**Visual**
- Light mode is primary; dark mode is secondary but must work everywhere.
- AR + EN with full RTL.

**Explicitly descoped** (do not reintroduce without approval): file attachments, 2FA, holiday calendar per country, case audit certificate PDF, sandbox mode, webhook outbox for external integrations, API keys for external access.

---

## 5. Domain model (summary — see `ARCHITECTURE.md` for the full ERD)

Key tables:
- `User`, `Role`, `Permission`, `RolePermission`, `UserCountry`
- `Country`, `Currency`, `Brand`, `Branch`, `PaymentMethod`
- `RefundCase` — the aggregate; state machine on `status`
- `RefundCaseComponent` — one row per payment method on a case (supports split refunds)
- `RefundCaseNote`, `RefundCaseNoteMention`
- `ActivityLog` (case-scoped), `AuditLog` (system-wide)
- `Notification`
- `PromoCode`, `PromoSendLog`, `Customer` (lookup helper)
- `EmailTemplate`, `BatchSchedule`, `AutomationRule`, `SlaRule`
- `PendingUserApproval`, `PasswordResetToken`, `LoginAttempt`

**Case state machine** (enforced in `packages/validators/src/case-status.ts`):
```
DRAFT ──▶ PENDING_APPROVAL ──▶ APPROVED ──▶ IN_EXECUTION ──▶ REFUNDED
                │                                      │
                ▼                                      ▼
            REJECTED                          PARTIALLY_REFUNDED
                                                       │
                                                       ▼
                                                   REFUNDED
DRAFT / PENDING_APPROVAL / APPROVED / IN_EXECUTION ──▶ CANCELLED
```
`REJECTED` is driven only by the manager's reply to the approval email; the UI must never call `updateCaseStatusAction` with `target = 'REJECTED'` (the server rejects it too).

`DeletedAt` is a soft-delete stamp — cases stay in the list with a "Deleted" badge and are read-only.

---

## 6. What is DONE

### Phase 1 (merged in PR #1)
- Turborepo scaffolding (`apps/web` + 4 packages)
- Prisma schema — 40+ tables covering all domains
- Seed — 195 countries, 69 currencies, 7 roles + 40 permissions, EN+AR email templates, default admin
- Auth.js v5 Credentials provider
- Login / signup (admin-approval flow) / forgot-password (OTP, 6-digit, 15 min TTL) / first-login set-password
- Admin lockout (5 failed attempts in 15 min → 30 min lockout)
- Design system tokens (Stripe-inspired, Inter + blue shadows, `#533afd` primary)
- Light + dark mode via `next-themes`
- `next-intl` setup — EN + AR with full RTL
- Power Automate dispatcher stub (`src/lib/email/dispatcher.ts`) + inbound webhook route with HMAC verification
- Admin panel skeleton — Users + Pending Approvals

### Phase 2 (PR #2, open — includes all latest fixes)

**Server actions** — `src/app/actions/cases.ts`, `.../notes.ts`, `.../notifications.ts`
- `createCaseAction` — duplicate detection, KNET auth-code enforcement, state-machine initialization
- `updateCaseStatusAction` — transactional with optimistic-concurrency guard (TOCTOU-safe)
- `deleteCaseAction` — soft-delete with required reason, audit-logged
- `addCaseNoteAction` — parses `@mentions` and fans out notifications
- `markNotificationReadAction`

**Pages**
- `/cases` — filterable, paginated table + mobile stacked-card view + `Payment` column with branded logos (Apple Pay / KNET wordmark / Card) + quick-view drawer
- `/cases/new` — wizard with live totals, duplicate warning + "Create anyway", Aura sidecar
- `/cases/[id]` — 4 tabs (Overview / Components / Notes / Activity), sticky vertical stepper with pulse-ring animation on the current step, role-gated action bar
- Notifications bell in the top bar (polls every 30 s)
- Customer history widget (prior cases + promos)

**UX requirements already met from Phase 2 feedback**
- Vertical stepper, compact, animated (replacing the rejected horizontal version)
- Payment method logos with authentic brand appearance on list + drawer + overview + components tab
- Approve action gated to `ADMIN` / `MANAGER`; other roles see a "Waiting for country manager approval" hint
- No Reject button anywhere in the UI (rejection is email-driven, server-enforced)
- Delete case (soft) with mandatory reason; deleted cases render with strikethrough + "Deleted" badge

**CI / quality**
- `pnpm typecheck` passes
- `pnpm build` clean
- Devin Review: 2 findings in the Phase 2 branch were fixed in commit `2a6ecad` (TOCTOU + stale duplicate alert). Re-review before merge.

---

## 7. What is NEXT

Ordered by phase; do not skip ahead.

### Phase 3 — Approval batches, execution, operations desk
- Daily per-country approval batch → emails the country manager with a signed summary + magic-link fallback (Power Automate flow required).
- Keyword-flexible reply parsing (`approved` / `rejected` in multiple languages) via the inbound webhook.
- KNET daily global batch → Finance team spreadsheet → ARN suggestions back in via webhook → agent verifies per component.
- Aura daily global batch → Aura team → confirmation via webhook.
- `/refund-operations` page — isolated view for refund-ops agents: pending ARN entry, KNET batch status, Aura batch status.

### Phase 4 — Promo domain
- Customer compensation promos (per `brand × country × value` pool, emailed).
- Service-recovery promos (internal-only, never emailed).
- Fraud signals shown to agent *before sending* a promo (the "promo history preview" in feature #14).

### Phase 5 — Admin panel completion
- Make every config dynamic: countries, currencies, brands, branches, payment methods (with icon + `requiresAuth` flag), root causes, email templates, batch schedules, automation rules, SLA rules, feature flags, backup settings, modules on/off, audit log viewer.

### Phase 6 — Cross-cutting features
- In-app notifications: move from polling to WebSocket (Upstash Redis pub/sub).
- Global search (Ctrl+K).
- Saved filters / views.
- Bulk operations on cases.
- Keyboard-shortcuts panel.
- Onboarding tour.
- Changelog banner.
- Fraud detection signals pipeline.

### Phase 7 — Launch readiness
- Full AR translation pass on dashboard shells.
- Dark-mode audit on every screen.
- Encrypt PII at rest (application-level AES-GCM in the Prisma middleware).
- Sentry wiring + production logging.
- Vercel deploy + Postgres (Neon) + backup policy.
- Tests: Playwright smoke suite for auth + case lifecycle.
- Documentation pass.

---

## 8. Secrets & external services needed

Capture all of these in Devin's secrets store (or the new hoster's equivalent) before starting the phase that needs them. Nothing should ever be committed.

| Secret | Needed for | Phase | Status |
|---|---|---|---|
| `DATABASE_URL` | Postgres (Neon) production connection | Phase 7 | not provisioned |
| `AUTH_SECRET` | Auth.js session signing | any prod | generate with `openssl rand -hex 32` |
| `POWER_AUTOMATE_OUTBOUND_URL` | Outbound email webhook | Phase 3 | **owner must provide** |
| `POWER_AUTOMATE_INBOUND_SECRET` | HMAC for inbound webhook | Phase 3 | **owner must provide** |
| `UPSTASH_REDIS_URL` / `_TOKEN` | Pub/sub for notifications | Phase 6 | not provisioned |
| `SENTRY_DSN` | Error tracking | Phase 7 | not provisioned |
| Vercel token | Preview + prod deploy | Phase 7 | not provisioned |

Until those are provided, the dispatcher stays in console-logging mode and auth uses the dev `AUTH_SECRET` from `.env.example`. The app is fully functional locally without any of them.

Everything else (countries, currencies, brands) is seeded from code — no external service needed.

---

## 9. Design decisions worth remembering

- **Every outbound email goes through Power Automate.** Never call an SMTP server directly. The dispatcher is the single choke point.
- **`SEED_DEMO_CASES=1`** at seed time creates 5 demo cases across different statuses — use this for screenshots and manual QA.
- **Soft-delete everywhere.** Never add a `DELETE FROM` anywhere; use `deletedAt`.
- **`canTransition` + `updateMany` with a status guard** is the required pattern for any state-machine transition — see `updateCaseStatusAction` for the template.
- **Logical CSS** (`ps-*`, `pe-*`, `ms-*`, `me-*`, `start-*`, `end-*`) everywhere; `ltr:` / `rtl:` only as a last resort. This is what makes AR work without duplicate styles.
- **Stripe tokens, Inter font, subtle blue shadows.** Do not drift into material / flat / generic shadcn defaults. See `DESIGN.md`.
- **No emojis in UI text** except the country flag emoji column.
- **lucide-react** is the only icon source. Brand logos (Apple, KNET, Mada) are inline SVG/CSS in `components/ui/payment-method-icons.tsx` — keep them there.
- **Commits are small and traceable.** One concern per commit when possible. Use Conventional Commits (`feat`, `fix`, `chore`, scope `v2-cases`, `v2-admin`, etc.).

---

## 10. Known follow-ups / open items

- Phase 2 PR #2 is **open and not yet merged**. Merge it first (after the owner re-reviews the vertical-stepper + payment-logo revision).
- Power Automate flows on the Microsoft 365 tenant are not built yet. The Next.js side is ready; the Flow author needs: (a) outbound templates for approval / ARN / OTP / promo; (b) inbound reply parser that POSTs JSON with `x-wow-signature` HMAC to `/api/webhooks/power-automate`.
- Dashboard KPI cards are stubs (show static numbers). Real metrics come in Phase 2.5 or Phase 6.
- `/refund-operations`, `/promos`, `/reports`, `/stores-communication`, most of `/admin/*` are currently placeholder routes.
- AR translations exist for auth + cases core strings; the admin panel is English-only so far.
- No automated test suite yet. Manual smoke testing + Devin Review covers Phase 2.

---

## 11. For the next agent/session — operating contract

- Read `AGENTS.md` at the repo root. It applies to `v2/` too.
- Consult `DESIGN.md` before touching layout or styling.
- Use the todo tool to track multi-step work. Never drop a user-requested task silently.
- Always run `pnpm typecheck` before pushing.
- Create a PR for any code change unless the user says otherwise. Link the PR in your final message.
- When the user gives feedback, take screenshots and send them for approval *before* committing. Arabic feedback like "وحش خالص" means "completely bad" — treat as a hard rejection and redesign, don't patch.
- Prioritize shipping a clean, reviewable PR over finishing everything at once.

Welcome aboard. 🟪
