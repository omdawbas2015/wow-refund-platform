# CI setup (manual one-time)

> Devin's GitHub OAuth scope cannot push files under `.github/workflows/`,
> so this file documents the workflow Devin would create and tells the
> owner where to drop it manually.

## What to do

1. Copy [`docs/proposed-ci.yml`](./proposed-ci.yml) to
   `.github/workflows/ci.yml`.
2. Commit it on a branch and merge to main (or push directly to main).
3. GitHub Actions auto-detects the workflow on the next push.

## What it does

Three jobs run on every push to `main` / `devin/**` branches and on PRs
into `main`:

| Job | What it runs |
|---|---|
| `typecheck` | `pnpm install` → `pnpm db:generate` → `pnpm typecheck` (4 packages must pass). |
| `unit` | `pnpm test` (vitest in `@wow/web`). |
| `e2e` | `pnpm test:e2e` (Playwright chromium against the production build started on port 3000). Uploads HTML reports as artifacts on failure. |

Concurrency group cancels older runs on the same ref so a fresh push
doesn't queue duplicates.

## No secrets required

The typecheck / unit / e2e path runs entirely against SQLite via
`pnpm db:push`. Production deploy verification happens via Vercel
preview deploys (see `v2/vercel.json` + `v2/docs/DEPLOY.md`) on the
same PR.
