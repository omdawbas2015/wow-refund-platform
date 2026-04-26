import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { parseRange } from '@/lib/reports/range';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function CountryReportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD') redirect('/');

  const sp = await searchParams;
  const range = parseRange({ from: sp.from, to: sp.to });

  const countries = await prisma.country.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: 'asc' }, { registryCode: 'asc' }],
    include: { registry: { select: { nameEn: true } } },
  });

  const rows = await Promise.all(
    countries.map(async (c) => {
      const [created, refunded] = await Promise.all([
        prisma.refundCase.count({
          where: {
            countryId: c.id,
            createdAt: { gte: range.from, lte: range.to },
            deletedAt: null,
          },
        }),
        prisma.refundComponent.aggregate({
          where: {
            status: 'REFUNDED',
            refundedAt: { gte: range.from, lte: range.to },
            case: { countryId: c.id, deletedAt: null },
          },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);
      return {
        code: c.registryCode,
        name: c.registry.nameEn,
        created,
        refundedCount: refunded._count._all,
        refundedAmount: refunded._sum.amount ?? 0,
      };
    }),
  );

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href={`/reports?from=${range.fromIso}&to=${range.toIso}`}
        className="text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Reports
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">By country</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Volume and refunded total per country between {range.fromIso} and {range.toIso}.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Markets</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-6 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>Code</th>
                <th>Name</th>
                <th className="text-end">Created</th>
                <th className="text-end">Refunded count</th>
                <th className="text-end">Refunded amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.code}>
                  <td className="px-6 py-3 font-medium tabular">{r.code}</td>
                  <td className="px-6 py-3">{r.name}</td>
                  <td className="px-6 py-3 text-end tabular">{r.created}</td>
                  <td className="px-6 py-3 text-end tabular">{r.refundedCount}</td>
                  <td className="px-6 py-3 text-end tabular">{r.refundedAmount.toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
