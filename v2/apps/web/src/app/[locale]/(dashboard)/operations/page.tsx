import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { ShieldCheck, CreditCard, ArrowRight, Sparkles } from 'lucide-react';
import { auth } from '@/auth';
import { formatDate } from '@/lib/utils';
import {
  approvalBatchLabel,
  approvalBatchVariant,
  knetBatchLabel,
  knetBatchVariant,
} from '@/lib/batches/batch-status-display';

export default async function OperationsPage() {
  const session = await auth();
  const localeFmt = session?.user?.preferredLocale === 'ar' ? 'ar-KW' : 'en-US';

  const [
    pendingApproval,
    awaitingBatch,
    awaitingArn,
    auraPending,
    recentApproval,
    recentKnet,
    recentAura,
  ] = await Promise.all([
    prisma.refundCase.count({ where: { status: 'PENDING_APPROVAL', deletedAt: null } }),
    prisma.refundComponent.count({
      where: {
        status: { in: ['PENDING', 'AWAITING_BATCH'] },
        batchId: null,
        paymentMethod: { key: 'KNET' },
        case: { status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] }, deletedAt: null },
      },
    }),
    prisma.refundComponent.count({ where: { status: 'AWAITING_ARN' } }),
    prisma.refundCase.count({
      where: {
        deletedAt: null,
        auraStatus: 'PENDING',
        auraPoints: { gt: 0 },
        status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
      },
    }),
    prisma.approvalBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { country: { select: { registryCode: true } } },
    }),
    prisma.knetBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.auraBatch.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">Refund operations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Approval batches for managers, KNET batches for finance, and Aura confirmations.
        </p>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Cases pending approval" value={pendingApproval} />
        <Kpi label="KNET components awaiting batch" value={awaitingBatch} />
        <Kpi label="Components awaiting ARN" value={awaitingArn} />
        <Kpi label="Cases awaiting Aura batch" value={auraPending} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Approval batches */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              Approval batches
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/operations/approvals/new">
                New batch
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentApproval.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No batches yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentApproval.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/operations/approvals/${b.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{b.batchNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.country.registryCode} · {b.totalCases} case(s) · {formatDate(b.createdAt, localeFmt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={approvalBatchVariant(b.status)}>
                          {approvalBatchLabel(b.status)}
                        </Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* KNET batches */}
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              KNET batches
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/operations/knet/new">New batch</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentKnet.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No batches yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentKnet.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/operations/knet/${b.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{b.batchNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.totalComponents} component(s) · ARN {b.arnsReceived}/{b.totalComponents} ·
                          verified {b.verifiedComponents} · {formatDate(b.createdAt, localeFmt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={knetBatchVariant(b.status)}>{knetBatchLabel(b.status)}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Aura batches */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Aura batches
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/operations/aura/new">New batch</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {recentAura.length === 0 ? (
              <p className="px-6 pb-6 text-sm text-muted-foreground">No batches yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {recentAura.map((b) => (
                  <li key={b.id}>
                    <Link
                      href={`/operations/aura/${b.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{b.batchNumber}</div>
                        <div className="text-xs text-muted-foreground">
                          {b.totalCases} case(s) · {b.completedCases}/{b.totalCases} confirmed ·{' '}
                          {formatDate(b.createdAt, localeFmt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{b.status}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </Link>
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

function Kpi(props: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-xs uppercase text-muted-foreground">{props.label}</div>
        <div className="mt-1 text-display-sm font-normal tabular">{props.value}</div>
      </CardContent>
    </Card>
  );
}
