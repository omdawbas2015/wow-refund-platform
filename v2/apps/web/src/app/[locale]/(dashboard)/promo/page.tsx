import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default async function PromoHubPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') redirect('/');

  const configs = await prisma.promoConfig.findMany({
    orderBy: [{ isActive: 'desc' }, { type: 'asc' }, { createdAt: 'desc' }],
    include: {
      brand: { select: { name: true } },
      country: { select: { registryCode: true } },
      _count: { select: { codes: true } },
    },
  });

  // Per-config status counts via groupBy.
  const statusCounts = await prisma.promoCode.groupBy({
    by: ['configId', 'status'],
    _count: { _all: true },
  });
  const countMap = new Map<string, Map<string, number>>();
  for (const sc of statusCounts) {
    const m = countMap.get(sc.configId) ?? new Map<string, number>();
    m.set(sc.status, sc._count._all);
    countMap.set(sc.configId, m);
  }

  const totalCodes = configs.reduce((s, c) => s + c._count.codes, 0);
  const totalAvailable = [...countMap.values()].reduce(
    (s, m) => s + (m.get('AVAILABLE') ?? 0),
    0,
  );
  const totalAllocated = [...countMap.values()].reduce(
    (s, m) => s + (m.get('ALLOCATED') ?? 0),
    0,
  );

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Promo codes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Customer compensation and service-recovery code pools, scoped per brand × country.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/promo/configs/new">
            <Button>New config</Button>
          </Link>
          <Link href="/promo/allocate">
            <Button variant="outline">Allocate code</Button>
          </Link>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Pools" value={configs.length} />
        <Stat label="Codes uploaded" value={totalCodes} />
        <Stat label="Available / Allocated" value={`${totalAvailable} / ${totalAllocated}`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurations</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {configs.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              No promo configs yet. Create one to start uploading codes.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Status</th>
                  <th>Type</th>
                  <th>Brand</th>
                  <th>Country</th>
                  <th className="text-end">Value</th>
                  <th className="text-end">Available</th>
                  <th className="text-end">Allocated</th>
                  <th className="text-end">Used</th>
                  <th></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {configs.map((c) => {
                  const m = countMap.get(c.id) ?? new Map<string, number>();
                  return (
                    <tr key={c.id} className="hover:bg-surface-subtle">
                      <td className="px-4 py-2">
                        <Badge variant={c.isActive ? 'success' : 'secondary'}>
                          {c.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {c.type === 'CUSTOMER_COMPENSATION' ? 'Customer' : 'Service recovery'}
                      </td>
                      <td className="px-4 py-2 font-medium">{c.brand.name}</td>
                      <td className="px-4 py-2 tabular">{c.country.registryCode}</td>
                      <td className="px-4 py-2 text-end tabular">
                        {c.value} {c.currency}
                      </td>
                      <td className="px-4 py-2 text-end tabular">{m.get('AVAILABLE') ?? 0}</td>
                      <td className="px-4 py-2 text-end tabular">{m.get('ALLOCATED') ?? 0}</td>
                      <td className="px-4 py-2 text-end tabular">{m.get('USED') ?? 0}</td>
                      <td className="px-4 py-2">
                        <Link
                          href={`/promo/configs/${c.id}`}
                          className="text-xs uppercase text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
