import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { NewConfigForm } from './form';

export default async function NewPromoConfigPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') redirect('/promo');

  const [brands, countries] = await Promise.all([
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, registryCode: true, registry: { select: { nameEn: true } } },
    }),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <Link href="/promo" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Promo codes
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">New promo config</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each brand × country × type × value combination must be unique.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <NewConfigForm
            brands={brands}
            countries={countries.map((c) => ({
              id: c.id,
              code: c.registryCode,
              name: c.registry.nameEn,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
