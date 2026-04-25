# WOW Refund Platform — Deep Analysis & Development Roadmap

> Audit date: 2026‑04‑25 · Scope: full repo (code, schema, docs, UI tokens, API contracts, business rules).
> Author: engineering audit for **omdawbas2015/wow-refund-platform**.
> Purpose: Establish a single source of truth for what exists, what works, what is broken, and what to build next to deliver a Stripe‑grade enterprise refund system.

---

## 0. Executive Summary (TL;DR)

**The bones are good.** The platform has real enterprise primitives — component‑level refund tracking, approval batching via email tokens, Power Automate webhooks, audit logging via Prisma extensions, Excel export for finance, and a carefully themed Stripe‑inspired Tailwind token layer.

**But the house is unfinished.** Six frontend pages call API endpoints that don't exist on the server. Critical business rules (KNET Auth Code enforcement, Aura points numeric validation, state‑machine integrity) are only partially implemented. Security surface includes a hardcoded backdoor user, no rate‑limiting, no CORS/helmet, and an auth‑less metadata endpoint. The backend is a single 3,231‑line `server.ts` file with one extracted route module (analytics).

**Verdict:** To ship a "world‑class, Stripe‑grade" product, we need a P0 sprint that (a) fixes the frontend↔backend contract breaks, (b) enforces business‑rule validation, (c) closes the security holes, then a P1 sprint that modularizes the backend into routes/services/repositories and unifies the design system. UI is close to Stripe language but fragmented — unification will produce the "عبقري / مبهر" feel the user described, without risking IP issues.

---

## 1. Repository Inventory (File‑by‑File Status)

Legend: ✅ **Works**  ⚠️ **Works with caveats**  ❌ **Broken / missing contract**  🗑 **Obsolete / dead code**  📦 **Boilerplate kept for future**

### 1.1 Repo root (loose scripts)

| File | LOC | Status | Purpose | Verdict |
|---|---:|---|---|---|
| `server.ts` | 3,231 | ⚠️ | Express app, 85 routes, Prisma extension, cron, batch email HTML. Monolith. | Split into `server/routes/*` urgently. |
| `package.json` | — | ⚠️ | Dev scripts hardcode secrets (`JWT_SECRET=local-dev-secret`). Many unused deps: `three`, `@google/genai`, `isomorphic-git`, `@octokit/rest`. | Prune, and use `.env.local` not inline env. |
| `vite.config.ts` | — | ✅ | Standard. | Keep. |
| `seed.ts` | 272 | ⚠️ | Root seed. | Duplicate of `prisma/seed.ts`. Keep only one. |
| `seed_demo.ts` | 131 | ⚠️ | Demo seed. | Duplicate of `prisma/seed_demo.ts`. |
| `seed_components.ts` | 113 | ⚠️ | Component fixtures. | Consolidate with prisma seeds. |
| `seed_flags.ts` / `seed_flags.js` | 90 / 108 | 🗑 | Two copies, JS is auto‑compiled leftover. | Delete the `.js`. |
| `test3.ts`, `test_login.ts`, `check_db.ts`, `check_users.ts`, `test-prisma.ts` | <40 each | 🗑 | Developer one‑offs; no test runner configured. | Delete or move to `scripts/debug/`. |
| `dev.db`, `main.db` | binary | 🗑 | Committed SQLite binaries. | Must `.gitignore`. |
| `README.md` | 34 | ⚠️ | Minimal. | Rewrite for new devs. |
| `AGENTS.md`, `DESIGN.md`, `HANDOFF.md` | — | ✅ | Project contracts. | Keep and maintain. |

### 1.2 `prisma/`

| File | Status | Verdict |
|---|---|---|
| `schema.prisma` (PostgreSQL) | ⚠️ | Target schema. Good comments on enums‑as‑strings. No indexes beyond `@unique`. |
| `schema.local.prisma` (SQLite) | ⚠️ | Drifted vs main (no inline comments). Risk of divergence. |
| `seed.ts`, `seed_demo.ts`, `seed-random.ts`, `seed_full.ts` | ⚠️ | Four seed scripts; pick one canonical. |
| `dev.db`, `main.db` | 🗑 | Committed binaries. |

### 1.3 `server/`

| File | LOC | Status | Verdict |
|---|---:|---|---|
| `middlewares.ts` | 63 | ✅ | `authenticate`, `isAdmin`, `authenticateInternal`, `withErrorHandling`. Production‑hardened. |
| `validation.ts` | 61 | ⚠️ | Only three schemas (`caseSchema`, `promoSchema`, `userSchema`). No component‑level auth code enforcement. |
| `routes/analytics.ts` | 371 | ✅ | The only extracted route module. Pattern to replicate. |
| `utils/currency.ts` | — | ✅ | `getExchangeRates`, `convertToKWD`, `CURRENCY_MAP`. |

### 1.4 `src/` (frontend)

**App shell / components:**

