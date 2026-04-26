import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { AllocateForm } from './form';

export default async function AllocatePage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') redirect('/promo');

  const configs = await prisma.promoConfig.findMany({
    where: { isActive: true },
    orderBy: [{ type: 'asc' }, { createdAt: 'desc' }],
    include: {
      brand: { select: { name: true } },
      country: { select: { registryCode: true } },
    },
  });

  // Per-config available counts.
  const availableCounts = await prisma.promoCode.groupBy({
    by: ['configId'],
    where: { status: 'AVAILABLE' },
    _count: { _all: true },
  });
  const availableMap = new Map(availableCounts.map((a) => [a.configId, a._count._all]));

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/promo" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Promo codes
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Allocate code</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Reserves the next available code in the chosen pool. Customer compensation pools email the
        code automatically; service recovery is internal.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <AllocateForm
            configs={configs.map((c) => ({
              id: c.id,
              label: `${c.brand.name} · ${c.country.registryCode} · ${c.type === 'CUSTOMER_COMPENSATION' ? 'Customer' : 'Service recovery'} · ${c.value} ${c.currency}`,
              available: availableMap.get(c.id) ?? 0,
              type: c.type,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
