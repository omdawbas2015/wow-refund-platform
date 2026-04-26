import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runSlaBreachSweep } from '@/lib/cases/sla-sweep';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env['CRON_SECRET'] ?? '';

/**
 * Constant-time secret comparison to prevent timing attacks against the
 * cron auth header. `timingSafeEqual` requires equal-length buffers, so
 * length is short-circuited first — buffer length is not sensitive info
 * for a high-entropy random secret.
 */
function safeEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Scheduled SLA breach sweep. Intended to be invoked by Vercel Cron, an
 * external scheduler, or a CI job — so authentication is a shared secret
 * passed in either the `x-cron-secret` header or `Authorization: Bearer`.
 *
 * If `CRON_SECRET` is unset (e.g. in local dev), the route refuses every
 * request with 503 to avoid an accidental "open SLA scanner".
 *
 * The sweep itself is identical to the admin server action — it goes
 * through the same `runSlaBreachSweep` helper, so dedupe, recipient
 * selection, and audit logging match exactly.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  if (!CRON_SECRET) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured on this deployment' },
      { status: 503 },
    );
  }

  const headerSecret = req.headers.get('x-cron-secret') ?? '';
  const authHeader = req.headers.get('authorization') ?? '';
  const bearer = authHeader.toLowerCase().startsWith('bearer ')
    ? authHeader.slice(7).trim()
    : '';
  if (!safeEqual(headerSecret, CRON_SECRET) && !safeEqual(bearer, CRON_SECRET)) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Wrap the sweep in a try/catch so a thrown DB error or transient failure
  // returns a structured `{ ok: false, error }` payload — the cron scheduler
  // logs that, distinguishes it from auth/config errors (which use 401/503),
  // and we don't accidentally leak a stack trace via Next's default 500 page.
  try {
    const result = await runSlaBreachSweep(
      { id: null, email: 'cron@system', label: 'cron' },
      'cron',
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[cron/sla-breach-scan] sweep failed:', message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Vercel Cron triggers as GET; expose both verbs so it works with any
// scheduler.
export async function GET(req: NextRequest) {
  return handle(req);
}
