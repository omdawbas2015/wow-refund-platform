# Running v2 with Docker

This document covers the **production container image** and the local
**docker-compose** stack. For Kubernetes see [`K8S.md`](./K8S.md).

---

## 1. The image (`v2/Dockerfile`)

A 4-stage build that produces a ~150MB image:

| Stage | What it does |
|---|---|
| `base` | `node:22-alpine` + `corepack pnpm@9.14.0`, `libc6-compat`, `openssl` |
| `deps` | `pnpm install --frozen-lockfile` for the workspace (cacheable) |
| `builder` | `pnpm --filter @wow/db generate:pg` (Postgres client) + `pnpm --filter @wow/web build` (Next.js standalone output) |
| `runner` | Copies `.next/standalone` + `.next/static` + `public` + Prisma engines to `node:22-alpine`. Runs as `nextjs:1001`, exposes 3000, healthchecks `/api/health` |

### Build locally

```bash
cd v2
docker build -f Dockerfile -t wow-refund-web:local .
```

### Run a single container against an external Postgres

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL='postgresql://wow:wow@host.docker.internal:5432/wow_refund?schema=public' \
  -e DIRECT_DATABASE_URL='postgresql://wow:wow@host.docker.internal:5432/wow_refund?schema=public' \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_TRUST_HOST=true \
  -e NEXTAUTH_URL=http://localhost:3000 \
  -e CRON_SECRET="$(openssl rand -hex 24)" \
  wow-refund-web:local
```

The container assumes the database has already been migrated. To run
the migration yourself, override the entrypoint:

```bash
docker run --rm -e DATABASE_URL='postgresql://...' wow-refund-web:local \
  sh -c './node_modules/.bin/prisma migrate deploy \
    --schema=packages/db/prisma/postgres/schema.prisma'
```

---

## 2. Full local stack (`v2/docker-compose.full.yml`)

Brings up Postgres + Redis + the production image in one command. Use
this as a smoke test of the production container before deploying to K8s.

### One-time bootstrap

```bash
cd v2
docker compose -f docker-compose.full.yml build
docker compose -f docker-compose.full.yml up -d

# First run: apply the schema
docker compose -f docker-compose.full.yml exec web sh -c "
  cd /app && ./node_modules/.bin/prisma migrate deploy \
  --schema=packages/db/prisma/postgres/schema.prisma"

# (optional) seed the demo cases
docker compose -f docker-compose.full.yml exec web sh -c "
  cd /app && ./node_modules/.bin/tsx packages/db/prisma/seed.ts"
```

Open <http://localhost:3000> — `admin@wow.local` / `admin123`.

### Ports

| Service | Port |
|---|---|
| web | `localhost:3000` |
| postgres | `localhost:5432` (user `wow`, password `wow`, db `wow_refund`) |
| redis | `localhost:6379` |

### Tear down (keep volumes)

```bash
docker compose -f docker-compose.full.yml down
```

### Tear down (drop volumes)

```bash
docker compose -f docker-compose.full.yml down -v
```

---

## 3. Local dev with sqlite (no Docker)

If you only want to hack on the app, the team's existing flow is still
the fastest:

```bash
cd v2
pnpm install
pnpm db:migrate          # uses prisma/schema.prisma (sqlite)
SEED_DEMO_CASES=1 pnpm db:seed
pnpm dev                 # http://localhost:3000
```

This uses the sqlite schema (`packages/db/prisma/schema.prisma`) and
its migration history under `packages/db/prisma/migrations/`. The
Postgres schema (`packages/db/prisma/postgres/schema.prisma`) is
**only** used by the Docker / K8s pipeline.

---

## 4. Keeping the two schemas in sync

The two Prisma schemas must stay structurally identical — only the
`datasource` block is allowed to differ. After every model change:

```bash
# Edit packages/db/prisma/schema.prisma
# Then mirror the same model changes into:
# packages/db/prisma/postgres/schema.prisma
# (everything from "SECTION 1" downward must match)

# Verify they're equivalent below the datasource block:
diff <(sed -n '/SECTION 1/,$p' packages/db/prisma/schema.prisma) \
     <(sed -n '/SECTION 1/,$p' packages/db/prisma/postgres/schema.prisma)
# (no output = OK)

# Generate a new sqlite migration for local dev:
pnpm db:migrate

# When deploying to K8s the migration Job runs:
#   prisma migrate deploy --schema=packages/db/prisma/postgres/schema.prisma
# against ./packages/db/prisma/postgres/migrations/. The first deploy
# will need a one-time `prisma migrate dev --name init --schema=...
# postgres/schema.prisma` against the production DB to seed that
# migration history.
```

---

## 5. Image registry

The GitHub Actions workflow at `.github/workflows/docker-build.yml`
builds and pushes the image to GHCR on every push:

```
ghcr.io/omdawbas2015/wow-refund-platform:latest    # active branch
ghcr.io/omdawbas2015/wow-refund-platform:<short-sha>
ghcr.io/omdawbas2015/wow-refund-platform:<branch>
ghcr.io/omdawbas2015/wow-refund-platform:v<tag>    # on tag push
```

GHCR is free for public repos. The workflow uses the built-in
`GITHUB_TOKEN` — no PAT or additional secret needed.
