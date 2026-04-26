import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { Activity, AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

/**
 * Operational visibility into the cron sweeps. Each sweep audit-logs a row
 * via `prisma.auditLog.create({ action: '<sweep>.run', ... })`; this page
 * reads the most recent rows back so admins can answer:
 *
 *   - "Did the SLA sweep run in the last 30 minutes?"
 *   - "Did the fraud sweep run in the last 90 minutes?"
 *   - "What did the last few runs do?"
 *
 * Health is derived from the gap between `now` and the last `*.run` row:
 *  - HEALTHY if the gap is < 2× expected interval
 *  - LATE    if 2×–6× expected interval
 *  - DOWN    if no row in 6× expected interval (or ever)
 *
 * The expected intervals match `vercel.json`:
 *  - SLA breach scan:   every 15m
 *  - Fraud scan:        every 60m
 */
const SLA_INTERVAL_MIN = 15;
const FRAUD_INTERVAL_MIN = 60;

interface SweepDef {
  key: string;
  label: string;
  description: string;
  // Audit actions this sweep is known to write. The first match wins for
  // "last run"; all match for "recent rows".
  actions: string[];
  intervalMinutes: number;
  endpoint: string;
}

const SWEEPS: SweepDef[] = [
  {
    key: 'sla',
    label: 'SLA breach sweep',
    description: 'Detects cases that have crossed their SLA threshold and emits SLA_BREACHED notifications + a SLA_WARNING tier earlier in the window.',
    actions: ['sla.breach_scan.run'],
    intervalMinutes: SLA_INTERVAL_MIN,
    endpoint: '/api/cron/sla-breach-scan',
  },
  {
    key: 'fraud',
    label: 'Fraud heuristic sweep',
    description: 'Runs CUSTOMER_MULTIPLE_REFUNDS and AGENT_HIGH_VOLUME heuristics; new findings appear under /admin/fraud-signals.',
    actions: ['cron.fraud_scan.run', 'admin.fraud_scan.run'],
    intervalMinutes: FRAUD_INTERVAL_MIN,
    endpoint: '/api/cron/fraud-scan',
  },
];

type SweepHealth = 'HEALTHY' | 'LATE' | 'DOWN' | 'UNKNOWN';

function classify(lastRun: Date | null, intervalMinutes: number, now: Date): SweepHealth {
  if (!lastRun) return 'DOWN';
  const ageMin = (now.getTime() - lastRun.getTime()) / 60_000;
  if (ageMin < intervalMinutes * 2) return 'HEALTHY';
  if (ageMin < intervalMinutes * 6) return 'LATE';
  return 'DOWN';
}

function fmtAge(d: Date | null, now: Date): string {
  if (!d) return 'never';
  const ageMin = Math.max(0, Math.floor((now.getTime() - d.getTime()) / 60_000));
  if (ageMin < 1) return 'just now';
  if (ageMin < 60) return `${ageMin}m ago`;
  const ageHr = Math.floor(ageMin / 60);
  if (ageHr < 24) return `${ageHr}h ago`;
  return `${Math.floor(ageHr / 24)}d ago`;
}

function healthBadge(h: SweepHealth) {
  switch (h) {
    case 'HEALTHY':
      return <Badge variant="default" className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Healthy</Badge>;
    case 'LATE':
      return <Badge variant="secondary" className="bg-amber-100 text-amber-900 hover:bg-amber-100">Late</Badge>;
    case 'DOWN':
      return <Badge variant="destructive">Down</Badge>;
    default:
      return <Badge variant="outline">Unknown</Badge>;
  }
}

export default async function CronStatusPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const now = new Date();
  const since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const allActions = SWEEPS.flatMap((s) => s.actions);
  const recent = await prisma.auditLog.findMany({
    where: { action: { in: allActions }, createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: {
      id: true,
      action: true,
      actorEmail: true,
      afterData: true,
      createdAt: true,
    },
  });

  const lastByAction = new Map<string, (typeof recent)[number]>();
  for (const row of recent) {
    if (!lastByAction.has(row.action)) lastByAction.set(row.action, row);
  }

  const summarized = SWEEPS.map((sw) => {
    const last = sw.actions.map((a) => lastByAction.get(a)).find(Boolean) ?? null;
    const lastRun = last?.createdAt ?? null;
    const health = classify(lastRun, sw.intervalMinutes, now);
    return { sw, last, lastRun, health };
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">Cron status</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Last run + health for the platform's scheduled sweeps. Derived from the audit log; matches what Vercel Cron sends to <code>/api/cron/*</code>.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {summarized.map(({ sw, lastRun, health }) => (
          <Card key={sw.key}>
            <CardHeader className="flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  {sw.label}
                </CardTitle>
                <CardDescription>{sw.description}</CardDescription>
              </div>
              {healthBadge(health)}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">Last run:</span>
                <span className="font-medium">{fmtAge(lastRun, now)}</span>
                {lastRun ? (
                  <span className="text-xs text-muted-foreground">({lastRun.toLocaleString()})</span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">Schedule:</span>
                <span className="font-medium">every {sw.intervalMinutes}m</span>
                <span className="text-xs text-muted-foreground">({sw.endpoint})</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            Recent sweep runs
          </CardTitle>
          <CardDescription>
            Most recent {recent.length} audit-log rows for cron sweeps in the last 7 days. After-data is whatever the sweep returned (counts, skip reasons, etc.).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              No cron audit rows in the last 7 days. If Vercel Cron is configured, it should populate this within minutes.
            </div>
          ) : (
            <div className="overflow-hidden rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-start">When</th>
                    <th className="px-3 py-2 text-start">Action</th>
                    <th className="px-3 py-2 text-start">Actor</th>
                    <th className="px-3 py-2 text-start">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((row) => (
                    <tr key={row.id} className="border-t border-border/60">
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                        {row.createdAt.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 align-top font-mono text-xs">
                        {row.action}
                      </td>
                      <td className="px-3 py-2 align-top text-xs">
                        {row.actorEmail ?? '—'}
                      </td>
                      <td className="px-3 py-2 align-top text-xs text-muted-foreground">
                        <code className="text-[11px]">{row.afterData ?? '—'}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
