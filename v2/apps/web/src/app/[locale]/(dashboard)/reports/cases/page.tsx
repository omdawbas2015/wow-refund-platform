import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { parseRange } from '@/lib/reports/range';
import {
  caseStatusLabel,
  caseStatusVariant,
} from '@/lib/cases/case-status-display';
import { Badge } from '@/components/ui/badge';
import type { CaseStatus } from '@wow/db';
import { StatusDonut } from '../charts';

const STATUS_COLORS: Record<CaseStatus, string> = {
  DRAFT: '#94a3b8',
  PENDING_APPROVAL: '#f59e0b',
  APPROVED: '#3b82f6',
  IN_EXECUTION: '#6366f1',
  PARTIALLY_REFUNDED: '#8b5cf6',
  REFUNDED: '#10b981',
  REJECTED: '#ef4444',
  CANCELLED: '#64748b',
};

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function CaseStatusReportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD') redirect('/');

  const sp = await searchParams;
  const range = parseRange({ from: sp.from, to: sp.to });

  // Group by status using Prisma's groupBy.
  const grouped = await prisma.refundCase.groupBy({
    by: ['status'],
    where: {
      createdAt: { gte: range.from, lte: range.to },
      deletedAt: null,
    },
    _count: { _all: true },
  });

  const total = grouped.reduce((s, g) => s + g._count._all, 0);
  const sortedStatuses: CaseStatus[] = [
    'DRAFT',
    'PENDING_APPROVAL',
    'APPROVED',
    'IN_EXECUTION',
    'PARTIALLY_REFUNDED',
    'REFUNDED',
    'REJECTED',
    'CANCELLED',
  ];
  const map = new Map(grouped.map((g) => [g.status, g._count._all]));

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href={`/reports?from=${range.fromIso}&to=${range.toIso}`}
        className="text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Reports
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">
        Cases by status
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Cases created between {range.fromIso} and {range.toIso}.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <StatusDonut
            data={sortedStatuses
              .map((status) => ({
                name: caseStatusLabel(status),
                value: map.get(status) ?? 0,
                color: STATUS_COLORS[status],
              }))
              .filter((d) => d.value > 0)}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Total: {total}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {sortedStatuses.map((status) => {
              const count = map.get(status) ?? 0;
              const pct = total > 0 ? (count / total) * 100 : 0;
              return (
                <li key={status} className="flex items-center gap-3 px-6 py-3">
                  <div className="w-44">
                    <Badge variant={caseStatusVariant(status)}>{caseStatusLabel(status)}</Badge>
                  </div>
                  <div className="flex-1">
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-subtle">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${pct.toFixed(1)}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-24 text-end text-sm tabular">
                    {count} ({pct.toFixed(1)}%)
                  </div>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
