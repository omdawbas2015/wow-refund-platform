import { NextResponse, type NextRequest } from 'next/server';
import { runSlaBreachSweep } from '@/lib/cases/sla-sweep';
import { verifyCronAuth } from '@/lib/cron/auth';

export const dynamic = 'force-dynamic';

/**
 * Scheduled SLA breach + warning sweep. Intended to be invoked by Vercel
 * Cron, an external scheduler, or a CI job — authentication uses the
 * shared `CRON_SECRET` checked in constant time by `verifyCronAuth`.
 *
 * The sweep itself is identical to the admin server action — both go
 * through `runSlaBreachSweep`, so dedupe, recipient selection, and
 * audit logging match exactly.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const result = await runSlaBreachSweep(
    { id: null, email: 'cron@system', label: 'cron' },
    'cron',
  );
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

// Vercel Cron triggers as GET; expose both verbs so it works with any
// scheduler.
export async function GET(req: NextRequest) {
  return handle(req);
}
