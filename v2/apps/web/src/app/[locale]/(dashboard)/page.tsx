import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { KpiSparkline, type SparkPoint } from './kpi-sparkline';

const RECENT_LIMIT = 6;

const statusTone: Record<string, 'success' | 'warning' | 'destructive' | 'default' | 'secondary'> = {
  REFUNDED: 'success',
  COMPLETED: 'success',
  APPROVED: 'success',
  PENDING_APPROVAL: 'warning',
  IN_REVIEW: 'warning',
  AWAITING_PAYMENT: 'warning',
  REJECTED: 'destructive',
  CANCELLED: 'destructive',
  DRAFT: 'secondary',
};

const SPARK_DAYS = 14;

function lastNDays(n: number): string[] {
  const days: string[] = [];
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  for (let i = n - 1; i >= 0; i--) {
    const dd = new Date(d.getTime() - i * 86400_000);
    days.push(dd.toISOString().slice(0, 10));
  }
  return days;
}

function bucketByDay(
  rows: { date: Date }[],
  days: string[],
): SparkPoint[] {
  const map = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of rows) {
    const key = r.date.toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return days.map((d) => ({ date: d.slice(5), value: map.get(d) ?? 0 }));
}

export default async function DashboardHome() {
  const session = await auth();
  const t = await getTranslations('dashboard');

  const days = lastNDays(SPARK_DAYS);
  const since = new Date(`${days[0]!}T00:00:00.000Z`);

  const [
    totalCases,
    pendingCases,
    completedCases,
    pendingApprovals,
    casesCreatedRecent,
    casesPendingTrans,
    casesRefundedTrans,
    usersPendingRecent,
  ] = await Promise.all([
    prisma.refundCase.count({ where: { deletedAt: null } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'REFUNDED' } }),
    prisma.user.count({ where: { status: 'PENDING' } }),
    prisma.refundCase.findMany({
      where: { deletedAt: null, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    // Use AuditLog as the source of pending-approval transitions so the
    // sparkline reflects flow, not the static current backlog.
    prisma.auditLog.findMany({
      where: { action: 'case.pending_approval', createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { action: 'case.refunded', createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.user.findMany({
      where: { createdAt: { gte: since }, status: 'PENDING' },
      select: { createdAt: true },
    }),
  ]);

  const recentCases = await prisma.refundCase.findMany({
    where: { deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    take: RECENT_LIMIT,
    select: {
      id: true,
      caseNumber: true,
      status: true,
      totalRefundAmount: true,
      orderCurrency: true,
      updatedAt: true,
      brand: { select: { name: true } },
    },
  });

  const dateFmt = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

  const trendCreated = bucketByDay(
    casesCreatedRecent.map((r) => ({ date: r.createdAt })),
    days,
  );
  const trendPending = bucketByDay(
    casesPendingTrans.map((r) => ({ date: r.createdAt })),
    days,
  );
  const trendRefunded = bucketByDay(
    casesRefundedTrans.map((r) => ({ date: r.createdAt })),
    days,
  );
  const trendUserApprovals = bucketByDay(
    usersPendingRecent.map((r) => ({ date: r.createdAt })),
    days,
  );

  const stats: {
    label: string;
    value: number;
    icon: typeof FileText;
    tint: string;
    sparkTint: 'primary' | 'warning' | 'success' | 'destructive';
    trend: SparkPoint[];
    unit: string;
  }[] = [
    { label: 'Total cases', value: totalCases, icon: FileText, tint: 'text-primary', sparkTint: 'primary', trend: trendCreated, unit: 'created' },
    { label: 'Pending approval', value: pendingCases, icon: Clock, tint: 'text-warning', sparkTint: 'warning', trend: trendPending, unit: 'submitted' },
    { label: 'Completed', value: completedCases, icon: CheckCircle2, tint: 'text-success', sparkTint: 'success', trend: trendRefunded, unit: 'refunded' },
    { label: 'User approvals', value: pendingApprovals, icon: AlertCircle, tint: 'text-destructive', sparkTint: 'destructive', trend: trendUserApprovals, unit: 'requests' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          {t('welcome', { name: session?.user.name ?? '' })}
        </h1>
        <p className="mt-2 text-body">Here's what's happening across the platform today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const sum = stat.trend.reduce((s, p) => s + p.value, 0);
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-body">{stat.label}</CardTitle>
                <Icon className={`h-5 w-5 ${stat.tint}`} />
              </CardHeader>
              <CardContent>
                <div className="text-display-md font-light tabular">{stat.value}</div>
                <KpiSparkline data={stat.trend} tint={stat.sparkTint} unitLabel={stat.unit} />
                <div className="mt-1.5 text-xs text-muted-foreground">
                  {sum} {stat.unit} · last {SPARK_DAYS} days
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('recentActivity')}</CardTitle>
            <CardDescription>Latest cases across all countries</CardDescription>
          </CardHeader>
          <CardContent>
            {recentCases.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No cases yet. Create your first case from the Cases tab.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentCases.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-sm font-medium tracking-tight text-foreground hover:underline"
                      >
                        {c.caseNumber}
                      </Link>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="truncate">{c.brand?.name ?? '—'}</span>
                        <span>·</span>
                        <span className="tabular">
                          {c.totalRefundAmount.toFixed(2)} {c.orderCurrency}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge
                        variant={statusTone[c.status] ?? 'default'}
                        className="font-mono text-[10px] uppercase tracking-wide"
                      >
                        {c.status.replace(/_/g, ' ')}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {dateFmt.format(c.updatedAt)}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>System status</CardTitle>
              <Badge variant="success">Operational</Badge>
            </div>
            <CardDescription>Live snapshot of the platform's core surfaces.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Auth.js v5 with RBAC across 8 roles</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> i18n EN + AR with RTL + Cairo / IBM Plex Arabic</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Three-layer design tokens + dark-mode parity</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Prisma migrations + composite indexes</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Bulk ops, scheduled reports, automation rules</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-success" /> Playwright + axe-core smoke suites</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
