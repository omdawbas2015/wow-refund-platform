import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';

const CRON_SECRET = process.env['CRON_SECRET'] ?? '';

/**
 * Constant-time secret comparison. `timingSafeEqual` requires equal-length
 * buffers; the length pre-check is fine because length is not sensitive
 * info for a high-entropy random secret.
 */
function safeEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Verify the shared secret on a cron / scheduler request. Accepts either
 * `x-cron-secret: <secret>` or `Authorization: Bearer <secret>`.
 *
 * Returns `null` when the request is authorized; otherwise returns the
 * `NextResponse` the route should send (503 if `CRON_SECRET` is unset,
 * 401 if the secret doesn't match). Returning the response from a single
 * helper keeps every cron route consistent.
 */
export function verifyCronAuth(req: NextRequest): NextResponse | null {
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
  return null;
}
