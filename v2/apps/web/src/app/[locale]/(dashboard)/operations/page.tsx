import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApprovalBatchesPanel } from './approval-batches-panel';
import { KnetBatchesPanel } from './knet-batches-panel';
import { AuraBatchesPanel } from './aura-batches-panel';

const OPS_ROLES = new Set(['ADMIN', 'OPERATIONS', 'MANAGER']);

export const dynamic = 'force-dynamic';

export default async function OperationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!OPS_ROLES.has(session.user.role ?? '')) redirect('/');

  const sp = await searchParams;
  const tabParam = typeof sp['tab'] === 'string' ? sp['tab'] : 'approvals';
  const activeTab =
    tabParam === 'knet' || tabParam === 'aura' ? tabParam : 'approvals';

  const [
    countries,
    pendingByCountry,
    liveApprovalBatches,
    pendingKnetComponents,
    liveKnetBatches,
    pendingAuraCases,
    liveAuraBatches,
  ] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.refundCase.groupBy({
      by: ['countryId'],
      where: {
        status: 'PENDING_APPROVAL',
        deletedAt: null,
        OR: [
          { approvalBatchId: null },
          {
            approvalBatch: {
              status: { notIn: ['DRAFT', 'SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'] },
            },
          },
        ],
      },
      _count: { _all: true },
      _sum: { totalRefundAmount: true },
    }),
    prisma.approvalBatch.findMany({
      where: {
        status: { in: ['SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'] },
      },
      include: {
        country: { include: { registry: true } },
        cases: {
          select: {
            id: true,
            caseNumber: true,
            customerName: true,
            status: true,
            totalRefundAmount: true,
            orderCurrency: true,
          },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
    prisma.refundComponent.findMany({
      where: {
        status: 'AWAITING_ARN',
        arn: null,
        case: { deletedAt: null },
      },
      include: {
        case: {
          select: {
            id: true,
            caseNumber: true,
            customerName: true,
          },
        },
        paymentMethod: { select: { label: true, key: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.knetBatch.findMany({
      where: { status: { in: ['SENT', 'AWAITING_ARNS', 'ARNS_RECEIVED'] } },
      include: {
        components: {
          select: {
            id: true,
            arn: true,
            status: true,
            amount: true,
            currency: true,
            authCode: true,
            case: { select: { id: true, caseNumber: true, customerName: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
    prisma.refundCase.findMany({
      where: {
        auraStatus: 'PENDING',
        auraBatchId: null,
        auraPoints: { gt: 0 },
        deletedAt: null,
      },
      select: {
        id: true,
        caseNumber: true,
        customerName: true,
        customerEmail: true,
        orderNumber: true,
        auraPoints: true,
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),
    prisma.auraBatch.findMany({
      where: { status: { in: ['SENT', 'AWAITING'] } },
      orderBy: { sentAt: 'desc' },
      take: 25,
    }),
  ]);

  const byCountry = new Map(
    pendingByCountry.map((p) => [
      p.countryId,
      { count: p._count._all, total: p._sum.totalRefundAmount ?? 0 },
    ]),
  );
  const countryRows = countries.map((c) => {
    const stats = byCountry.get(c.id) ?? { count: 0, total: 0 };
    return {
      id: c.id,
      code: c.registry.code,
      name: c.registry.nameEn,
      flag: c.registry.flag,
      managerEmail: c.managerEmail,
      pendingCount: stats.count,
      pendingTotal: stats.total,
      currency: c.registry.currencyCode,
    };
  });

  const totalPendingApprovals = countryRows.reduce((s, r) => s + r.pendingCount, 0);
  const totalPendingArns = pendingKnetComponents.length;
  const totalPendingAura = pendingAuraCases.length;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-display-md font-normal tracking-tight text-heading">
              Refund Operations
            </h1>
            <p className="mt-1 text-body">
              Daily approvals, KNET execution, and Aura confirmations.
            </p>
          </div>
          <Badge variant="outline" className="text-xs">
            Phase 3 · live batches
          </Badge>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Pending approvals"
          value={totalPendingApprovals}
          hint={`${countryRows.filter((c) => c.pendingCount > 0).length} countr${
            countryRows.filter((c) => c.pendingCount > 0).length === 1 ? 'y' : 'ies'
          } with cases`}
        />
        <SummaryCard
          label="ARNs awaiting verification"
          value={totalPendingArns}
          hint={`${liveKnetBatches.length} live KNET batch${liveKnetBatches.length === 1 ? '' : 'es'}`}
        />
        <SummaryCard
          label="Aura cases pending"
          value={totalPendingAura}
          hint={`${liveAuraBatches.length} live Aura batch${liveAuraBatches.length === 1 ? '' : 'es'}`}
        />
      </div>

      <Tabs defaultValue={activeTab} className="space-y-4">
        <TabsList className="h-10">
          <TabsTrigger value="approvals" asChild>
            <Link href="?tab=approvals" scroll={false}>
              Approvals
            </Link>
          </TabsTrigger>
          <TabsTrigger value="knet" asChild>
            <Link href="?tab=knet" scroll={false}>
              KNET
            </Link>
          </TabsTrigger>
          <TabsTrigger value="aura" asChild>
            <Link href="?tab=aura" scroll={false}>
              Aura
            </Link>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="approvals">
          <ApprovalBatchesPanel
            countries={countryRows}
            liveBatches={liveApprovalBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              countryName: b.country.registry.nameEn,
              countryFlag: b.country.registry.flag,
              status: b.status,
              sentAt: b.sentAt?.toISOString() ?? null,
              recipientEmails: b.recipientEmails,
              totalCases: b.totalCases,
              approvedCases: b.approvedCases,
              rejectedCases: b.rejectedCases,
              cases: b.cases.map((c) => ({
                id: c.id,
                caseNumber: c.caseNumber,
                customerName: c.customerName,
                status: c.status,
                amount: c.totalRefundAmount,
                currency: c.orderCurrency,
              })),
            }))}
          />
        </TabsContent>

        <TabsContent value="knet">
          <KnetBatchesPanel
            pendingComponents={pendingKnetComponents.map((c) => ({
              id: c.id,
              caseId: c.case.id,
              caseNumber: c.case.caseNumber,
              customerName: c.case.customerName,
              authCode: c.authCode,
              amount: c.amount,
              currency: c.currency,
              status: c.status,
              suggestedArn: c.arn,
            }))}
            liveBatches={liveKnetBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              status: b.status,
              sentAt: b.sentAt?.toISOString() ?? null,
              totalComponents: b.totalComponents,
              arnsReceived: b.arnsReceived,
              verifiedComponents: b.verifiedComponents,
              components: b.components.map((c) => ({
                id: c.id,
                caseNumber: c.case.caseNumber,
                customerName: c.case.customerName,
                authCode: c.authCode,
                amount: c.amount,
                currency: c.currency,
                status: c.status,
                suggestedArn: c.arn,
              })),
            }))}
          />
        </TabsContent>

        <TabsContent value="aura">
          <AuraBatchesPanel
            pendingCases={pendingAuraCases.map((c) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              customerName: c.customerName,
              customerEmail: c.customerEmail,
              orderNumber: c.orderNumber,
              points: c.auraPoints ?? 0,
            }))}
            liveBatches={liveAuraBatches.map((b) => ({
              id: b.id,
              batchNumber: b.batchNumber,
              status: b.status,
              sentAt: b.sentAt?.toISOString() ?? null,
              totalCases: b.totalCases,
              completedCases: b.completedCases,
            }))}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-body">{label}</CardTitle>
        <CardDescription className="text-xs">{hint}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-display-sm font-light tabular text-heading">{value}</div>
      </CardContent>
    </Card>
  );
}
