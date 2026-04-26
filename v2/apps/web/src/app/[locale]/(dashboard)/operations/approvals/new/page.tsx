import { prisma } from '@wow/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApprovalBatchPicker } from './picker';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function NewApprovalBatchPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'COUNTRY_MANAGER' && role !== 'OPS_LEAD') {
    redirect('/operations');
  }

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      registryCode: true,
      managerEmail: true,
      registry: { select: { nameEn: true } },
    },
  });

  const cases = await prisma.refundCase.findMany({
    where: {
      status: 'PENDING_APPROVAL',
      deletedAt: null,
      approvalBatchId: null,
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      caseNumber: true,
      countryId: true,
      customerName: true,
      orderNumber: true,
      orderCurrency: true,
      totalRefundAmount: true,
      createdAt: true,
      brand: { select: { name: true } },
    },
    take: 200,
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">New approval batch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bundle pending refund cases for a single country and send the manager an approval email.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pending cases by country</CardTitle>
          <CardDescription>
            Pick a country, select the cases to include, and create the batch as a draft. You can
            review and dispatch the email once the draft is ready.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ApprovalBatchPicker
            countries={countries.map((c) => ({
              id: c.id,
              code: c.registryCode,
              name: c.registry.nameEn,
              managerEmail: c.managerEmail,
            }))}
            cases={cases.map((c) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              countryId: c.countryId,
              customerName: c.customerName,
              orderNumber: c.orderNumber,
              orderCurrency: c.orderCurrency,
              totalRefundAmount: c.totalRefundAmount,
              brandName: c.brand.name,
              createdAt: c.createdAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
