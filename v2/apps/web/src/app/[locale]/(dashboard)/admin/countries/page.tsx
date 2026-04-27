import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toggleCountryActiveAction } from '@/app/actions/admin-extras';

export default async function CountriesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const registry = await prisma.countryRegistry.findMany({
    orderBy: { code: 'asc' },
    include: {
      countries: { include: { _count: { select: { cases: true } } } },
    },
  });

  const rows = registry.map((r) => {
    const active = r.countries[0];
    return {
      code: r.code,
      name: r.nameEn,
      nameAr: r.nameAr,
      currency: r.currencyCode,
      flag: r.flag,
      isActive: active?.isActive ?? false,
      managerEmail: active?.managerEmail ?? null,
      cutoffTime: active?.cutoffTime ?? null,
      caseCount: active?._count.cases ?? 0,
      countryId: active?.id ?? null,
    };
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Countries</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Activate the countries your business operates in. Active countries appear in case-creation forms and reports.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{rows.filter((r) => r.isActive).length} active · {rows.length} total</CardTitle>
          <CardDescription>Toggle a country to activate it for the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Code</th>
                <th className="p-3">Name</th>
                <th className="p-3">Currency</th>
                <th className="p-3">Manager email</th>
                <th className="p-3">Cutoff</th>
                <th className="p-3">Cases</th>
                <th className="p-3">Status</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.code}>
                  <td className="p-3 font-mono text-xs">
                    <span className="me-1">{r.flag}</span>{r.code}
                  </td>
                  <td className="p-3 font-medium">
                    {r.name}
                    {r.nameAr ? <span className="ms-2 text-xs text-muted-foreground">{r.nameAr}</span> : null}
                  </td>
                  <td className="p-3">{r.currency}</td>
                  <td className="p-3 text-muted-foreground">{r.managerEmail ?? '—'}</td>
                  <td className="p-3 text-muted-foreground">{r.cutoffTime ?? '—'}</td>
                  <td className="p-3">{r.caseCount}</td>
                  <td className="p-3">
                    <Badge variant={r.isActive ? 'success' : 'secondary'}>{r.isActive ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="p-3">
                    <form action={toggleCountryActiveAction}>
                      <input type="hidden" name="registryCode" value={r.code} />
                      <input type="hidden" name="activate" value={r.isActive ? 'false' : 'true'} />
                      <button
                        type="submit"
                        className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-surface-subtle"
                      >
                        {r.isActive ? 'Deactivate' : 'Activate'}
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
