# WOW Refund v2 — Architecture

> Enterprise refund management platform built for multi-country operations.
> **Stack:** Next.js 15 (App Router) · tRPC-ready · Prisma 6 · Auth.js v5 · Tailwind v4 · shadcn/ui

This document is the living architectural reference. Keep it current as the system evolves.

---

## 1. High-level topology

```
┌───────────────────────────────────────────────────────────────────────────┐
│  Browser (Agent / Manager / Admin)                                         │
└───────────────────────────────────────────────────────────────────────────┘
                                  ▲
                  (HTML / RSC streams · JSON)
                                  ▼
┌───────────────────────────────────────────────────────────────────────────┐
│  Next.js 15 (App Router)                                                   │
│  • Server Components + Server Actions                                      │
│  • Middleware (next-intl + auth-edge)                                      │
│  • Route handlers: /api/auth/[...nextauth], /api/webhooks/power-automate  │
└───────────────────────────────────────────────────────────────────────────┘
                                  ▲
                                  ▼
┌─────────────────────────┐   ┌───────────────────────────────────────────┐
│  Prisma 6 (SQLite dev /  │   │  Power Automate (Microsoft 365)            │
│  Postgres prod)          │   │  • Outbound: email dispatch                │
│  40+ tables              │   │  • Inbound: reply parsing → /webhooks      │
└─────────────────────────┘   └───────────────────────────────────────────┘
```

### Boundaries
- **Browser** never talks to Power Automate directly. All outbound mail flows through the dispatcher (`src/lib/email/dispatcher.ts`) which either POSTs to the Power Automate webhook (when configured) or logs to console (in dev).
- **Inbound emails** from Power Automate are authenticated via a shared secret header (`x-wow-signature` vs `POWER_AUTOMATE_INBOUND_SECRET`).

---

## 2. Monorepo layout

```
v2/
├── apps/
│   └── web/                     # Next.js 15 app
│       ├── src/
│       │   ├── app/             # App Router (locale-prefixed)
│       │   │   ├── [locale]/
│       │   │   │   ├── (auth)/       # login, signup, forgot, set-password
│       │   │   │   └── (dashboard)/  # dashboard, cases, admin/*
│       │   │   ├── actions/     # Server Actions (auth, admin, …)
│       │   │   └── api/         # Route handlers
│       │   ├── auth.ts          # Full Auth.js config (Prisma + credentials)
│       │   ├── auth.config.ts   # Edge-safe Auth.js config (no Prisma/bcrypt)
│       │   ├── auth-edge.ts     # Edge auth instance for middleware
│       │   ├── components/      # ui/, layout/, providers/
│       │   ├── i18n/            # next-intl routing + messages
│       │   ├── lib/             # email dispatcher, otp, password, utils
│       │   └── middleware.ts    # i18n + route protection
│       ├── next.config.mjs
│       ├── tailwind.config.ts   # Stripe tokens (Inter, blue shadows)
│       └── tsconfig.json
├── packages/
│   ├── db/                      # Prisma schema + seed
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # 40+ tables, 19 sections
│   │   │   └── seed.ts
│   │   └── src/
│   │       ├── index.ts         # Singleton PrismaClient
│   │       └── seed-data/       # Countries, currencies, roles, …
│   ├── ui/                      # Shared design primitives (future)
│   ├── validators/              # Zod schemas shared by Server Actions
│   └── config/                  # Future: shared tsconfig / eslint
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Data model (high level)

Full schema in `packages/db/prisma/schema.prisma` (1150+ lines, 40+ tables).

### 3.1 Immutable registries (seeded once)
- `CountryRegistry` — 195 ISO 3166-1 countries (flag, dial code, currency, locale)
- `CurrencyRegistry` — ISO 4217 currencies with decimals (3 for KWD, 2 for USD, 0 for JPY)

Admin activates a subset via the mutable `Country` table (per-country cutoff time, sort order, etc.).

### 3.2 RBAC
- `User`, `Role`, `Permission`, `RolePermission` — 7 seeded roles, 40+ permissions
- States: `PENDING → ACTIVE → SUSPENDED / ARCHIVED`
- Soft delete via `deletedAt`
- `OtpToken` (6-digit, 15-min TTL) · `PasswordResetToken` · `Session`

### 3.3 Refund domain
- `RefundCase` — overall case (owner, status, totals, Aura sidecar)
- `RefundComponent` — per payment method (Apple Pay / Credit Card / KNET + Auth code), each with its own ARN, status, batch linkage
- State machines:
  - Case: `DRAFT → PENDING_APPROVAL → APPROVED → IN_EXECUTION → {PARTIALLY_REFUNDED | REFUNDED | REJECTED | CANCELLED}`
  - Component: `PENDING → AWAITING_BATCH → AWAITING_ARN → ARN_RECEIVED → {REFUNDED | FAILED}`

### 3.4 Approval / execution batches
- `ApprovalBatch` — daily per-country batch sent to country manager (+ optional deputy)
- `KnetBatch` — daily global batch sent to Finance with all KNET components
- `AuraBatch` — daily global batch sent to Aura team

### 3.5 Promo
- `PromoConfig` — brand × country × type × value pool
- `PromoCode` — individual codes in a pool
- `PromoAllocation` — code assigned to a case

Two types:
- `CUSTOMER_COMPENSATION` — fixed value, emailed to customer
- `SERVICE_RECOVERY` — 100 % internal, shown in UI only

### 3.6 Help desk
- `StoreMessageTemplate` + `StoreMessageLog` — isolated module for agent ↔ store communication (uses `caseNumber` as plain text, no FK — see the user-approved decoupling)

### 3.7 Auxiliary
- `EmailTemplate` + `EmailLog` + `InboundEmail` (DB-backed templates, delivery audit, inbound parsing queue)
- `Notification` (in-app bell)
- `AuditLog` (every write, actor + before/after)
- `ExchangeRate` (daily cron fill, fallback to most recent)
- `FeatureFlag`, `Setting`, `SavedView`

---

## 4. Authentication & authorization

### 4.1 Flow diagram

```
Signup → User(status=PENDING) created
      → Email to all admins (AUTH_ADMIN_NEW_SIGNUP template)

