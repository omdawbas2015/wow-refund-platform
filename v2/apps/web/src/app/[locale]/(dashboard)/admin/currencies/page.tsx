import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

/**
 * ISO 4217 currency directory. The registry is seeded once and has ~170
 * entries — admins can see which currencies are wired into the workspace
 * (i.e. used by an active country) and how many open cases reference them.
 */
export default async function CurrenciesAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const sp = await searchParams;
  const q = (typeof sp['q'] === 'string' ? sp['q'] : '').trim();
  const filter =
    typeof sp['filter'] === 'string' && ['all', 'in-use'].includes(sp['filter'])
      ? sp['filter']
      : 'all';

  const isPg = (process.env['DATABASE_URL'] ?? '').startsWith('postgres');
  const ciContains = (value: string) =>
    isPg ? { contains: value, mode: 'insensitive' as const } : { contains: value };

  const where = q
    ? {
        OR: [
          { code: ciContains(q) },
          { name: ciContains(q) },
          { nameAr: ciContains(q) },
          { symbol: { contains: q } },
        ],
      }
    : {};

  const [currencies, activeCountries, casesByCurrency] = await Promise.all([
    prisma.currencyRegistry.findMany({
      where,
      orderBy: { code: 'asc' },
      include: {
        _count: { select: { countries: true, casesOrigin: true } },
      },
    }),
    prisma.countryRegistry.findMany({
      where: { countries: { some: { isActive: true } } },
      select: { code: true, currencyCode: true },
    }),
    prisma.refundCase.groupBy({
      by: ['orderCurrency'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const inUse = new Set(activeCountries.map((c) => c.currencyCode));
  const caseCount = new Map(
    casesByCurrency.map((c) => [c.orderCurrency, c._count._all] as const),
  );

  const rows = currencies
    .map((c) => ({
      code: c.code,
      name: c.name,
      nameAr: c.nameAr,
      symbol: c.symbol,
      decimals: c.decimals,
      countriesUsing: c._count.countries,
      isActive: inUse.has(c.code),
      openCases: caseCount.get(c.code) ?? 0,
    }))
    .filter((r) => (filter === 'in-use' ? r.isActive : true));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Currencies</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ISO 4217 currency registry. Read-only directory — currencies become
          &quot;in use&quot; when a country is activated for them.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>
              {rows.filter((r) => r.isActive).length} in use · {rows.length} shown
            </CardTitle>
            <CardDescription>
              Total registry: {currencies.length} currencies.
            </CardDescription>
          </div>
          <form className="flex flex-wrap items-center gap-2" action="">
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Code, name, symbol…"
              className="h-9 w-full max-w-xs rounded-md border border-border bg-card px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-primary"
            />
            <div className="flex items-center gap-1 rounded-md border border-border bg-card p-0.5 text-xs">
              <FilterChip href={appendFilter(q, 'all')} active={filter === 'all'}>
                All
              </FilterChip>
              <FilterChip href={appendFilter(q, 'in-use')} active={filter === 'in-use'}>
                In use
              </FilterChip>
            </div>
            <button
              type="submit"
              className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium hover:bg-surface-subtle"
            >
              Apply
            </button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle/40 text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Code</th>
                <th className="px-3 py-2.5">Name</th>
                <th className="px-3 py-2.5">Symbol</th>
                <th className="px-3 py-2.5">Decimals</th>
                <th className="px-3 py-2.5">Countries</th>
                <th className="px-3 py-2.5">Open cases</th>
                <th className="px-3 py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    No currencies match this filter.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.code}>
                    <td className="px-3 py-2 font-mono text-xs font-medium">{r.code}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-heading">{r.name}</div>
                      {r.nameAr ? (
                        <div className="text-xs text-muted-foreground">{r.nameAr}</div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{r.symbol}</td>
                    <td className="px-3 py-2 tabular-nums">{r.decimals}</td>
                    <td className="px-3 py-2 tabular-nums">{r.countriesUsing}</td>
                    <td className="px-3 py-2 tabular-nums">{r.openCases}</td>
                    <td className="px-3 py-2">
                      {r.isActive ? (
                        <Badge variant="success" className="text-[10px]">
                          In use
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[10px]">
                          Inactive
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function appendFilter(q: string, filter: 'all' | 'in-use') {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  params.set('filter', filter);
  return `?${params.toString()}`;
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={`rounded-sm px-2 py-1 transition-colors ${
        active
          ? 'bg-primary/10 font-medium text-primary'
          : 'text-muted-foreground hover:text-heading'
      }`}
    >
      {children}
    </a>
  );
}
