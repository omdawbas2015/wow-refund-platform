import { redirect } from 'next/navigation';
import { prisma, type CaseStatus } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { formatDateTime } from '@/lib/utils';
import {
  pickSlaRule,
  classifyByHours,
  hoursBetween,
  type SlaTierHours,
} from '@/lib/cases/sla-rules';
import { ScanSlaBreachesButton } from './scan-button';

const TERMINAL: ReadonlySet<CaseStatus> = new Set<CaseStatus>([
  'REFUNDED',
  'REJECTED',
  'CANCELLED',
]);

const TIER_COLORS: Record<SlaTierHours, 'success' | 'secondary' | 'destructive'> = {
  on_track: 'success',
  warning: 'secondary',
  breached: 'destructive',
};

export default async function SlaReportPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const now = new Date();

  // Load every active SLA rule once and reuse across cases.
  const [rules, openCases] = await Promise.all([
    prisma.slaRule.findMany({ where: { isActive: true } }),
    prisma.refundCase.findMany({
      where: {
        deletedAt: null,
        status: { notIn: Array.from(TERMINAL) as CaseStatus[] },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        caseNumber: true,
        status: true,
        createdAt: true,
        countryId: true,
        brandId: true,
        rootCauseId: true,
        country: { select: { registryCode: true } },
        brand: { select: { name: true } },
        assignedTo: { select: { name: true, email: true } },
      },
    }),
  ]);

  // Classify every open case.
  type Row = (typeof openCases)[number] & {
    elapsedHours: number;
    thresholdHours: number;
    tier: SlaTierHours;
    ruleName: string | null;
    overrunHours: number;
  };

  const classified: Row[] = openCases.map((c) => {
    const resolved = pickSlaRule(rules, {
      countryId: c.countryId,
      brandId: c.brandId,
      rootCauseId: c.rootCauseId,
    });
    const elapsedHours = hoursBetween(c.createdAt, now);
    const tier = classifyByHours(elapsedHours, resolved);
    return {
      ...c,
      elapsedHours,
      thresholdHours: resolved.thresholdHours,
      tier,
      ruleName: resolved.rule?.name ?? null,
      overrunHours: Math.max(0, elapsedHours - resolved.thresholdHours),
    };
  });

  const counts: Record<SlaTierHours, number> = {
    on_track: 0,
    warning: 0,
    breached: 0,
  };
  for (const r of classified) counts[r.tier] += 1;

  const breached = classified
    .filter((r) => r.tier === 'breached')
    .sort((a, b) => b.overrunHours - a.overrunHours);

  // Group breached counts per country for the summary card.
  const byCountry = new Map<string, { country: string; breached: number; warning: number; on_track: number }>();
  for (const r of classified) {
    const key = r.country.registryCode;
    const entry = byCountry.get(key) ?? {
      country: key,
      breached: 0,
      warning: 0,
      on_track: 0,
    };
    entry[r.tier] += 1;
    byCountry.set(key, entry);
  }
  const countryRows = Array.from(byCountry.values()).sort(
    (a, b) => b.breached - a.breached || b.warning - a.warning,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/reports" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Reports
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">SLA</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Open refund cases classified against the active SLA rules. Cases that match no rule
            fall back to a 6-day breach threshold (warning at 3 days).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href="/api/export/sla?tier=breached"
            className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-surface-subtle"
          >
            Export Excel
          </a>
          {session.user.role === 'ADMIN' || session.user.role === 'OPS_LEAD' ? (
            <ScanSlaBreachesButton />
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard label="Breached" value={counts.breached} tone="destructive" />
        <SummaryCard label="At risk" value={counts.warning} tone="warning" />
        <SummaryCard label="On track" value={counts.on_track} tone="success" />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>By country</CardTitle>
          <CardDescription>Distribution of open cases per SLA tier.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>Country</th>
                <th className="!text-end">Breached</th>
                <th className="!text-end">At risk</th>
                <th className="!text-end">On track</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {countryRows.map((r) => (
                <tr key={r.country}>
                  <td className="px-4 py-2 font-medium tabular uppercase">{r.country}</td>
                  <td className="px-4 py-2 text-end tabular text-destructive">
                    {r.breached || '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular text-amber-600">
                    {r.warning || '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular text-emerald-600">
                    {r.on_track || '—'}
                  </td>
                </tr>
              ))}
              {countryRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No open cases.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Breached cases ({breached.length})</CardTitle>
          <CardDescription>
            Sorted by hours over the threshold (longest overrun first).
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>Case</th>
                <th>Country</th>
                <th>Brand</th>
                <th>Status</th>
                <th>Created</th>
                <th>Elapsed</th>
                <th>Threshold</th>
                <th>Overrun</th>
                <th>Rule</th>
                <th>Assignee</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {breached.map((r) => (
                <tr key={r.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2 font-mono text-xs">
                    <Link href={`/cases/${r.id}`} className="hover:text-primary">
                      {r.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs uppercase tabular">{r.country.registryCode}</td>
                  <td className="px-4 py-2 text-xs">{r.brand.name}</td>
                  <td className="px-4 py-2">
                    <Badge variant={TIER_COLORS[r.tier]}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs tabular whitespace-nowrap">
                    {formatDateTime(r.createdAt, 'en-US')}
                  </td>
                  <td className="px-4 py-2 text-xs tabular">
                    {Math.round(r.elapsedHours)}h
                  </td>
                  <td className="px-4 py-2 text-xs tabular text-muted-foreground">
                    {r.thresholdHours}h
                  </td>
                  <td className="px-4 py-2 text-xs tabular font-medium text-destructive">
                    +{Math.round(r.overrunHours)}h
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {r.ruleName ?? <span className="italic">default</span>}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {r.assignedTo?.name ?? r.assignedTo?.email ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {breached.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No breached cases.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'destructive' | 'warning' | 'success';
}) {
  const color =
    tone === 'destructive'
      ? 'text-destructive'
      : tone === 'warning'
        ? 'text-amber-600'
        : 'text-emerald-600';
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-display-md font-semibold tabular ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
