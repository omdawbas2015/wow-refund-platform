import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toggleBrandActiveAction } from '@/app/actions/admin-extras';

export default async function BrandsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const brands = await prisma.brand.findMany({
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    include: {
      _count: { select: { cases: true, countries: true } },
      countries: { include: { country: { include: { registry: true } } } },
    },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Brands</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Brands are linked to countries; only brands active in a country appear in the case-creation form there.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{brands.length} brand{brands.length === 1 ? '' : 's'}</CardTitle>
          <CardDescription>Manage brands and their country activation.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Brand</th>
                <th className="p-3">Slug</th>
                <th className="p-3">Active in</th>
                <th className="p-3">Cases</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {brands.map((b) => (
                <tr key={b.id}>
                  <td className="p-3 font-medium">
                    {b.name}
                    {b.nameAr ? <span className="ms-2 text-xs text-muted-foreground">{b.nameAr}</span> : null}
                  </td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{b.slug}</td>
                  <td className="p-3">
                    {b.countries.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <span className="text-xs">
                        {b.countries
                          .filter((c) => c.isActive)
                          .map((c) => c.country.registry.code)
                          .join(', ') || <span className="text-muted-foreground">none</span>}
                      </span>
                    )}
                  </td>
                  <td className="p-3">{b._count.cases}</td>
                  <td className="p-3">
                    <Badge variant={b.isActive ? 'success' : 'secondary'}>
                      {b.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <form action={toggleBrandActiveAction}>
                      <input type="hidden" name="brandId" value={b.id} />
                      <input type="hidden" name="activate" value={b.isActive ? 'false' : 'true'} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface-subtle"
                      >
                        {b.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
