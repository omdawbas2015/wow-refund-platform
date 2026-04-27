# syntax=docker/dockerfile:1.7
# ─────────────────────────────────────────────────────────────────────────────
#  WOW Refund v2 — production image
#
#  Build context: /v2 (the monorepo root). Build with:
#    docker build -f Dockerfile -t wow-refund-web .
#
#  Stages:
#    1. base    — node:22-alpine + pnpm 9 (cached layer for every other stage)
#    2. deps    — install all workspace deps with --frozen-lockfile
#    3. builder — prisma generate + next build with output: 'standalone'
#    4. runner  — tiny final image (~150MB), non-root, healthcheck wired
#
#  The runtime expects:
#    - DATABASE_URL              postgres connection string (pooled)
#    - DIRECT_DATABASE_URL       postgres connection string (direct, for migrate)
#    - AUTH_SECRET, AUTH_TRUST_HOST, NEXTAUTH_URL
#    - …and the rest documented in v2/docs/DEPLOY.md
# ─────────────────────────────────────────────────────────────────────────────

# ── 1. base ──────────────────────────────────────────────────────────────────
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl \
 && corepack enable \
 && corepack prepare pnpm@9.14.0 --activate
WORKDIR /app

# ── 2. deps ──────────────────────────────────────────────────────────────────
FROM base AS deps
# Copy only the manifests so this layer can be cached as long as deps don't move.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/validators/package.json packages/validators/package.json
RUN pnpm install --frozen-lockfile

# ── 3. builder ───────────────────────────────────────────────────────────────
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/ui/node_modules ./packages/ui/node_modules
COPY --from=deps /app/packages/validators/node_modules ./packages/validators/node_modules
COPY . .
# Use the Postgres schema variant (provider="postgresql") for the
# generated client. Local dev uses the sqlite default in schema.prisma;
# production must match the Postgres datasource.
RUN pnpm --filter @wow/db generate:pg
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @wow/web build

# ── 4. runner ────────────────────────────────────────────────────────────────
FROM node:22-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl \
 && addgroup -S -g 1001 nodejs \
 && adduser -S -u 1001 -G nodejs nextjs
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# 1) Standalone server (self-contained .next/standalone with minimal deps).
#    Next.js's standalone tracer follows imports from server components +
#    route handlers and bundles every required package — including the
#    pnpm-store @prisma/client + the generated client under .prisma — into
#    .next/standalone/node_modules. Trusting that here keeps the image
#    minimal; if any module is missing at runtime add an explicit COPY.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
# 2) Static assets are not bundled into standalone — copy them by hand.
#    (apps/web has no public/ folder; everything ships from .next/static.)
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
# 3) Prisma schema + migrations + a thin pnpm install of @prisma/client +
#    prisma CLI so the K8s migrate Job (which runs ./node_modules/.bin/prisma
#    migrate deploy) has everything it needs without re-installing the
#    workspace.
COPY --from=builder --chown=nextjs:nodejs /app/packages/db ./packages/db

USER nextjs
EXPOSE 3000

# Liveness/readiness use this same endpoint in K8s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "apps/web/server.js"]
