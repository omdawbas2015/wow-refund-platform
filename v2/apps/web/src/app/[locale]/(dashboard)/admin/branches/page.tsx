import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BranchesManager, type BranchRow, type CountryOption } from './manager';

export const dynamic = 'force-dynamic';

export default async function BranchesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [countries, branches] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { registry: true },
    }),
    prisma.branch.findMany({
      orderBy: [{ countryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        country: { include: { registry: true } },
        _count: { select: { cases: true } },
      },
    }),
  ]);

  const countryOptions: CountryOption[] = countries.map((c) => ({
    id: c.id,
    name: c.registry.nameEn,
    flag: c.registry.flag ?? '',
  }));

  const rows: BranchRow[] = branches.map((b) => ({
    id: b.id,
    name: b.name,
    nameAr: b.nameAr,
    code: b.code,
    address: b.address,
    phone: b.phone,
    email: b.email,
    isActive: b.isActive,
    sortOrder: b.sortOrder,
    countryId: b.countryId,
    countryName: b.country.registry.nameEn,
    countryFlag: b.country.registry.flag ?? '',
    caseCount: b._count.cases,
  }));

  const activeCount = rows.filter((r) => r.isActive).length;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-heading">Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Physical stores within each active country. Branches feed
            case-creation forms and store-communication templates.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {activeCount} active · {rows.length} total
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Branch directory</CardTitle>
          <CardDescription>
            Branches with at least one case cannot be deleted — deactivate them instead.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BranchesManager rows={rows} countries={countryOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
