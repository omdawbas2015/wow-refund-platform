import { notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ApprovalDecisionForm } from './decision-form';

/**
 * Magic-link approval page.
 *
 * Country managers receive an email with a unique URL — this page lets them
 * approve / reject the cases on a single batch from the browser without ever
 * logging into the dashboard.
 */
export default async function ApprovalLandingPage({
  params,
}: {
  params: Promise<{ token: string; locale: string }>;
}) {
  const { token } = await params;
  const batch = await prisma.approvalBatch.findUnique({
    where: { magicLinkToken: token },
    include: {
      country: { include: { registry: true } },
      cases: {
        include: {
          brand: { select: { name: true } },
          components: { include: { paymentMethod: { select: { label: true } } } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!batch) notFound();

  const isClosed = batch.status === 'COMPLETED' || batch.status === 'CANCELLED';
  const totalRefund = batch.cases.reduce((sum, c) => sum + c.totalRefundAmount, 0);
  const currency = batch.cases[0]?.orderCurrency ?? 'USD';

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">
          {batch.country.registry.flag} {batch.country.registry.nameEn} · daily approval batch
        </div>
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          Batch {batch.batchNumber}
        </h1>
        <div className="text-sm text-muted-foreground">
          {batch.totalCases} case{batch.totalCases === 1 ? '' : 's'} · total{' '}
          <span className="font-medium text-heading tabular">
            {totalRefund.toFixed(2)} {currency}
          </span>{' '}
          · status{' '}
          <Badge variant={isClosed ? 'success' : 'secondary'} className="text-[10px]">
            {batch.status.replace(/_/g, ' ')}
          </Badge>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases on this batch</CardTitle>
          <CardDescription>
            Review the cases below, then approve or reject the batch. You can also reply to
            the email with the same decision — both routes are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {batch.cases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-start justify-between gap-3 py-3">
                <div>
                  <div className="font-mono text-sm">{c.caseNumber}</div>
                  <div className="text-sm text-heading">{c.customerName}</div>
                  <div className="text-xs text-muted-foreground">
                    Order {c.orderNumber} · {c.brand.name} ·{' '}
                    {c.components[0]?.paymentMethod.label ?? '—'}
                  </div>
                </div>
                <div className="text-end">
                  <div className="tabular text-sm">
                    {c.totalRefundAmount.toFixed(2)} {c.orderCurrency}
                  </div>
                  <Badge
                    variant={
                      c.status === 'APPROVED'
                        ? 'success'
                        : c.status === 'REJECTED'
                          ? 'destructive'
                          : 'outline'
                    }
                    className="mt-1 text-[10px]"
                  >
                    {c.status}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {isClosed ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            This batch is {batch.status.toLowerCase()} — no further action is needed.
          </CardContent>
        </Card>
      ) : (
        <ApprovalDecisionForm token={token} batchNumber={batch.batchNumber} />
      )}
    </div>
  );
}
