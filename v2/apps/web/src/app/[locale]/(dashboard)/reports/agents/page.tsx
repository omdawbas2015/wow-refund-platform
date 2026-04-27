import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { parseRange } from '@/lib/reports/range';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

interface AgentRow {
  id: string;
  name: string;
  email: string;
  created: number;
  refunded: number;
  rejected: number;
  refundedAmount: number;
  avgResolutionHours: number | null;
  oldestOpenAgeHours: number | null;
}

export default async function AgentsReportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD') {
    redirect('/');
  }

  const sp = await searchParams;
  const range = parseRange({ from: sp.from, to: sp.to });
  const now = new Date();

  // Active staff with at least one role — i.e. people who could plausibly
  // create or be assigned cases.
  const staff = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { isNot: null } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, email: true },
  });

  const rows: AgentRow[] = await Promise.all(
    staff.map(async (u) => {
      const [createdInRange, refundedRows, rejectedCount, refundedAggr, oldestOpen] =
        await Promise.all([
          prisma.refundCase.count({
            where: {
              createdById: u.id,
              createdAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
          }),
          prisma.refundCase.findMany({
            where: {
              createdById: u.id,
              status: 'REFUNDED',
              updatedAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
            select: { createdAt: true, updatedAt: true },
          }),
          prisma.refundCase.count({
            where: {
              createdById: u.id,
              status: 'REJECTED',
              updatedAt: { gte: range.from, lte: range.to },
              deletedAt: null,
            },
          }),
          prisma.refundComponent.aggregate({
            where: {
              status: 'REFUNDED',
              refundedAt: { gte: range.from, lte: range.to },
              case: { createdById: u.id, deletedAt: null },
            },
            _sum: { amount: true },
          }),
          prisma.refundCase.findFirst({
            where: {
              OR: [{ assignedToId: u.id }, { createdById: u.id }],
              status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'] },
              deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
            select: { createdAt: true },
          }),
        ]);

      const refundedCount = refundedRows.length;
      const avgMs = refundedRows.length
        ? refundedRows.reduce(
            (sum, r) => sum + (r.updatedAt.getTime() - r.createdAt.getTime()),
            0,
          ) / refundedRows.length
        : null;
      const avgHours = avgMs !== null ? avgMs / (1000 * 60 * 60) : null;

      const oldestOpenAgeHours = oldestOpen
        ? (now.getTime() - oldestOpen.createdAt.getTime()) / (1000 * 60 * 60)
        : null;

      return {
        id: u.id,
        name: u.name,
        email: u.email,
        created: createdInRange,
        refunded: refundedCount,
        rejected: rejectedCount,
        refundedAmount: refundedAggr._sum.amount ?? 0,
        avgResolutionHours: avgHours,
        oldestOpenAgeHours,
      };
    }),
  );

  // Hide rows where every metric is zero — keeps the table focused on
  // people who actually touched a case in the range.
  const visible = rows
    .filter((r) => r.created > 0 || r.refunded > 0 || r.rejected > 0)
    .sort((a, b) => b.refunded - a.refunded || b.created - a.created);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link
        href={`/reports?from=${range.fromIso}&to=${range.toIso}`}
        className="text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Reports
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">By agent</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Activity per staff member in the selected range. Average resolution time is computed
        across cases this agent created that reached REFUNDED in-range.
      </p>

      <div className="my-6 flex flex-wrap items-end justify-between gap-3">
      <form className="flex items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            defaultValue={range.fromIso}
            className="h-9 w-44 rounded-md border border-border bg-background px-2 text-sm tabular"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            defaultValue={range.toIso}
            className="h-9 w-44 rounded-md border border-border bg-background px-2 text-sm tabular"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Apply
        </button>
      </form>
        <a
          href={`/api/export/agents?from=${range.fromIso}&to=${range.toIso}`}
          className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm hover:bg-surface-subtle"
        >
          Export Excel
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{visible.length} active agent{visible.length === 1 ? '' : 's'}</CardTitle>
          <CardDescription>
            Sorted by refunded cases (desc), then by cases created.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>Agent</th>
                <th className="!text-end">Created</th>
                <th className="!text-end">Refunded</th>
                <th className="!text-end">Rejected</th>
                <th className="!text-end">Amount refunded</th>
                <th className="!text-end">Avg resolution</th>
                <th className="!text-end">Oldest open</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2">
                    <div className="font-medium text-heading">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-2 text-end tabular">{r.created || '—'}</td>
                  <td className="px-4 py-2 text-end tabular text-emerald-600">
                    {r.refunded || '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular text-muted-foreground">
                    {r.rejected || '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular">
                    {r.refundedAmount ? r.refundedAmount.toFixed(3) : '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular text-muted-foreground">
                    {r.avgResolutionHours !== null
                      ? `${Math.round(r.avgResolutionHours)}h`
                      : '—'}
                  </td>
                  <td className="px-4 py-2 text-end tabular text-muted-foreground">
                    {r.oldestOpenAgeHours !== null
                      ? `${Math.round(r.oldestOpenAgeHours)}h`
                      : '—'}
                  </td>
                </tr>
              ))}
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-sm text-muted-foreground"
                  >
                    No agent activity in this range.
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
