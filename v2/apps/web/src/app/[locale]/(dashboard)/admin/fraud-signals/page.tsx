import { redirect } from 'next/navigation';
import { prisma, Prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { formatDateTime } from '@/lib/utils';
import { isFeatureEnabled } from '@/lib/feature-flags';
import { ScanButton, AcknowledgeButton } from './client-buttons';

interface PageProps {
  searchParams: Promise<{
    severity?: string;
    kind?: string;
    state?: string; // open | acknowledged | all
    page?: string;
  }>;
}

const PAGE_SIZE = 50;
const VALID_SEVERITY = new Set(['INFO', 'WARNING', 'HIGH']);

export default async function FraudSignalsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const featureEnabled = await isFeatureEnabled('feature.fraud_signals', false);

  const sp = await searchParams;
  const severity = (sp.severity ?? '').trim();
  const kind = (sp.kind ?? '').trim();
  const state = (sp.state ?? 'open').trim();
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: Prisma.FraudSignalWhereInput = {
    ...(severity && VALID_SEVERITY.has(severity) ? { severity } : {}),
    ...(kind ? { kind } : {}),
    ...(state === 'acknowledged'
      ? { acknowledgedAt: { not: null } }
      : state === 'open'
        ? { acknowledgedAt: null }
        : {}),
  };

  const [signals, total, distinctKinds] = await Promise.all([
    prisma.fraudSignal.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.fraudSignal.count({ where }),
    prisma.fraudSignal.findMany({
      distinct: ['kind'],
      select: { kind: true },
      orderBy: { kind: 'asc' },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Fraud signals</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Heuristic alerts emitted by the fraud-detection sweep. Acknowledge to clear from the open queue.
          </p>
        </div>
        <ScanButton enabled={featureEnabled} />
      </div>

      {!featureEnabled ? (
        <Card className="mb-6 mt-6 border-amber-500/40 bg-amber-50/40 dark:bg-amber-950/30">
          <CardHeader>
            <CardTitle className="text-base">Feature disabled</CardTitle>
            <CardDescription>
              Enable <code className="font-mono text-xs">feature.fraud_signals</code> in{' '}
              <Link href="/admin/settings" className="underline">
                Settings
              </Link>{' '}
              to run new sweeps. Existing signals remain visible and can still be acknowledged.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <form className="my-6 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          State
          <select
            name="state"
            defaultValue={state}
            className="h-9 w-36 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="all">All</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Severity
          <select
            name="severity"
            defaultValue={severity}
            className="h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Any</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warning</option>
            <option value="HIGH">High</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Kind
          <select
            name="kind"
            defaultValue={kind}
            className="h-9 w-64 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Any</option>
            {distinctKinds.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.kind}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} signals · page {page} of {pages}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>When</th>
                <th>Severity</th>
                <th>Kind</th>
                <th>Subject</th>
                <th>Description</th>
                <th>Status</th>
                <th className="!text-end">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {signals.map((s) => (
                <tr key={s.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2 tabular text-xs whitespace-nowrap">
                    {formatDateTime(s.createdAt, 'en-US')}
                  </td>
                  <td className="px-4 py-2">
                    <Badge
                      variant={
                        s.severity === 'HIGH'
                          ? 'destructive'
                          : s.severity === 'WARNING'
                            ? 'secondary'
                            : 'success'
                      }
                    >
                      {s.severity}
                    </Badge>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{s.kind}</td>
                  <td className="px-4 py-2 text-xs">
                    <span className="text-muted-foreground">{s.subjectType}</span>{' '}
                    <span className="font-mono">{s.subjectId}</span>
                  </td>
                  <td className="px-4 py-2 text-xs max-w-md">{s.description}</td>
                  <td className="px-4 py-2 text-xs">
                    {s.acknowledgedAt ? (
                      <span className="text-muted-foreground">
                        ack&apos;d {formatDateTime(s.acknowledgedAt, 'en-US')}
                      </span>
                    ) : (
                      <Badge variant="outline">Open</Badge>
                    )}
                  </td>
                  <td className="px-4 py-2 text-end">
                    {s.acknowledgedAt ? null : <AcknowledgeButton id={s.id} />}
                  </td>
                </tr>
              ))}
              {signals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No signals match.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/admin/fraud-signals?state=${state}&severity=${severity}&kind=${kind}&page=${page - 1}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              ← Prev
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/admin/fraud-signals?state=${state}&severity=${severity}&kind=${kind}&page=${page + 1}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
