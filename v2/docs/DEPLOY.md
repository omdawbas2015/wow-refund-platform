# Deploying v2 to Vercel + Neon

> Sprint F #23 reference. The app is wired to deploy as soon as the
> owner provisions the upstream services and pastes the env vars into
> Vercel.

## 1. Provision Neon Postgres

1. Create a project at <https://console.neon.tech>. Pick the region
   closest to the Vercel deployment region (`fra1` per `vercel.json`).
2. Copy the **pooled** connection string. It must end with
   `?sslmode=require&pgbouncer=true&connect_timeout=15`.
3. Save it as `DATABASE_URL` in Vercel project settings (Production +
   Preview).
4. Save the **direct** connection string (no pgbouncer) as
   `DIRECT_DATABASE_URL`. Prisma uses this for migrations.
5. In `packages/db/prisma/schema.prisma`, the datasource is already:

   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_DATABASE_URL")
   }
   ```

   (Currently set to `sqlite` for local dev — flip to `postgresql` on
   the deploy branch only; do not commit that change to `main` until
   we cut over.)

## 2. Vercel project settings

- **Root directory:** `v2`
- **Build command:** see `vercel.json` (`pnpm install --frozen-lockfile`
  then `db migrate deploy` then `next build`).
- **Output:** `apps/web/.next`
- **Region:** `fra1` (override per `vercel.json`)
- **Node version:** 20.x or 22.x (`.nvmrc` if added)

## 3. Required env vars (Production + Preview)

| Var | Source | Required |
|---|---|---|
| `DATABASE_URL` | Neon pooled URL | ✅ |
| `DIRECT_DATABASE_URL` | Neon direct URL | ✅ for `db migrate deploy` |
| `AUTH_SECRET` | `openssl rand -base64 32` | ✅ |
| `AUTH_TRUST_HOST` | `true` | ✅ |
| `NEXTAUTH_URL` | `https://<your-prod-domain>` | ✅ |
| `EMAIL_PROVIDER_API_KEY` | M365 / Postmark / etc. | ✅ for emails |
| `SENTRY_DSN` | Sentry project DSN | optional |
| `SENTRY_AUTH_TOKEN` | Sentry CLI token (build-time source maps) | optional |
| `UPSTASH_REDIS_REST_URL` | Upstash | optional (rate limit / pubsub) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash | optional |
| `PII_ENCRYPTION_KEY` | `openssl rand -hex 32` | optional (Sprint F #20) |
| `POWER_AUTOMATE_SIGNING_SECRET` | shared with Flow HTTP trigger | ✅ if M365 flows are live |
| `NEXT_PUBLIC_APP_VERSION` | `git rev-parse --short HEAD` (set by build) | optional |

## 4. Cron triggers

`vercel.json` registers three scheduled jobs that hit existing route
handlers:

| Path | Schedule | What it does |
|---|---|---|
| `/api/cron/scheduled-reports` | every 15 min | Runs due rows in `ScheduledReport`, emails CSVs. |
| `/api/cron/sla-breach-scan` | every 30 min | Marks cases breaching SLA, queues notifications. |
| `/api/cron/fraud-scan` | every 6 hours | Reruns fraud signal heuristics across recent cases. |

These work without any extra config — Vercel calls the URLs as the
deployment's own user-agent. The handlers are idempotent.

## 5. Backup policy

Neon takes daily snapshots automatically (7-day retention on free
tier, configurable on paid). The in-app `/admin/backup` page tracks
**logical** backups (Excel exports of the case database) on top of
Neon's physical snapshots — the two are complementary.

For belt-and-suspenders: schedule a nightly logical backup via the
`/api/cron/backup` route (TODO once `BackupSettings.cronExpr` is wired
to the cron triggers in `vercel.json`).

## 6. First deploy checklist

1. Paste env vars (above).
2. Switch `schema.prisma` provider to `postgresql` on a deploy branch.
3. Push branch \u2192 Vercel preview build runs \u2192
   `pnpm db:migrate:deploy` applies the existing migration baseline +
   `20260427025439_initial_baseline` to Neon.
4. Hit `/api/health` on the preview URL — should return 200 with
   `db: ok`.
5. Promote to production from the Vercel dashboard.
6. Apply the `wow-refund` custom domain.