| File | LOC | Status | Notes |
|---|---:|---|---|
| `App.tsx` | 120 | ✅ | Lazy routes, PrivateRoute guard, redirects. |
| `components/app-shell/AppShell.tsx` | 42 | ✅ | Sidebar + Header + outlet. |
| `components/app-shell/Sidebar.tsx` | 164 | ⚠️ | Hardcoded "Test mode / New business" (leftover from Stripe mockup). RBAC by `localStorage.user.role` only. |
| `components/app-shell/Header.tsx` | 135 | ✅ | — |
| `components/GlobalSearch.tsx` | 171 | ✅ | Hits `/api/search/global`. |
| `components/CommandPalette.tsx` | 127 | ✅ | — |
| `components/ThemeProvider.tsx` | 6 | 🗑 | Stub — does nothing. Dark mode not implemented. |
| `components/ParticleWave.tsx` | 184 | 📦 | Decorative only; not rendered anywhere useful. |
| `components/Layout.tsx` | 9 | ✅ | Delegates to AppShell. |
| `components/ui/*` | — | ✅ | shadcn‑style primitives (select, dialog, dropdown, checkbox …). |
| `lib/api.ts` | — | ⚠️ | Exists but **pages still create per‑file axios instances** with `localStorage.getItem('token')` captured at import time (stale tokens after re‑login). |
| `lib/utils.ts` | — | ✅ | `cn()` helper. |
| `lib/exportUtils.ts` | — | ✅ | Excel export. |
| `index.css` | 72 | ⚠️ | Stripe tokens (`--color-stripe-blurple`, `stripe-surface`, `stripe-input-field`). Missing dark‑mode tokens, no semantic roles (`color-danger`, `color-success`). |

**Pages (13 files, 4,847 LOC total):**

