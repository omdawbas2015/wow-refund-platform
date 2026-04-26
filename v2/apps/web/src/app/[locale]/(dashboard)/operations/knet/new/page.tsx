import { prisma } from '@wow/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/auth';
import { KnetBatchPicker } from './picker';

export default async function NewKnetBatchPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'FINANCE_LEAD' && role !== 'OPS_LEAD') {
    redirect('/operations');
  }

  const components = await prisma.refundComponent.findMany({
    where: {
      batchId: null,
      status: { in: ['PENDING', 'AWAITING_BATCH'] },
      paymentMethod: { key: 'KNET' },
      case: {
        status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
        deletedAt: null,
      },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    include: {
      paymentMethod: { select: { label: true } },
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
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">New KNET batch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bundle KNET components from approved cases and dispatch to Finance for ARN return.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>KNET components awaiting batch</CardTitle>
          <CardDescription>
            Select the components to include. Components attach to the batch and lock as
            <code> AWAITING_BATCH</code> until the batch is sent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <KnetBatchPicker
            components={components.map((c) => ({
              id: c.id,
              authCode: c.authCode,
              amount: c.amount,
              currency: c.currency,
              caseNumber: c.case.caseNumber,
              customerName: c.case.customerName,
              orderNumber: c.case.orderNumber,
              countryCode: c.case.country.registryCode,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
