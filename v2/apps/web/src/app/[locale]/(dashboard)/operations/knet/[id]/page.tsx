import { prisma } from '@wow/db';
import { notFound, redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { auth } from '@/auth';
import { formatDate, formatDateTime, formatCurrency } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import {
  componentStatusLabel,
  componentStatusVariant,
} from '@/lib/cases/case-status-display';
import {
  knetBatchLabel,
  knetBatchVariant,
} from '@/lib/batches/batch-status-display';
import { KnetBatchActions } from './actions';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function KnetBatchDetailPage({ params }: PageProps) {
  const { id, locale } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'FINANCE_LEAD' && role !== 'OPS_LEAD') {
    redirect('/operations');
  }
  const localeFmt = locale === 'ar' ? 'ar-KW' : 'en-US';

  const batch = await prisma.knetBatch.findUnique({
    where: { id },
    include: {
      components: {
        orderBy: { createdAt: 'asc' },
        include: {
          case: {
            select: {
              id: true,
              caseNumber: true,
              customerName: true,
              orderNumber: true,
              country: { select: { registryCode: true } },
            },
          },
        },
      },
    },
  });
  if (!batch) notFound();

  const total = batch.components.reduce((s, c) => s + c.amount, 0);
  const currency = batch.components[0]?.currency ?? '';

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <Link href="/operations" className="text-xs uppercase text-muted-foreground hover:text-primary">
            ← Operations
          </Link>
          <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">
            {batch.batchNumber}
          </h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant={knetBatchVariant(batch.status)}>{knetBatchLabel(batch.status)}</Badge>
            <span>· created {formatDate(batch.createdAt, localeFmt)}</span>
            {batch.sentAt ? <span>· sent {formatDateTime(batch.sentAt, localeFmt)}</span> : null}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/export/knet-batch/${batch.id}`} download>
            <Download className="me-2 h-4 w-4" />
            Export .xlsx
          </a>
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total components" value={batch.totalComponents} />
        <Stat label="ARNs received" value={`${batch.arnsReceived}/${batch.totalComponents}`} />
        <Stat label="Verified" value={batch.verifiedComponents} />
        <Stat
          label="Total amount"
          value={currency ? formatCurrency(total, currency, 'en-US', 3) : `${total.toFixed(3)}`}
        />
      </div>

      <div className="mb-6">
        <KnetBatchActions
          batchId={batch.id}
          status={batch.status}
          recipientEmails={batch.recipientEmails}
          components={batch.components.map((c) => ({
            id: c.id,
            authCode: c.authCode,
            arn: c.arn,
            amount: c.amount,
            currency: c.currency,
            status: c.status,
            caseId: c.case.id,
            caseNumber: c.case.caseNumber,
            customerName: c.case.customerName,
          }))}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Components</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Country</th>
                  <th>Case</th>
                  <th>Customer</th>
                  <th>Auth</th>
                  <th>ARN</th>
                  <th className="text-end">Amount</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {batch.components.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-subtle">
                    <td className="px-4 py-2 tabular">{c.case.country.registryCode}</td>
                    <td className="px-4 py-2 font-medium">{c.case.caseNumber}</td>
                    <td className="px-4 py-2">{c.case.customerName}</td>
                    <td className="px-4 py-2 tabular">{c.authCode ?? '—'}</td>
                    <td className="px-4 py-2 tabular">{c.arn ?? '—'}</td>
                    <td className="px-4 py-2 text-end tabular">
                      {formatCurrency(c.amount, c.currency, 'en-US', 3)}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={componentStatusVariant(c.status)}>
                        {componentStatusLabel(c.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/cases/${c.case.id}`}
                        className="text-xs uppercase text-primary hover:underline"
                      >
                        Case
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
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