Admin → Pending Approvals page
      → Assign role + primary country → user.status=ACTIVE
        - user.mustChangePassword=true
        - audit log entry
      → Email user with link to /forgot-password?email=…
        (reuses the OTP reset flow as the first-password flow)

User  → /forgot-password → receives OTP → sets initial password
      → Logs in → dashboard
```

### 4.2 Runtime
- **JWT strategy** (8h lifetime) — no DB hit per request
- **Edge middleware** uses `auth-edge.ts` (no Prisma) to read the JWT cookie and enforce:
  - unauthenticated → redirect to `/login?callbackUrl=…`
  - `mustChangePassword=true` → force to `/set-password`
  - authenticated but on public page → redirect to `/`
- **Full auth config** (`auth.ts`) runs in the Node.js runtime for route handlers and server actions — handles credentials verification, lockout, and Prisma lookups.

### 4.3 Account protection
- Password hashing: `bcryptjs` (10 rounds)
- Lockout: 5 failed attempts in 15 minutes → 30-minute lockout (configurable via env)
- Passwords hashed before storage; `passwordHash` never leaves the server

---

## 5. Email / webhook integration

### 5.1 Outbound — Power Automate
`src/lib/email/dispatcher.ts`:
- Loads template from `EmailTemplate` by `(key, locale)`
- Renders with `{{placeholder}}` substitution
- Writes `EmailLog(status=PENDING)`
- If `POWER_AUTOMATE_WEBHOOK_URL` is set → POST signed payload, update log to `SENT`/`FAILED`
- If not set → log payload to `console.info` (dev) and mark log `SENT` (stub)

Payload shape (to Power Automate):
```json
{
  "to": "user@example.com",
  "subject": "…",
  "bodyHtml": "…",
  "bodyText": "…",
  "contextType": "AUTH" | "CASE" | "BATCH" | "PROMO" | "STORE",
  "contextId": "…",
  "templateKey": "AUTH_SIGNUP_APPROVED",
  "locale": "en",
  "signature": "hmac-sha256(key=SIGNING_SECRET, value=body)"
}
```

### 5.2 Inbound — `/api/webhooks/power-automate`
- Verifies `x-wow-signature` header matches `POWER_AUTOMATE_INBOUND_SECRET`
- Persists raw email in `InboundEmail` with `parseStatus=PENDING`
- (Phase 3) Background worker parses: approval batch replies, KNET ARN suggestions, customer replies, etc.

---

## 6. Internationalization

- `next-intl` with locales `en` and `ar`
- Routing: `localePrefix: 'as-needed'` (EN at `/`, AR at `/ar/…`)
- Messages in `src/i18n/messages/{en,ar}.json`
- RTL enabled by `dir="rtl"` on the `[locale]` layout when `locale === 'ar'`
- Logical-property CSS throughout (`ms-`, `me-`, `ps-`, `pe-`) so layouts flip automatically

---

## 7. Design system

Tokens in `tailwind.config.ts` + CSS variables in `app/globals.css`.

### Colors (Stripe-inspired)
```
primary:      hsl(246 95% 61%)   // #533afd
primary-hover:hsl(246 95% 55%)
navy:         #061b31             // dark surface + primary text
ruby:         hsl(344 82% 53%)    // destructive
success/warning/info — additional semantic tokens
```

### Typography
- `Inter Variable` (system-aligned)
- `JetBrains Mono` for tabular numbers / monospace UI
- Scale: `display-xl` (56 / 300) · `display-lg` (48 / 300) · `heading-lg` (24 / 500) · `body-lg / body-md / body-sm` · `caption`

### Shadows (blue-tinted, multi-layer)
```
DEFAULT: 0 2px 5px rgba(50,50,93,.15), 0 1px 2px rgba(0,0,0,.08)
md:      0 6px 12px rgba(50,50,93,.15), 0 3px 7px rgba(0,0,0,.08)
lg:      0 13px 27px rgba(50,50,93,.25), 0 8px 16px rgba(0,0,0,.1)
```

### Light mode primary, dark mode secondary
`next-themes` with `data-theme` attribute. Default is `light`; users can toggle dark mode from the top bar.

---

## 8. Directory conventions

- **Server Actions** live in `app/actions/*.ts` with `'use server'` at the top of the file
- **Server Components** are the default; mark Client Components with `'use client'`
- **Feature routes** in `app/[locale]/(group)/feature/` with co-located `page.tsx`, `loading.tsx`, `error.tsx`, and form components
- **Validators** (Zod) live in `packages/validators/src/` and are shared by forms and Server Actions
- **UI primitives** (Button, Input, Card, etc.) live in `apps/web/src/components/ui/` for now and can be extracted to `packages/ui` once stable

---

## 9. Environment variables

See `apps/web/.env.example`. Key flags:

| Variable | Purpose | Dev fallback |
|---|---|---|
| `DATABASE_URL` | Prisma connection string | `file:./dev.db` |
| `AUTH_SECRET` | JWT signing key | `development-secret-…` |
| `AUTH_URL` | Base URL for callbacks | `http://localhost:3000` |
| `POWER_AUTOMATE_WEBHOOK_URL` | Outbound email destination | blank → console log |
| `POWER_AUTOMATE_SIGNING_SECRET` | HMAC of outbound payloads | blank |
| `POWER_AUTOMATE_INBOUND_SECRET` | Verify inbound webhooks | blank → unchecked in dev |
| `LOGIN_LOCKOUT_ATTEMPTS` | Failed attempts before lockout | `5` |
| `LOGIN_LOCKOUT_WINDOW_MINUTES` | Rolling window | `15` |
| `LOGIN_LOCKOUT_DURATION_MINUTES` | Lockout duration | `30` |

---

## 10. Phase roadmap

| Phase | Scope | Status |
|---|---|---|
| **1** | Monorepo, auth, admin approvals, design system, i18n, schema | ✅ this PR |
| **2** | Refund cases (create/list/details), components, Aura sidecar, state machine, duplicate detection, customer lookup, notes + @mentions | 🚧 partial (schema done, UI stubs) |
| 3 | Approval batches, KNET batches, Aura batches, ARN suggestions, Refund Operations Desk | ☐ |
| 4 | Promo system (both types) + Stores Communication module | ☐ |
| 5 | Full admin panel (dynamic configs for all domain knobs) | ☐ |
| 6 | In-app notifications, global search, bulk ops, SLA tracking, fraud signals | ☐ |
| 7 | Reports, analytics, Excel export, saved views, scheduled reports | ☐ |
| 8 | Polish: onboarding tour, keyboard shortcuts, changelog, dark mode refinements | ☐ |

---

## 11. Out of scope (per user decisions)

These were explicitly deferred or rejected:
- File attachments (notes + @mentions replace this workflow)
- 2FA for admins
- Holiday calendar per country
- Case audit certificate PDFs
- Sandbox / training mode
- Webhook outbox for third-party integrations
- External API keys
- Agent performance metrics beyond cases-raised and promo-budget

Document any change to this list in the PR and update this section.
