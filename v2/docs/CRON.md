# Cron jobs

Scheduled background sweeps that run unattended in production. All cron
routes share the same auth pattern and are tagged with `source: cron` in
their audit log entries so you can distinguish manual vs scheduled runs.

## Auth

Every cron route checks a shared `CRON_SECRET` env var via
[`lib/cron/auth.ts`](../apps/web/src/lib/cron/auth.ts). The check uses
`crypto.timingSafeEqual` and accepts the secret in either header form:

```
x-cron-secret: <secret>
Authorization: Bearer <secret>
```

If `CRON_SECRET` is unset on the deployment, every cron route returns
`503 CRON_SECRET is not configured` — fail-closed by design so an
accidental misconfiguration can't expose an unauthenticated scanner.

Vercel Cron automatically sends `Authorization: Bearer $CRON_SECRET`
when `CRON_SECRET` is configured as a Project env var, so the same
secret value works for both paths.

## Schedule (Vercel)

[`apps/web/vercel.json`](../apps/web/vercel.json) wires two crons:

| Path                                | Schedule        | Description                                  |
| ----------------------------------- | --------------- | -------------------------------------------- |
| `/api/cron/sla-breach-scan`         | `*/15 * * * *`  | SLA breach + warning sweep                   |
| `/api/cron/fraud-scan`              | `0 * * * *`     | Fraud heuristic sweep                        |

The 15-minute SLA cadence is safe because every sweep dedupes notifications
within a 24h window per `(case, type)`. The fraud sweep uses the same
24h dedupe window per `(kind, subjectType, subjectId)`, so an hourly
cadence won't spam the dashboard either.

## Manual invocation

For debugging or one-off runs, call the routes directly:

```bash
curl -X POST https://<deployment>/api/cron/sla-breach-scan \
  -H "x-cron-secret: $CRON_SECRET"

curl -X POST https://<deployment>/api/cron/fraud-scan \
  -H "x-cron-secret: $CRON_SECRET"
```

Both routes also accept `GET` (so Vercel Cron's GET-based trigger works
out of the box).

## Other schedulers

The shared-secret model is scheduler-agnostic — works with GitHub
Actions cron, k8s CronJobs, Cloudflare Workers Cron, Render Cron Jobs,
or any HTTP scheduler. Use the `Authorization: Bearer …` form for
schedulers that don't let you set arbitrary headers.
