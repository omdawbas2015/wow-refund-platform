import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { BrandsEditor } from './editor';

export default async function BrandsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const brands = await prisma.brand.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Brands</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Brand catalog used across cases and reports. Add new brands here; per-country mapping
        is managed in the country page later.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Brand catalog</CardTitle>
        </CardHeader>
        <CardContent>
          <BrandsEditor
            brands={brands.map((b) => ({
              id: b.id,
              name: b.name,
              nameAr: b.nameAr,
              slug: b.slug,
              logoUrl: b.logoUrl,
              isActive: b.isActive,
              sortOrder: b.sortOrder,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
