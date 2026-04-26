import { prisma } from '@wow/db';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { auth } from '@/auth';
import { AuraBatchPicker } from './picker';

export default async function NewAuraBatchPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') redirect('/operations');

  const cases = await prisma.refundCase.findMany({
    where: {
      deletedAt: null,
      auraStatus: 'PENDING',
      auraPoints: { gt: 0 },
      status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
    },
    orderBy: { createdAt: 'asc' },
    take: 200,
    select: {
      id: true,
      caseNumber: true,
      customerName: true,
      customerEmail: true,
      orderNumber: true,
      auraPoints: true,
      brand: { select: { slug: true, name: true } },
      country: { select: { registryCode: true } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">New Aura batch</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bundle Aura-point refunds from approved cases and dispatch to the Aura team for confirmation.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cases awaiting Aura processing</CardTitle>
          <CardDescription>
            Snapshots are captured at create time; cases are not locked, so a re-send is possible if Aura asks.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AuraBatchPicker
            cases={cases.map((c) => ({
              id: c.id,
              caseNumber: c.caseNumber,
              customerName: c.customerName,
              customerEmail: c.customerEmail,
              orderNumber: c.orderNumber,
              auraPoints: c.auraPoints ?? 0,
              brandName: c.brand.name,
              countryCode: c.country.registryCode,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
