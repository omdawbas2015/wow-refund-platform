# Resume Prompt — WOW Refund Platform v2

> Paste the prompt block below into any new Devin session (same account or
> different account) and the next agent will continue exactly from the
> latest GitHub state.

The single source of truth is `/HANDOVER.md` at the repo root. This file
exists purely so a human can hand a known-good prompt to a new session
without having to remember the operating contract by heart.

---

## Prompt to paste

```
Continue work on omdawbas2015/wow-refund-platform.

STEP 1 — Resume from the latest GitHub state:

  git fetch origin
  git checkout devin/1777249813-continue-roadmap
  git pull origin devin/1777249813-continue-roadmap
  git log -3 --oneline

STEP 2 — Read /HANDOVER.md at the repo root. It is the single source of truth.
The 34-item Sprint A → G roadmap, the operating contract, the resume protocol,
and the ticked status of every item live there. Sprints A, B, C, D, E are
fully closed. Sprint F #25 + Sprint G #28 (partial), #29, #30, #31 are closed.
Sprint H (live audit + improvements) added on 2026-04-27 and is ongoing.

STEP 3 — Boot the dev environment:

  cd v2
  pnpm install
  pnpm db:migrate           # real Prisma migrations now (not db:push)
  SEED_DEMO_CASES=1 pnpm db:seed
  pnpm dev

STEP 4 — Open HANDOVER.md §6 and check Sprint F. As of 2026-04-27 every
Sprint F item is either ✅ (#25 Playwright) or 🟡 (scaffold landed,
behaviour gated on a missing secret). Sprint G has #29 / #30 / #31 done
and #28 partial. The only fully-open item is Sprint G #26 (Power
Automate flows on M365), which the OWNER builds externally — the
Next.js side already exposes /api/webhooks/power-automate.

If owner-provided secrets are now available, your job is to flip the
scaffolds:

  PII_ENCRYPTION_KEY     → start opting fields into encrypt() in
                           lib/crypto/pii.ts via Prisma client.\$extends.
  UPSTASH_REDIS_REST_URL → activate the Upstash bridge in
                           lib/events/bus.ts (publish to Redis, subscribe
                           on every replica) so SSE fanout is multi-rep.
  SENTRY_DSN             → wrap next.config.mjs with withSentryConfig()
                           so source maps + route instrumentation upload.
  DATABASE_URL + Vercel  → flip schema.prisma provider to postgresql on
                           a deploy branch and follow docs/DEPLOY.md.

If no secrets are available, the substantive backlog is:
  - Sprint H continues. The bell icon now talks SSE (commit 8550816)
    and dispatchNotifications() publishes on the bus (commit 7afb059),
    so the SSE channel is no longer dead-code; spot-check it.
  - Add more vitest coverage. apps/web/vitest.config.ts is wired and
    src/lib/{crypto,rate-limit,events,logger}.test.ts already pass
    22/22; pure modules without DB / network are good targets next.
  - Browser-walk for visible regressions. The Playwright audit script
    pattern (apps/web/audit.local.mjs in commit history) is reusable
    \u2014 it connects to chromium via @playwright/test and walks ~34
    routes capturing console errors + request failures.
  - UI polish: loading states, empty states, accessibility labels.
  - The /admin/design-tokens preview is a good place to verify any
    palette / typography tweaks before they land in production.

HARD RULES (do NOT violate):
- The system is at phase 7+. Do NOT assume Phase 1 or Phase 2 state from
  any other doc. The latest state lives on GitHub only.
- /cases and /promo UI files are off-limits. Do not modify any .tsx file
  under v2/apps/web/src/app/[locale]/(dashboard)/cases/ or .../promo/.
  Add features around them, never to them.
- Never ask the owner questions during execution. Work autonomously
  until credit runs out.
- Every change = a separate git commit, pushed to GitHub immediately.
  Not at end of feature, not at end of sprint — push the moment a logical
  unit is done.
- At the end of each sprint, update HANDOVER.md (tick the ⬜ to ✅ with
  the commit SHA) and push it as its own `docs(handover): update after
  Sprint X` commit.
- Do NOT merge to main. Do NOT open PRs unless explicitly asked.
- pnpm typecheck must pass (4/4 packages) before every commit.
- Never commit dev.db, .env*, node_modules, or .next.

ADMIN LOGIN for local testing: admin@wow.local / admin123

If the owner has provided secrets for Sprint F (Upstash, Sentry, Vercel,
Neon DATABASE_URL, PII_ENCRYPTION_KEY), wire them in. Otherwise, finish
Sprint G first and at session end send a single non-blocking message
listing what's still missing. Do NOT block waiting for secrets.

Begin from the next ⬜ item now.
```

---

## What's already done (as of 2026-04-27)

- **Sprint A** — bulk operations, resend failed emails, KPI sparklines, scheduled reports + cron sweep.
- **Sprint B** — onboarding tour, changelog banner, ⌘K command palette.
- **Sprint C** — currencies / branches / batch-schedules / automation-rules / backup admin pages, module on/off toggles.
- **Sprint D** — AR + EN translation namespaces, dark-mode audit, three-layer design tokens + Cairo / IBM Plex Sans Arabic, exchange-rate cache, Prisma composite indexes.
- **Sprint E** — RBAC helpers + AUDITOR audit-log access, real Prisma migrations, sliding-window auth rate limiter, dev.db scrub + .gitignore tightening, README refresh, HANDOFF banner.
- **Sprint F** — Playwright smoke (auth + cases) ✅. PII helpers, SSE notifications + event bus, Sentry SDK config, Vercel + Neon deploy plan, .env.example, docker-compose for local Postgres — all landed as 🟡 scaffolds; behaviour activates the moment owner provisions secrets.
- **Sprint G** — JSON logger shim, axe-core a11y, OpenAPI from zod, /admin/design-tokens preview. #26 (M365 flows) is owner-side; #28 (real pino + OTel) deferred until a log drain destination is approved.
- **Sprint H — live audit + improvements 2026-04-27** — Playwright walk over 34 routes (all 200 OK), `@prisma/client` added to apps/web direct deps to silence Turbopack warning, dashboard "Phase 1 scaffolding" card replaced with live "System status" + real recent cases, vitest config + 22 unit tests for crypto / rate-limit / events / logger, bell upgraded to SSE-first with polling fallback, SSE route `cancel()` wired to real cleanup (no more leaked heartbeats), `dispatchNotifications()` publishes to the bus so SSE actually fires.

CI workflow proposed in `docs/proposed-ci.yml` — owner copies it to
`.github/workflows/ci.yml` (Devin's OAuth scope can't push workflow
files). See `docs/CI_SETUP.md`.

See `/HANDOVER.md` for commit SHAs and full descriptions.
