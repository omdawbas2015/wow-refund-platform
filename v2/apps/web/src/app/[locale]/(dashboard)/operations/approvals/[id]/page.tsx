import { prisma } from '@wow/db';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { auth } from '@/auth';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import { caseStatusLabel, caseStatusVariant } from '@/lib/cases/case-status-display';
import {
  approvalBatchLabel,
  approvalBatchVariant,
} from '@/lib/batches/batch-status-display';
import { ApprovalBatchActions } from './actions';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function ApprovalBatchDetailPage({ params }: PageProps) {
  const { id, locale } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'COUNTRY_MANAGER' && role !== 'OPS_LEAD') {
    redirect('/operations');
  }
  const localeFmt = locale === 'ar' ? 'ar-KW' : 'en-US';

  const batch = await prisma.approvalBatch.findUnique({
    where: { id },
    include: {
      country: { select: { registryCode: true, registry: { select: { nameEn: true } } } },
      createdBy: { select: { name: true, email: true } },
      cases: {
        where: { deletedAt: null },
        orderBy: { caseNumber: 'asc' },
        include: { brand: { select: { name: true } } },
      },
    },
  });
  if (!batch) notFound();

  const totalAmount = batch.cases.reduce((s, c) => s + c.totalRefundAmount, 0);
  const currency = batch.cases[0]?.orderCurrency ?? '';

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link
            href="/operations"
            className="text-xs uppercase text-muted-foreground hover:text-primary"
          >
            ← Operations
          </Link>
          <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">
            {batch.batchNumber}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={approvalBatchVariant(batch.status)}>
              {approvalBatchLabel(batch.status)}
            </Badge>
            <span>· {batch.country.registry.nameEn} ({batch.country.registryCode})</span>
            <span>· created {formatDate(batch.createdAt, localeFmt)} by {batch.createdBy.name}</span>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total cases" value={batch.totalCases} />
        <Stat label="Approved" value={batch.approvedCases} />
        <Stat label="Rejected" value={batch.rejectedCases} />
        <Stat
          label="Total amount"
          value={currency ? formatCurrency(totalAmount, currency, 'en-US', 2) : `${totalAmount.toFixed(2)}`}
        />
      </div>

      <div className="mb-6">
        <ApprovalBatchActions
          batchId={batch.id}
          status={batch.status}
          recipientEmails={batch.recipientEmails}
          cases={batch.cases.map((c) => ({
            id: c.id,
            caseNumber: c.caseNumber,
            customerName: c.customerName,
            orderNumber: c.orderNumber,
            amount: c.totalRefundAmount,
            currency: c.orderCurrency,
            status: c.status,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Case</th>
                  <th>Brand</th>
                  <th>Customer</th>
                  <th>Order</th>
                  <th className="text-end">Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batch.cases.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2 font-medium">{c.caseNumber}</td>
                    <td className="px-4 py-2">{c.brand.name}</td>
                    <td className="px-4 py-2">{c.customerName}</td>
                    <td className="px-4 py-2 tabular">{c.orderNumber}</td>
                    <td className="px-4 py-2 text-end tabular">
                      {formatCurrency(c.totalRefundAmount, c.orderCurrency, 'en-US', 2)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={caseStatusVariant(c.status)}>
                        {caseStatusLabel(c.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-xs uppercase text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {batch.sentAt ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Sent {formatDateTime(batch.sentAt, localeFmt)} to {batch.recipientEmails}.
        </p>
      ) : null}
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
