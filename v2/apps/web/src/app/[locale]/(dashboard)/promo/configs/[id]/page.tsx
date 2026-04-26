import { redirect, notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';
import { ConfigActions } from './actions';

interface PageProps {
  params: Promise<{ id: string; locale: string }>;
}

export default async function PromoConfigDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') redirect('/promo');

  const { id, locale } = await params;
  const config = await prisma.promoConfig.findUnique({
    where: { id },
    include: {
      brand: { select: { name: true, slug: true } },
      country: { select: { registryCode: true, registry: { select: { nameEn: true } } } },
    },
  });
  if (!config) notFound();

  const [statusCounts, recent] = await Promise.all([
    prisma.promoCode.groupBy({
      by: ['status'],
      where: { configId: id },
      _count: { _all: true },
    }),
    prisma.promoCode.findMany({
      where: { configId: id },
      orderBy: { uploadedAt: 'desc' },
      take: 100,
      include: {
        allocations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { customerEmail: true, createdAt: true, emailedAt: true, caseId: true },
        },
      },
    }),
  ]);

  const counts = new Map(statusCounts.map((s) => [s.status, s._count._all]));
  const totalCodes = [...counts.values()].reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/promo" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Promo codes
      </Link>
      <div className="mt-2 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">
            {config.brand.name} · {config.country.registryCode}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.type === 'CUSTOMER_COMPENSATION' ? 'Customer compensation' : 'Service recovery'}
            {' · '}
            {config.value} {config.currency}
            {config.label ? ` · ${config.label}` : ''}
          </p>
        </div>
        <Badge variant={config.isActive ? 'success' : 'secondary'}>
          {config.isActive ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="my-6 grid gap-4 sm:grid-cols-4">
        <Stat label="Total" value={totalCodes} />
        <Stat label="Available" value={counts.get('AVAILABLE') ?? 0} />
        <Stat label="Allocated" value={counts.get('ALLOCATED') ?? 0} />
        <Stat label="Used" value={counts.get('USED') ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfigActions configId={config.id} isActive={config.isActive} locale={locale} />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Recent codes (latest 100)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {recent.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              No codes uploaded yet. Use the &ldquo;Upload codes&rdquo; action above.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Code</th>
                  <th>Status</th>
                  <th>Uploaded</th>
                  <th>Last allocated</th>
                  <th>Customer</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((c) => {
                  const allocation = c.allocations[0];
                  return (
                    <tr key={c.id} className="hover:bg-surface-subtle">
                      <td className="px-4 py-2 font-mono text-xs">{c.code}</td>
                      <td className="px-4 py-2">
                        <Badge
                          variant={
                            c.status === 'AVAILABLE'
                              ? 'success'
                              : c.status === 'USED'
                                ? 'secondary'
                                : c.status === 'EXPIRED' || c.status === 'DISABLED'
                                  ? 'destructive'
                                  : 'default'
                          }
                        >
                          {c.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs tabular">
                        {formatDateTime(c.uploadedAt, 'en-US')}
                      </td>
                      <td className="px-4 py-2 text-xs tabular">
                        {allocation ? formatDateTime(allocation.createdAt, 'en-US') : '—'}
                      </td>
                      <td className="px-4 py-2 text-xs">{allocation?.customerEmail ?? '—'}</td>
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
