import { NextResponse, type NextRequest } from 'next/server';
import { runFraudScan } from '@/lib/fraud/fraud-scan';
import { verifyCronAuth } from '@/lib/cron/auth';

export const dynamic = 'force-dynamic';

/**
 * Scheduled fraud heuristic sweep. Mirrors the admin button on
 * /admin/fraud-signals — same rules, same dedupe, same audit shape — but
 * runs unattended via Vercel Cron / GitHub Actions / external scheduler.
 *
 * Auth: shared `CRON_SECRET` checked in constant time. If the
 * `feature.fraud_signals` flag is disabled, the response is `200` with
 * `skipped: 'feature_disabled'` so a scheduler doesn't spam alerts when
 * the feature is intentionally off.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const denied = verifyCronAuth(req);
  if (denied) return denied;
  const result = await runFraudScan(
    { id: null, email: 'cron@system', label: 'cron' },
    'cron',
  );
  return NextResponse.json({ ok: true, ...result });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
