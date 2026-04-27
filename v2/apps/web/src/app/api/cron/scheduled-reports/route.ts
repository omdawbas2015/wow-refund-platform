import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@wow/db';
import { isDueSince, parseCron } from '@/lib/scheduled-reports/cron';
import { runScheduledReport } from '@/lib/scheduled-reports/run';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env['CRON_SECRET'] ?? '';

function safeEqual(provided: string, expected: string): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Sweep-all-due-reports endpoint. Walks every active ScheduledReport, parses
 * its cron expression, and runs the ones that have at least one matching
 * minute in (lastRunAt, now]. Each run is independent so a single failure
 * does not abort the rest of the sweep.
 *
 * Auth is the shared CRON_SECRET (header `x-cron-secret` or `Authorization:
 * Bearer …`) — same convention as other cron endpoints in this repo.
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

  const now = new Date();
  const reports = await prisma.scheduledReport.findMany({ where: { isActive: true } });

  const ranSummaries: Array<{
    id: string;
    name: string;
    delivered: number;
    failed: number;
    error?: string;
  }> = [];

  for (const r of reports) {
    let due = false;
    try {
      const spec = parseCron(r.cronExpr);
      due = isDueSince(spec, r.lastRunAt, now);
    } catch (err) {
      ranSummaries.push({
        id: r.id,
        name: r.name,
        delivered: 0,
        failed: 0,
        error: `Invalid cron: ${err instanceof Error ? err.message : String(err)}`,
      });
      continue;
    }
    if (!due) continue;

    const result = await runScheduledReport({
      id: r.id,
      name: r.name,
      scope: r.scope,
      filters: r.filters,
      recipients: r.recipients,
      format: r.format,
    });
    ranSummaries.push({
      id: r.id,
      name: r.name,
      delivered: result.recipientsDelivered,
      failed: result.recipientsFailed,
      ...(result.error ? { error: result.error } : {}),
    });
  }

  return NextResponse.json({
    ok: true,
    checked: reports.length,
    ran: ranSummaries.length,
    runs: ranSummaries,
  });
}

export async function POST(req: NextRequest) {
  return handle(req);
}

export async function GET(req: NextRequest) {
  return handle(req);
}
