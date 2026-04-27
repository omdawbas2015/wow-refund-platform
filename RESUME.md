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
fully closed. Sprint F #25 + Sprint G #28 (partial) and #30 are also closed.

STEP 3 — Boot the dev environment:

  cd v2
  pnpm install
  pnpm db:migrate           # real Prisma migrations now (not db:push)
  SEED_DEMO_CASES=1 pnpm db:seed
  pnpm dev

STEP 4 — Find the next ⬜ unchecked item in HANDOVER.md §6 and start there.
Currently the open items are Sprint F #20 / #21 / #22 / #23 (need
owner-provided secrets) and Sprint G #26 / #29 / #31. If no secrets are
available in this session, work on Sprint G #29 (OpenAPI / Swagger from
zod) and #31 (Storybook scaffold) — both are P2 backlog items that don't
need secrets.

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
- **Sprint F** — Playwright smoke suite (auth + cases). Items #20 / #21 / #22 / #23 still blocked on owner-provided secrets.
- **Sprint G** — JSON logger shim (foundation for pino + OTel), axe-core a11y smoke. #29 / #31 still open.

See `/HANDOVER.md` for commit SHAs and full descriptions.
