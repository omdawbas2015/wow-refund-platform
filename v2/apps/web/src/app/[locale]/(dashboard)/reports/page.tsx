import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { ChevronRight, BarChart3, Wallet, History, Mail, Globe, Timer, Users } from 'lucide-react';
import { parseRange, eachDayInRange } from '@/lib/reports/range';
import { DailyVolumeChart } from './charts';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD') {
    redirect('/');
  }

  const sp = await searchParams;
  const range = parseRange({ from: sp.from, to: sp.to });

  const [caseCount, refundedCount, totalAmount, openCases, createdRows, refundedRows] =
    await Promise.all([
      prisma.refundCase.count({
        where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
      }),
      prisma.refundCase.count({
        where: {
          status: 'REFUNDED',
          createdAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
      }),
      prisma.refundComponent.aggregate({
        where: {
          status: 'REFUNDED',
          refundedAt: { gte: range.from, lte: range.to },
        },
        _sum: { amount: true },
      }),
      prisma.refundCase.count({
        where: {
          status: { in: ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_EXECUTION'] },
          deletedAt: null,
        },
      }),
      prisma.refundCase.findMany({
        where: { createdAt: { gte: range.from, lte: range.to }, deletedAt: null },
        select: { createdAt: true },
      }),
      prisma.refundCase.findMany({
        where: {
          status: 'REFUNDED',
          updatedAt: { gte: range.from, lte: range.to },
          deletedAt: null,
        },
        select: { updatedAt: true },
      }),
    ]);

  const days = eachDayInRange(range);
  const createdByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of createdRows) {
    const k = r.createdAt.toISOString().slice(0, 10);
    if (createdByDay.has(k)) createdByDay.set(k, (createdByDay.get(k) ?? 0) + 1);
  }
  const refundedByDay = new Map<string, number>(days.map((d) => [d, 0]));
  for (const r of refundedRows) {
    const k = r.updatedAt.toISOString().slice(0, 10);
    if (refundedByDay.has(k)) refundedByDay.set(k, (refundedByDay.get(k) ?? 0) + 1);
  }
  const dailyVolume = days.map((date) => ({
    date,
    created: createdByDay.get(date) ?? 0,
    refunded: refundedByDay.get(date) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Operational and financial overviews. Date range applies to most metrics. Detailed
          breakdowns live in the linked sub-reports.
        </p>
      </div>

      <RangeForm from={range.fromIso} to={range.toIso} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Cases created" value={caseCount} />
        <Stat label="Cases refunded" value={refundedCount} />
        <Stat
          label="Refunded amount"
          value={totalAmount._sum.amount ? totalAmount._sum.amount.toFixed(3) : '0.000'}
        />
        <Stat label="Open cases (all-time)" value={openCases} />
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Daily volume</CardTitle>
          <CardDescription>
            Cases created vs cases that reached REFUNDED in the selected range.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyVolumeChart data={dailyVolume} />
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <ReportCard
          href={`/reports/cases?from=${range.fromIso}&to=${range.toIso}`}
          icon={BarChart3}
          title="Cases by status"
          desc="Per-day case volume bucketed by current status"
        />
        <ReportCard
          href={`/reports/refunds?from=${range.fromIso}&to=${range.toIso}`}
          icon={Wallet}
          title="Refunded amount"
          desc="Daily refunded total per country and payment method"
        />
        <ReportCard
          href="/reports/audit"
          icon={History}
          title="Audit log"
          desc="All system events: who did what, when"
        />
        <ReportCard
          href="/reports/emails"
          icon={Mail}
          title="Email log"
          desc="Outbound mail with delivery status"
        />
        <ReportCard
          href={`/reports/countries?from=${range.fromIso}&to=${range.toIso}`}
          icon={Globe}
          title="By country"
          desc="Volume and amount per market"
        />
        <ReportCard
          href="/reports/sla"
          icon={Timer}
          title="SLA"
          desc="Open cases against active SLA rules"
        />
        <ReportCard
          href={`/reports/agents?from=${range.fromIso}&to=${range.toIso}`}
          icon={Users}
          title="By agent"
          desc="Per-agent volume, refund amount, and resolution time"
        />
      </div>
    </div>
  );
}

function Stat(props: { label: string; value: number | string }) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
        <div className="mt-1 text-xl font-medium tabular">{props.value}</div>
      </CardContent>
    </Card>
  );
}

function ReportCard(props: {
  href: string;
  icon: typeof BarChart3;
  title: string;
  desc: string;
}) {
  return (
    <Link href={props.href} className="block">
      <Card className="transition-colors hover:border-primary/40">
        <CardHeader className="flex-row items-center gap-3 space-y-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
            <props.icon className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-base">{props.title}</CardTitle>
            <CardDescription>{props.desc}</CardDescription>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent />
      </Card>
    </Link>
  );
}

function RangeForm(props: { from: string; to: string }) {
  return (
    <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
      <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
        From
        <input
          type="date"
          name="from"
          defaultValue={props.from}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
        To
        <input
          type="date"
          name="to"
          defaultValue={props.to}
          className="h-9 rounded-md border border-border bg-background px-2 text-sm text-foreground"
        />
      </label>
      <button
        type="submit"
        className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        Update
      </button>
    </form>
  );
}