| Page | LOC | Status | Endpoints called | Issues |
|---|---:|---|---|---|
| `Login.tsx` | 119 | ✅ | `POST /api/auth/login` | Uses `stripe-card` / `stripe-input` classes — **not defined** in index.css (only `stripe-surface` / `stripe-input-field` are). Renders, but falls back to default browser styles. |
| `Dashboard.tsx` | 232 | ❌ | `GET /api/dashboard` — **doesn't exist** (backend has `/api/stats`). Chart data is **hardcoded** literal array. | Entire page shows stub numbers. |
| `CaseList.tsx` | 291 | ⚠️ | `GET /api/cases` | **Client‑side pagination of full array** (no server pagination). Missing KPI summary row. |
| `CaseCreate.tsx` | 325 | ⚠️ | `POST /api/cases`, `GET /api/metadata` | **Does NOT render the `externalRef` (KNET Auth Code) input** even though the zod schema declares it. KNET cases can be submitted with no auth code. |
| `CaseDetails.tsx` | 321 | ❌ | `GET /api/cases/:id` (✅), `PATCH /api/cases/:id/status` (**doesn't exist**; real endpoint is `PATCH /api/cases/:id`). | "Approve for payout" button is wired to the wrong endpoint — silently fails. |
| `RefundExecutionDashboard.tsx` | 208 | ❌ | `GET /api/admin/refund-batches` + `POST /api/cases/:id/settle` — **neither exists**. Real endpoints: `/api/admin/refunds/knet-batches` and `/api/admin/refunds/mark-refunded`. KPIs are hardcoded strings. |
| `RefundOpsHub.tsx` | 216 | ❌ | `GET /api/admin/ops-queue` — **doesn't exist** (real: `/api/admin/refunds/hub-data`). `PATCH /api/cases/:id/status` — doesn't exist. |
| `PromoRequest.tsx` | 451 | ✅ | `/api/metadata`, `/api/promo/inventory`, `/api/promo/values`, `/api/promo/ledger`, `/api/cases/search`, `/api/promo/request` | Most complete page. Good duplicate‑override UX. |
| `AdminPromo.tsx` | 388 | ✅ | `/api/promo`, `/api/promo/inventory`, `POST /api/promo` | Works. |
| `Analytics.tsx` | 323 | ✅ | `/api/countries`, `/api/analytics` (mounted via `analyticsRoutes`) | Works. |
| `AutomationEmails.tsx` | 323 | ⚠️ | `/api/admin/templates`, `/api/admin/email-logs` | Works; UI duplicates patterns. |
| `HelpDesk.tsx` | 327 | ✅ | `/api/help-desk/submit`, `/api/help-desk/history` | Works. |
| `AdminPanel.tsx` | 261 | ⚠️ | `/api/admin/users`, `/api/admin/countries`, `/api/admin/config` | Works; largely superseded by `pages/system/` tabs. |
| `EnterpriseControl.tsx` | 224 | ⚠️ | `/api/admin/templates`, `/api/admin/teams`, `/api/admin/email-logs` | Parallel admin surface — candidate for merge/retire. |
| `pages/system/SystemPanel.tsx` + `tabs/*` | — | ⚠️ | Per‑tab axios; `AuditTab` calls `/api/admin/audit-logs` which **doesn't exist** (real: `/api/admin/audit`). |

### 1.5 `docs/`

| File | Status | Verdict |
|---|---|---|
| `CURRENT_STATE.md`, `HANDOFF.md`, `AGENTS.md`, `DESIGN.md` | ✅ | Keep as project memory. |
| `enterprise-refund-platform.md` | ✅ | Target architecture — authoritative. |
| `enterprise-schema.sql` | ✅ | Target normalized schema (superset of current Prisma). |
| `agent-references/` | ✅ | Excluded from TS — do not run. Reading material only. |

### 1.6 Dead / Suspicious Dependencies

Imported in `package.json` but I found zero runtime usage:

- `three` (WebGL; decorative only — ParticleWave imports three.js?)
- `@google/genai`
- `isomorphic-git`
- `@octokit/rest`
- `next-themes` (no dark mode exists yet)
- `@fontsource-variable/geist` (not imported)
- `tw-animate-css`

Removing these drops install size ~30 MB and speeds `vite build`.

---

## 2. Data Model Audit

### 2.1 Core entities (`prisma/schema.prisma`)

```
User ─┬─< RefundCase[] (as agent / creator / closer)
       └─< Notification[]

Country ──< Branch ──< RefundCase
RootCause ──< RefundCase
Brand ──< RefundCase (optional)

RefundCase ─┬─< RefundComponent[]    (payment splits)
             ├─< ApprovalToken[]      (email approval)
             ├─< ContactAttempt[]     (customer contact log)
             ├─< AuditLog[]
             ├─< Comment[]
             ├─< PromoUsage[]
             ├── ApprovalBatch        (many→1, daily batch)
             └── RefundBatch          (KNET export batch)

PromoCode  ──1:1── PromoUsage         (external compensation)
InternalPromoCode ──1:1── InternalPromoUsage
```

### 2.2 Business‑rule gaps in the schema

1. **KNET Auth Code (AETH) is a loose String column.** `RefundCase.authCode` and `RefundComponent.externalRef` are both `String?`. No regex, no format check, no "required when paymentMethod is KNET" DB constraint. The rule lives only in `server/validation.ts` for the **legacy** `paymentMethod: 'KNET'` path — **not** for the new `components[]` path.
2. **Aura points stored as `String`** (`RefundCase.auraPoints: String?`). Prevents numeric math, aggregation, and proper validation. Should be `Int` or `Decimal`.
3. **Status fields are untyped strings** on `RefundCase`. Prisma comment says 6 values; runtime code uses at least 11: `DRAFT | PENDING_APPROVAL | APPROVED | PARTIALLY_REFUNDED | REFUNDED | PENDING_EXTERNAL | PENDING_KNET | PENDING_REFUND | PROCESSING_EXECUTION | KNET-MANUAL REFUND | REJECTED`. No state‑machine enforcement; `PATCH /api/cases/:id` will persist any free‑form status.
4. **`paymentMethod` and `refundId` marked "Legacy"** on `RefundCase` but still read/written. Dual model (case‑level + component‑level) creates rollup ambiguity.
5. **No indexes** beyond `@unique` on `caseNumber`, `code`, `email`. Queries filtering by `status`, `countryId`, `createdAt`, `refundBatchId` will degrade past ~100k rows.
6. **Missing FK `onDelete` rules** on most relations — only `RefundComponent.case` is `Cascade`.
7. **No soft‑delete / archival** columns on `RefundCase`, `PromoCode`, `User`.
8. **No unique guard** preventing two `COMPENSATION` promos on one case at the DB layer (enforced only in app code).
9. **Approval batches** don't track per‑case approval decisions — just a batch‑level `PENDING | APPROVED | REJECTED`. You can't approve half a batch.
10. **Drift between `schema.prisma` and `schema.local.prisma`** (inline comments diverge). Future refactors will need to pick one and generate the other.

---

## 3. API Surface (85 endpoints in `server.ts` + 2 in analytics)

Full inventory with auth / validation status. `🔒` = JWT required, `👑` = admin only, `🔑` = internal webhook secret, `🌐` = public.

### 3.1 Auth & metadata
| Method | Path | Auth | Valid | Notes |
|---|---|---|---|---|
| POST | `/api/auth/login` | 🌐 | none | **🔴 Hardcoded backdoor:** `omdawbas2015@gmail.com` creates the user if missing **and overwrites the password with whatever is typed**. |
| GET | `/api/metadata` | 🌐 | — | **🔴 No auth.** Returns all countries, branches, brands, root causes. |
| GET | `/api/countries` | 🔒 | — | |
| GET | `/api/agents` | 🔒 | — | |
| GET | `/api/root-causes` | 🔒 | — | |

### 3.2 Cases (core flow)
| Method | Path | Auth | Valid | Notes |
|---|---|---|---|---|
| GET | `/api/cases` | 🔒 | — | **No pagination.** Returns all cases + includes. |
| GET | `/api/cases/:id` | 🔒 | — | No pagination for nested logs/comments. |
| POST | `/api/cases` | 🔒 | `caseSchema` | `authCode` required only for **legacy** KNET path (see §4.1). |
| PATCH | `/api/cases/:id` | 🔒 | **none** | Mass‑assignment — any field (including `status`) accepted as‑is. |
| POST | `/api/cases/:id/submit` | 🔒 | — | Generates approval token (24h). |
| POST | `/api/cases/:id/emergency-approve` | 🔒👑 | — | Admin bypass. |
| POST | `/api/cases/:id/contact` | 🔒 | — | Log customer contact. |
| POST | `/api/cases/:id/comments` | 🔒 | — | |
| PATCH | `/api/cases/:caseId/components/:componentId` | 🔒👑 | inline | Admin rollup. |
| PATCH | `/api/cases/:id/components/:compId` | 🔒 | inline | Agent rollup. **Duplicate route, differing permissions.** |
| POST | `/api/cases/batch-knet` | 🔒 | — | Email grouping. |
| POST | `/api/cases/batch-aura` | 🔒 | — | Email grouping. |
| GET | `/api/cases/search` | 🔒 | — | Autocomplete for PromoRequest. |
| GET | `/api/search/global` | 🔒 | — | |

### 3.3 Approval
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/approval/confirm` | 🌐 (token) | Single‑case approval via email link. |
| GET | `/api/approval/batch-confirm` | 🌐 (token) | Daily batch approval. |
| POST | `/api/internal/generate-approval-batch` | 🔑 | Power Automate. |
| POST | `/api/internal/cases/batch-drafts` | 🔑 | Power Automate. |
| POST | `/api/internal/cases/external-approve` | 🔑 | Power Automate callback. |

### 3.4 Refund execution
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/admin/refunds/knet-pending` | 🔒👑 | — |
| GET | `/api/admin/refunds/aura-pending` | 🔒👑 | — |
| POST | `/api/admin/refunds/aura-complete/:id` | 🔒👑 | — |
| GET | `/api/admin/refunds/knet-batches` | 🔒👑 | — |
| POST | `/api/admin/refunds/knet-batch/complete/:id` | 🔒👑 | — |
| POST | `/api/admin/refunds/knet-batch/send` | 🔒👑 | Generates Excel; **uses `RefundCase.authCode`, not `RefundComponent.externalRef`** — new cases export `N/A`. |
| GET | `/api/admin/refunds/pending-execution` | 🔒👑 | — |
| POST | `/api/admin/refunds/mark-refunded` | 🔒👑 | Manual execution confirm. |
| GET | `/api/admin/refunds/hub-data` | 🔒👑 | — |

### 3.5 Promo (compensation + internal)
| Method | Path | Auth | Notes |
|---|---|---|---|
| POST | `/api/promo/request` | 🔒 | `promoSchema`. Duplicate‑override logic is solid. |
| POST | `/api/promo/return` | 🔒 | — |
| POST | `/api/promo/retry-email` | 🔒 | — |
| GET | `/api/promo` | 🔒👑 | — |
| POST | `/api/promo` | 🔒👑 | — |
| POST | `/api/promo/bulk` | 🔒👑 | — |
| PATCH | `/api/promo/:id` | 🔒👑 | — |
| DELETE | `/api/promo/:id` | 🔒👑 | — |
| GET | `/api/admin/promo/export` | 🔒👑 | — |
| GET | `/api/promo/values` | 🔒 | — |
| GET | `/api/promo/inventory` | 🔒 | — |
| GET | `/api/promo/inventory/detailed` | 🔒👑 | — |
| GET | `/api/promo/ledger` | 🔒 | — |

### 3.6 Admin / settings
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET / POST / PATCH / DELETE | `/api/admin/brands` | 🔒👑 | — |
| GET / POST / PATCH | `/api/admin/countries` | 🔒👑 | — |
| GET / POST / PATCH | `/api/admin/branches` | 🔒👑 | — |
| GET / POST / PATCH | `/api/admin/root-causes` | 🔒👑 | — |
| PATCH | `/api/metadata/countries/:id/managerEmail` | 🔒👑 | — |
| GET / POST / PATCH | `/api/admin/users` | 🔒👑 | `userSchema` only on POST. |
| GET / PATCH | `/api/admin/config` | 🔒👑 | — |
| GET | `/api/admin/audit` | 🔒👑 | `AuditTab.tsx` calls `/api/admin/audit-logs` — **wrong path**. |
| GET / POST / PATCH / DELETE | `/api/admin/templates` | 🔒👑 | — |
| GET / POST / PATCH | `/api/admin/teams` | 🔒👑 | — |
| GET / POST / PATCH | `/api/admin/automation-rules` | 🔒👑 | — |
| GET | `/api/admin/email-logs` | 🔒👑 | — |
| POST | `/api/admin/send-email` | 🔒 | — |
| POST | `/api/admin/seed-data` | 🔒👑 | Demo seed — fine to keep, guard with env flag. |

### 3.7 Stats, notifications, help
| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/api/stats` | 🔒 | Heavy query (all refunded cases + exchange rates + agent perf). No caching. |
| GET | `/api/analytics` | 🔒👑 | Mounted via `analyticsRoutes`; double‑guarded via `app.use('/api', authenticate, isAdmin, analyticsRoutes)`. |
| GET | `/api/notifications` | 🔒 | — |
| PATCH | `/api/notifications/:id/read` | 🔒 | — |
| PATCH | `/api/notifications/read-all` | 🔒 | — |
| POST | `/api/help-desk/submit` | 🔒 | — |
| GET | `/api/help-desk/history` | 🔒 | — |

### 3.8 Frontend↔Backend contract breaks (❌ will fail at runtime)

| Page | Calls | Backend has | Action |
|---|---|---|---|
| Dashboard.tsx | `GET /api/dashboard` | `/api/stats` | Rename call or add `/api/dashboard` alias. |
| CaseDetails.tsx | `PATCH /api/cases/:id/status` | `PATCH /api/cases/:id` | Fix caller or add `/status` alias. |
| RefundOpsHub.tsx | `GET /api/admin/ops-queue` + `PATCH /api/cases/:id/status` | `/api/admin/refunds/hub-data` + `PATCH /api/cases/:id` | Rewrite page data layer. |
| RefundExecutionDashboard.tsx | `GET /api/admin/refund-batches` + `POST /api/cases/:id/settle` | `/api/admin/refunds/knet-batches` + `/api/admin/refunds/mark-refunded` | Rewrite. |
| AuditTab.tsx | `GET /api/admin/audit-logs` | `/api/admin/audit` | Fix caller. |

Until P0 fixes land, **five admin screens return 404 / blank tables**. This matches the user's earlier observation that "Refund cases" page appeared blank after a stale render.

---

## 4. Business Rules — Implementation Status

### 4.1 KNET + Auth Code (AETH) 🟡 Partial

**Rule (from user, Arabic):** "KNET لازم يكون ليه AETH كود" — every KNET refund component must carry an authorization code from the payment processor.

**Current state:**
- Legacy path (`paymentMethod: 'KNET'` at case level): `caseSchema.refine()` requires `authCode` with min 4 chars. ✅
- New path (`components: [{ paymentMethod: 'KNET', externalRef: null }]`): `componentSchema` marks `externalRef` as **optional**. ❌
- `CaseCreate.tsx` form does **not** render `externalRef` field at all (schema has it, UI doesn't). ❌
- Excel export (`/api/admin/refunds/knet-batch/send`) reads `c.authCode` from the case, not from the KNET component. ❌

**Impact:** Finance receives KNET refund batches with "Auth Code: N/A" for any case created via the new UI. Manual workaround: agents type the auth code into `refundReason`. This is the exact kind of invisible data‑quality debt that makes audit fail.

**Fix (P0):**
1. `componentSchema` in `server/validation.ts` → `z.object({...}).refine(c => c.paymentMethod !== 'KNET' || (c.externalRef && c.externalRef.length >= 4), 'Auth Code required for KNET')`.
2. Add `<input>` for Auth Code in `CaseCreate.tsx` visible whenever `paymentMethod === 'KNET'` (conditional render inside the `fields.map`).
3. Update `/api/admin/refunds/knet-batch/send` Excel builder to prefer `component.externalRef` with fallback to `case.authCode`.
4. DB migration: backfill `components[knet].externalRef = case.authCode` for historical data, then add a NOT‑NULL + format check partial index.

### 4.2 Aura Points 🟡 Partial

**Rule:** Every case that includes Aura as a payment source must track a points count and move through `NONE → PENDING → COMPLETED`.

**Current state:**
- `RefundCase.auraPoints: String?` — type wrong. ⚠️
- `RefundCase.auraStatus` flipped to `PENDING` on approval if `auraPoints` is truthy (`/api/approval/confirm` line 2257). ✅
- `POST /api/admin/refunds/aura-complete/:id` flips to `COMPLETED`. ✅
- **No sync** between `RefundComponent(paymentMethod=AURA).status` and `RefundCase.auraStatus`. If you mark the AURA component as COMPLETED, `auraStatus` stays `PENDING` forever. ❌
- No numeric validation on `auraPoints`. A typo like `"1OOO"` (letter O) is silently stored. ❌

**Fix (P1):**
1. Change column type: `auraPoints: Int?` with migration that parses existing strings.
2. In the component rollup handlers, flip `auraStatus` when the AURA component completes.
3. Validate input as positive integer in `componentSchema` when `paymentMethod === 'AURA'`.
4. Dashboard KPI: "Aura points pending reversal" tile fed by `SUM(auraPoints) WHERE auraStatus = PENDING`.

### 4.3 Approval flow 🟢 Mostly solid

- Email tokens: 24h (single case) / 72h (batch), uuid v4, single‑use (`isUsed: true`). ✅
- Tokens accepted via query param. Safe for email clicks but logs may capture them. ⚠️
- Rejection path resets case to `DRAFT` — history is preserved in audit log but status‑flow‑wise we lose "why" and can't distinguish a never‑submitted draft from a rejected one. ⚠️
- No reason capture on rejection. ⚠️
- Batch approve is all‑or‑nothing — no per‑case decision. ⚠️

**Fix (P1):** Add a `REJECTED` status, capture `rejectionReason` (enum + free text), per‑case approval decisions in batch workflow.

### 4.4 Promo (external compensation + internal 100%) 🟢 Solid

- Transactional allocation with optimistic concurrency (`updateMany where status=AVAILABLE`, retry on zero rows) — prevents double‑assignment under load. ✅
- Duplicate handling: `COMPENSATION` hard‑blocked; `INTERNAL_100` requires `forceDuplicate` override. ✅
- Orphan linking: promo requested before case exists is adopted when case is later created (`POST /api/cases` line 1769). ✅
- Missing: expiry filter in `findFirst` (codes past `expiresAt` can still be allocated). ⚠️
- Missing: per‑agent rate limit / cap (an agent can burn an entire brand's stock in minutes). ⚠️

### 4.5 Refund state machine 🟡

Listed statuses in code: `DRAFT, PENDING_APPROVAL, APPROVED, PENDING_KNET, PENDING_REFUND, PROCESSING_EXECUTION, PARTIALLY_REFUNDED, REFUNDED, PENDING_EXTERNAL, KNET-MANUAL REFUND, REJECTED`.

Legal transitions (inferred):

```
DRAFT ──submit──> PENDING_APPROVAL
PENDING_APPROVAL ──approve(non-KNET)──> PENDING_REFUND
PENDING_APPROVAL ──approve(KNET)──────> PENDING_KNET
PENDING_APPROVAL ──reject─────────────> DRAFT   (should be REJECTED)
PENDING_REFUND / PENDING_KNET ──component complete──> PROCESSING_EXECUTION
                                        ──all complete──> REFUNDED or PARTIALLY_REFUNDED
APPROVED / * ──mark-refunded──> REFUNDED
```

No state‑machine library, no central `canTransition(from,to)` check. `PATCH /api/cases/:id` accepts any status string — an agent could move a case directly to `REFUNDED` by crafting the request.

**Fix (P0 security, P1 UX):** Introduce `server/services/caseState.ts` with `xstate` or a handwritten transition matrix. Apply it in every mutation path.

### 4.6 Audit logging 🟢

Prisma `$extends` hook auto‑logs `CASE_CREATED` and `CASE_UPDATED` with actor from `AsyncLocalStorage`. Explicit `logAudit(...)` calls cover approval, batch, refund, promo. Coverage is good; main risk is the hook silently swallows errors (`.catch(() => {})` pattern inside the extension).

---

## 5. Security Audit

| # | Finding | Severity | Location |
|---|---|---|---|
| S1 | **Hardcoded login backdoor** for `omdawbas2015@gmail.com` — overwrites password with whatever is typed. Anyone who knows the email can claim the account. | 🔴 Critical | `server.ts:1576‑1595` |
| S2 | `GET /api/metadata` has **no authentication**. Leaks country list, branches (with manager emails), brands. | 🔴 Critical | `server.ts:1642` |
| S3 | `PATCH /api/cases/:id` accepts **arbitrary body** — mass assignment including `status`, `approvedAt`, `agentId`. | 🔴 Critical | `server.ts:2101` |
| S4 | Dev JWT secret fallback (`'dev-only-refund-portal-secret'`). If `NODE_ENV` ever misconfigured, tokens become forgeable. | 🟠 High | `server/middlewares.ts:2` |
| S5 | Dev `INTERNAL_WEBHOOK_SECRET` is open (`if (!expectedSecret) return next()`). Internal endpoints unauthenticated in dev. | 🟠 High | `server/middlewares.ts:42` |
| S6 | No `helmet`, no `cors`, no `express-rate-limit`. Only `express.json()` middleware. | 🟠 High | `server.ts:260` |
| S7 | Token accepted via `?token=` query string — ends up in access logs / referrers. | 🟡 Medium | `server/middlewares.ts:14` |
| S8 | No refresh token, fixed 8h JWT expiry. | 🟡 Medium | `server.ts:1601` |
| S9 | Password min length 6 chars (`userSchema`). Weak. | 🟡 Medium | `server/validation.ts:58` |
| S10 | Audit extension swallows its own errors silently. | 🟡 Medium | `server.ts:79‑121` |
| S11 | `dev.db` / `main.db` committed to repo. Any local data lives in git history. | 🟠 High | repo root |
| S12 | Dev scripts hardcode secrets in `package.json` (`JWT_SECRET=local-dev-secret`). | 🟡 Medium | `package.json` |
| S13 | Only two roles (`ADMIN` / `AGENT`). No manager, finance, auditor separation despite domain demanding it. | 🟡 Medium | schema |

---

## 6. Performance Audit

- **`GET /api/cases`** returns every case with nested `agent`, `country`, `branch`, `rootCause`, `components`, `brand`. O(N) joins, no pagination, no `take`. Will fall over past 5k cases.
- **`GET /api/cases/:id`** eager‑loads full comment + audit history. Unbounded growth per case.
- **`GET /api/stats`** runs 6 parallel queries + fetches exchange rates synchronously + iterates refunded cases in JS. No cache. Called from dashboards with `refetchInterval`.
- **Exchange rates** re‑fetched from external API on every stats call. Cache in memory with a 15‑minute TTL.
- **No database indexes** on high‑cardinality filter columns (`status`, `createdAt`, `countryId`, `refundBatchId`).
- **Prisma extension** runs extra queries for every create / update (audit log). Acceptable but should be behind a batched queue for hot paths.
- **No code splitting** on the frontend beyond route‑level `React.lazy`. Large bundles flagged in HANDOFF.

---

## 7. UI/UX Audit vs Stripe Design Language

**What's right already:**
- Design token namespace (`stripe-blurple #635bff`, `stripe-dark #1a1f36`, `stripe-slate`, `stripe-light-slate`, `stripe-border #e3e8ee`) — matches Stripe's palette intent.
- Component classes (`.stripe-surface`, `.stripe-input-field`, `.stripe-button-primary`) approximate Stripe's input & surface rhythm.
- Type scale baseline at 13px body / 12px labels / 28px h1 — in the right family.
- Information‑dense tables with sticky glass toolbar on `CaseList.tsx` mirror Stripe Dashboard conventions.

**What's wrong / inconsistent:**
1. **Two parallel naming systems.** `index.css` defines `.stripe-surface`, `.stripe-input-field`, `.stripe-button-primary`, but `Login.tsx` uses `.stripe-card`, `.stripe-input`, `.stripe-btn-primary` — **undefined classes**. Login form falls back to browser defaults.
2. **Dark mode is a stub.** `ThemeProvider.tsx` is 6 lines and does nothing. `next-themes` is installed but unused.
3. **No Arabic / RTL support.** DESIGN.md says "text readable in Arabic" but there's no `dir="rtl"` toggle, no Arabic font stack. For a Kuwait/GCC product this is essential.
4. **Hardcoded marketing copy in the sidebar:** "Test mode / New business" — leftover from a Stripe visual mockup. Operators will see this in production.
5. **KPI tiles are decorative, not data‑backed.** `RefundExecutionDashboard.tsx` ships literal `'12,450.00 KWD'` / `'99.8%'` strings. Dashboard chart is hardcoded too.
6. **Mixed headline sizes.** `.stripe-h1` is 28px in `index.css`; `CaseDetails.tsx` uses `text-[32px]`; `Dashboard.tsx` uses `text-[28px]` inline. No semantic heading component.
7. **Inconsistent button shapes** across pages: some `h-8 px-3 rounded-[5px]`, others `rounded-lg`, others `rounded-xl`. Stripe's rigor is one radius per role.
8. **Motion is noisy.** `motion/react` fade/slide on every page reload — Stripe uses motion sparingly (mainly on hover and state transitions). DESIGN.md explicitly warns against "decorative motion during repeated work".
9. **Missing empty & error states.** Most pages render a spinner on load, toasts on error — no skeletons, no empty illustrations, no retry affordance. DESIGN.md pre‑delivery check requires all four states.
10. **Info density too low on Dashboard** (huge hero chart with no data) and too high on PromoRequest (451 LOC single file mixing tabs, forms, history).
11. **Sidebar labels drift from domain:** "Settlements" (really KNET/Aura Ops), "Operations hub" (really `hub-data`), "Standard promo" / "Service recovery" — inconsistent with the Arabic business vocabulary the team actually uses.
12. **No design primitive for status pills.** Every page re‑implements badge coloring via ternaries. Should be `<StatusBadge status="PENDING_KNET" />`.
13. **No focus‑visible rings** in many custom buttons — accessibility gap flagged in DESIGN.md pre‑delivery.
14. **Responsive behavior is untested.** DESIGN.md requires 375 / 768 / 1024 / 1440 widths. `CaseCreate` form on 375 collapses the 3‑column grid but the Payment Sources row becomes cramped.

**Stripe‑grade gap list (what needs to exist):**
- Unified `DataTable` primitive with sticky header, column visibility, server‑side pagination, row selection, bulk actions, CSV/Excel export — currently re‑implemented ad hoc.
- Unified `StatusBadge`, `KPI`, `EmptyState`, `Skeleton`, `ErrorBoundary` components.
- Semantic token layer (primitives → roles → component tokens) per `DESIGN.md §Token Direction`.
- Dark mode (CSS `@theme dark` in Tailwind v4) + RTL toggle.
- Command palette upgrade: global keyboard shortcuts (`⌘K` exists, add `g c` = go to cases, `c` = create case, etc. — Stripe‑style).

---

## 8. Backend Refactor Plan (Monolith → Layered)

Current: `server.ts` (3,231 lines) + `server/middlewares.ts` + `server/validation.ts` + `server/routes/analytics.ts`.

**Target layout:**

```
server/
  app.ts                     # express init, helmet, cors, rate‑limit, error middleware
  index.ts                   # boot + cron + listen
  middlewares/
    authenticate.ts
    authenticateInternal.ts
    isAdmin.ts
    withErrorHandling.ts
    auditContext.ts          # AsyncLocalStorage wrapper
  routes/
    auth.ts
    cases.ts
    caseComponents.ts
    approval.ts
    refundExecution.ts       # /api/admin/refunds/*
    promo.ts
    internalPromo.ts
    admin/
      users.ts
      countries.ts
      branches.ts
      rootCauses.ts
      brands.ts
      templates.ts
      teams.ts
      automationRules.ts
      audit.ts
      config.ts
      emailLogs.ts
    internal/                # x-internal-secret guarded
      batchDrafts.ts
      externalApprove.ts
      generateApprovalBatch.ts
    analytics.ts             # already exists
    helpDesk.ts
    notifications.ts
    stats.ts
    search.ts
    metadata.ts
  services/
    caseService.ts           # create, submit, rollup, state transitions
    caseStateMachine.ts      # canTransition(from, to, actor)
    approvalService.ts
    promoService.ts
    refundExecutionService.ts
    emailService.ts          # KNET batch email HTML, approval emails
    excelService.ts          # finance export
    auditService.ts
    notificationService.ts
    exchangeRateService.ts   # cached, 15‑min TTL
  repositories/
    caseRepository.ts        # Prisma wrappers with pagination
    componentRepository.ts
    promoRepository.ts
    userRepository.ts
  validation/
    caseSchema.ts
    componentSchema.ts
    promoSchema.ts
    userSchema.ts
    adminSchemas.ts
  lib/
    prisma.ts                # singleton with $extends audit hook
    logger.ts                # structured JSON logs
    errors.ts                # ApiError classes + error middleware
```

**Migration sequence (low‑risk):**
1. Extract middlewares (already done in part).
2. Extract one domain at a time into `routes/*` + `services/*` + `repositories/*` — mirror the analytics pattern. Start with **promo** (cleanest) → then **cases** → then **admin**.
3. Add `validation/` middleware that runs zod on route entry (`validate(schema)`), so routes stay thin.
4. Add global error middleware that maps `ApiError` classes to HTTP codes and redacts internals.
5. Only rename `server.ts` → `server/index.ts` once every route has moved.

---

## 9. Priority Roadmap (P0 → P2)

### 🔴 P0 — Ship‑blocking (do first, 1‑2 sprints)

**P0 Backend / data integrity**
1. [S1] Remove the hardcoded login backdoor in `/api/auth/login`. Require admin‑provisioned users only.
2. [S2] Add `authenticate` to `GET /api/metadata`.
3. [S3] Add a zod whitelist schema to `PATCH /api/cases/:id`; reject `status`, `approvedAt`, `agentId`, `createdById`, `closedById` unless admin.
4. [4.5] Implement `caseStateMachine.ts` and enforce it in every case mutation.
5. [4.1] Enforce Auth Code for KNET at component level in `componentSchema`.
6. [4.1] Fix `/api/admin/refunds/knet-batch/send` Excel: prefer `component.externalRef`.
7. [3.8] Resolve the six frontend↔backend path mismatches — either fix the callers or add backend aliases. Recommended: fix callers so the API stays canonical.

**P0 Security hardening**
8. [S4–S6] Install `helmet`, `express-rate-limit` (60 rpm default, 5 rpm on `/api/auth/login`), and configure `cors` with an allowlist.
9. [S5] Make `authenticateInternal` refuse requests if secret is missing, regardless of `NODE_ENV`.
10. [S11] `git rm --cached dev.db main.db`, add to `.gitignore`.
11. [S12] Move dev secrets from `package.json` scripts to `.env.local` (not committed).

**P0 UX correctness**
12. Wire `Dashboard.tsx` to `/api/stats` (not the phantom `/api/dashboard`); kill hardcoded chart data, render real time series from audit log.
13. Wire `RefundOpsHub.tsx` and `RefundExecutionDashboard.tsx` to the real endpoints.
14. Wire `CaseDetails.tsx` approve action to `PATCH /api/cases/:id` with a whitelisted status body.
15. Add the Auth Code input to `CaseCreate.tsx` Payment Sources section, conditional on KNET selection.
16. Fix `Login.tsx` CSS classes (`stripe-card` → `stripe-surface`, `stripe-input` → `stripe-input-field`, `stripe-btn-primary` → `stripe-button stripe-button-primary`).

### 🟠 P1 — Stripe‑grade polish (weeks 3‑6)

**P1 Backend structure**
- Extract routes into `server/routes/*` (see §8), 1 domain per PR.
- Add pagination (`?limit=50&cursor=…`) to `/api/cases`, `/api/promo`, `/api/admin/audit`, `/api/admin/email-logs`.
- Add in‑memory cache for `exchangeRateService` (15 min TTL).
- Add Prisma indexes: `(status, countryId, createdAt)` on `RefundCase`; `(type, countryId, value, status)` on `PromoCode`.
- Migrate `auraPoints` to `Int`, `caseNumber` to a format‑constrained pattern, add a `REJECTED` status and `rejectionReason`.
- Introduce real migrations (replace `prisma db push` with `prisma migrate deploy`).
- Add at least smoke tests for: case create → submit → approve → component complete → status rollup.

**P1 Design system (Stripe‑grade unification)**
- Build a three‑layer token set (primitives → semantic → component) in `src/styles/tokens.css`, replacing the flat `--color-stripe-*` with roles (`--color-bg`, `--color-surface`, `--color-border`, `--color-primary`, `--color-danger`, `--color-success`, `--color-warning`, `--color-muted`).
- Implement dark mode via Tailwind v4 `@theme dark` and a working `ThemeProvider`.
- Add RTL support + Arabic font stack (Cairo / IBM Plex Sans Arabic) + `dir="rtl"` toggle keyed off user locale.
- Build primitives: `<DataTable>`, `<StatusBadge>`, `<KPI>`, `<Skeleton>`, `<EmptyState>`, `<PageHeader>`, `<SectionCard>`, `<FormField>`. Retrofit every page.
- Replace motion noise with Stripe‑spec micro‑interactions (hover, focus, enter/exit on modals only).
- Replace sidebar hardcoded "Test mode / New business" with real context (country + environment).

**P1 Features users will feel**
- RBAC: add `MANAGER`, `FINANCE`, `AUDITOR` roles; per‑route permission matrix.
- Per‑case approval in batches (not just all‑or‑nothing).
- Rejection with reason (enum + free text) + audit trail.
- Notifications over WebSocket/SSE instead of 60s polling.
- Command palette actions for every major flow (⌘K → "Create refund", "Approve batch KW‑2026‑0412", "Export KNET batch").

### 🟡 P2 — Scale & delight (later)

- Move from monolith Express to the HANDOFF‑stated target (Next.js + NestJS) — only after P0/P1 stabilize; do it as a Strangler migration, domain by domain.
- Real‑time dashboard: refund volume, SLA breach count, inventory alerts via Redis pub/sub.
- Finance reconciliation UI: match KNET batch Excel response to case rollup automatically.
- A11y audit pass (axe‑core in CI, contrast AAA on operator surfaces).
- E2E tests with Playwright against the seeded demo environment.
- OpenAPI / Swagger generated from zod schemas.
- Observability: structured logs (`pino`) + OpenTelemetry spans for each request.
- i18n: Arabic ↔ English for every user‑facing string.
- Design system website (Storybook) documenting every token and primitive.

---

## 10. Appendix — Concrete gaps you can hand to a dev this week

```
1. Add zod to PATCH /api/cases/:id        — server.ts:2101     — 1h
2. Enforce KNET authCode at component     — validation.ts:17   — 2h
3. Add authCode input to CaseCreate       — CaseCreate.tsx:213 — 2h
4. Fix 6 frontend endpoint paths          — 5 files            — 2h
5. Remove login backdoor                  — server.ts:1576     — 30m
6. Add authenticate to /api/metadata      — server.ts:1642     — 5m
7. Install helmet + rate‑limit + cors     — server.ts:260      — 1h
8. git rm --cached *.db + .gitignore      — repo root          — 5m
9. Replace Login.tsx CSS classes          — Login.tsx:49‑84    — 30m
10. Wire Dashboard.tsx to /api/stats      — Dashboard.tsx:42   — 3h
```

Estimated P0 effort: **~2 engineering days** for one competent dev. Everything above is tracked above with file:line references so it can be executed without re‑reading the codebase.

---

## 11. Closing Assessment

You have a serious, enterprise‑shaped refund platform underneath a thin demo‑quality skin. The data model, audit log, approval batching, and promo allocation logic are well thought out. The visual language is already ~70 % Stripe‑aligned. The gap to "world‑class" is:

1. A two‑day correctness sprint (P0).
2. A three‑week structural refactor (P1 backend + design system).
3. A disciplined approach to roles, i18n, dark mode, and real‑time (P1/P2 feature work).

The references already downloaded under `docs/agent-references/` (gitagent, antigravity‑skills, ui‑ux‑pro‑max, awesome‑design‑md) give us exactly the playbook we need to execute P1 without inventing conventions — we'll codify tokens, components, and agent rules as the DESIGN.md file already anticipates.

On "Stripe inspiration": we'll honor the user's intent (information density, clarity, trust, operations‑focused rhythm) without copying Stripe's proprietary code or brand marks. The end result will feel like a first‑class product in the same family, tuned to the GCC refund‑ops reality (Arabic, KNET, Aura, multi‑country managers, KNET AETH codes) — which Stripe doesn't even address.

**Recommendation: approve the P0 sprint and start today.** P1 can begin in parallel on design‑system groundwork while P0 lands.
