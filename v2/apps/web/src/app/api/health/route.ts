import { NextResponse } from 'next/server';
import { prisma } from '@wow/db';

export const dynamic = 'force-dynamic';

const startedAt = new Date();
const APP_VERSION = process.env['NEXT_PUBLIC_APP_VERSION'] ?? 'unknown';

/**
 * Lightweight liveness + readiness probe. Returns:
 *   - `status`: "ok" if the DB query succeeds, "degraded" otherwise.
 *   - `db`:     "ok" / "down" with optional `latencyMs` and `error`.
 *   - `uptimeSeconds`, `version`, `now`.
 *
 * Always returns HTTP 200 — the JSON body carries the real signal so a
 * single curl can be parsed by a monitoring agent without HTTP-status
 * gymnastics. Suitable for uptime-kuma / pingdom / Datadog HTTP checks.
 *
 * Intentionally unauthenticated: no PII, no business data, no secrets.
 */
export async function GET() {
  const probedAt = Date.now();
  let dbStatus: 'ok' | 'down' = 'ok';
  let dbLatencyMs = 0;
  let dbError: string | undefined;
  try {
    const t0 = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatencyMs = Date.now() - t0;
  } catch (err) {
    dbStatus = 'down';
    dbError = err instanceof Error ? err.message : String(err);
  }

  const uptimeSeconds = Math.floor((probedAt - startedAt.getTime()) / 1000);
  return NextResponse.json({
    status: dbStatus === 'ok' ? 'ok' : 'degraded',
    db: dbStatus === 'ok' ? { status: 'ok', latencyMs: dbLatencyMs } : { status: 'down', error: dbError },
    uptimeSeconds,
    version: APP_VERSION,
    now: new Date().toISOString(),
  });
}
