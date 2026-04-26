import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { CountriesEditor } from './editor';

export default async function CountriesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const countries = await prisma.country.findMany({
    orderBy: [{ sortOrder: 'asc' }, { registryCode: 'asc' }],
    include: { registry: { select: { nameEn: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Countries</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Each row maps to a row in the country registry. Toggle activation, set the country
        manager email (used for approval batches), and the local cutoff time.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Active markets</CardTitle>
        </CardHeader>
        <CardContent>
          <CountriesEditor
            countries={countries.map((c) => ({
              id: c.id,
              code: c.registryCode,
              name: c.registry.nameEn,
              isActive: c.isActive,
              managerEmail: c.managerEmail,
              cutoffTime: c.cutoffTime,
              sortOrder: c.sortOrder,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
