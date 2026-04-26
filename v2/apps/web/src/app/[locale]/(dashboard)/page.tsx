import { getTranslations } from 'next-intl/server';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import type { CaseStatus } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { FileText, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { caseStatusLabel, caseStatusVariant } from '@/lib/cases/case-status-display';
import { SlaPill } from '@/components/cases/sla-pill';
import { formatDate } from '@/lib/utils';

const TERMINAL: CaseStatus[] = ['REFUNDED', 'REJECTED', 'CANCELLED'];

export default async function DashboardHome() {
  const session = await auth();
  const t = await getTranslations('dashboard');
  const locale = session?.user?.preferredLocale ?? 'en';
  const localePrefix = locale === 'ar' ? 'ar-KW' : 'en-US';

  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;
  const breachedCutoff = new Date(now.getTime() - 6 * dayMs);
  const warningCutoff = new Date(now.getTime() - 3 * dayMs);

  // Stats — totals plus SLA tiers across the open queue. We query each tier
  // independently rather than deriving on-track via subtraction, because
  // `completedCases` only counts REFUNDED (not REJECTED/CANCELLED), so the
  // earlier `total - completed - breached - warning` formula was inflating
  // on-track by exactly the number of rejected/cancelled cases.
  const [
    totalCases,
    pendingApproval,
    completedCases,
    pendingUserApprovals,
    breachedOpen,
    atRiskOpen,
    onTrackOpen,
    recent,
  ] = await Promise.all([
    prisma.refundCase.count({ where: { deletedAt: null } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'PENDING_APPROVAL' } }),
    prisma.refundCase.count({ where: { deletedAt: null, status: 'REFUNDED' } }),
    prisma.user.count({ where: { status: 'PENDING' } }),
    prisma.refundCase.count({
      where: {
        deletedAt: null,
        status: { notIn: TERMINAL },
        createdAt: { lte: breachedCutoff },
      },
    }),
    prisma.refundCase.count({
      where: {
        deletedAt: null,
        status: { notIn: TERMINAL },
        createdAt: { lte: warningCutoff, gt: breachedCutoff },
      },
    }),
    prisma.refundCase.count({
      where: {
        deletedAt: null,
        status: { notIn: TERMINAL },
        createdAt: { gt: warningCutoff },
      },
    }),
    prisma.refundCase.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        customerName: true,
        createdAt: true,
        country: { select: { registryCode: true } },
      },
    }),
  ]);

  const stats = [
    { label: 'Total cases', value: totalCases, icon: FileText, tint: 'text-primary' },
    { label: 'Pending approval', value: pendingApproval, icon: Clock, tint: 'text-warning' },
    { label: 'Completed', value: completedCases, icon: CheckCircle2, tint: 'text-success' },
    { label: 'User approvals', value: pendingUserApprovals, icon: AlertCircle, tint: 'text-destructive' },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          {t('welcome', { name: session?.user.name ?? '' })}
        </h1>
        <p className="mt-2 text-body">Here&apos;s what&apos;s happening across the platform today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-body">{stat.label}</CardTitle>
                <Icon className={`h-5 w-5 ${stat.tint}`} />
              </CardHeader>
              <CardContent>
                <div className="text-display-md font-light tabular">{stat.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>SLA queue</CardTitle>
            <CardDescription>
              Open cases by age. Cases breached for &gt;6 days need immediate attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-destructive" />
                  Breached (&ge; 6 days)
                </span>
                <Link
                  href="/cases?sla=breached"
                  className="rounded-md bg-destructive/10 px-2 py-0.5 font-medium text-destructive tabular hover:bg-destructive/15"
                >
                  {breachedOpen}
                </Link>
              </li>
              <li className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-amber-500" />
                  At risk (3–5 days)
                </span>
                <Link
                  href="/cases?sla=warning"
                  className="rounded-md bg-amber-500/10 px-2 py-0.5 font-medium text-amber-700 tabular hover:bg-amber-500/15 dark:text-amber-400"
                >
                  {atRiskOpen}
                </Link>
              </li>
              <li className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-500" />
                  On track (&lt; 3 days)
                </span>
                <Link
                  href="/cases?sla=on_track"
                  className="rounded-md bg-emerald-500/10 px-2 py-0.5 font-medium text-emerald-700 tabular hover:bg-emerald-500/15 dark:text-emerald-400"
                >
                  {onTrackOpen}
                </Link>
              </li>
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t('recentActivity')}</CardTitle>
              <Link
                href="/cases"
                className="text-xs uppercase tracking-wide text-muted-foreground hover:text-primary"
              >
                View all →
              </Link>
            </div>
            <CardDescription>Latest cases across all countries</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {recent.length === 0 ? (
              <p className="px-6 py-4 text-sm text-muted-foreground">
                No cases yet. Create your first case from the Cases tab.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-6 py-2.5">
                    <Link href={`/cases/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.caseNumber}
                    </Link>
                    <span className="text-xs uppercase text-muted-foreground tabular">
                      {c.country.registryCode}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">{c.customerName}</span>
                    <span className="ms-auto flex items-center gap-2">
                      <SlaPill status={c.status} createdAt={c.createdAt} />
                      <Badge variant={caseStatusVariant(c.status)}>{caseStatusLabel(c.status)}</Badge>
                      <span className="hidden text-xs text-muted-foreground tabular sm:inline">
                        {formatDate(c.createdAt, localePrefix)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
