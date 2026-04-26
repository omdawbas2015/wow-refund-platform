import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { parseRange } from '@/lib/reports/range';

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function RefundsReportPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  const role = session.user.role;
  if (role !== 'ADMIN' && role !== 'OPS_LEAD' && role !== 'FINANCE_LEAD') redirect('/');

  const sp = await searchParams;
  const range = parseRange({ from: sp.from, to: sp.to });

  const refunded = await prisma.refundComponent.findMany({
    where: {
      status: 'REFUNDED',
      refundedAt: { gte: range.from, lte: range.to },
    },
    select: {
      amount: true,
      currency: true,
      refundedAt: true,
      paymentMethod: { select: { label: true } },
      case: {
        select: {
          country: { select: { registryCode: true } },
        },
      },
    },
  });

  // Aggregate by payment method.
  const byMethod = new Map<string, { count: number; amount: number; currency: string }>();
  for (const r of refunded) {
    const key = r.paymentMethod.label;
    const acc = byMethod.get(key) ?? { count: 0, amount: 0, currency: r.currency };
    acc.count += 1;
    acc.amount += r.amount;
    byMethod.set(key, acc);
  }
  const methodRows = [...byMethod.entries()]
    .map(([method, agg]) => ({ method, ...agg }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <Link
        href={`/reports?from=${range.fromIso}&to=${range.toIso}`}
        className="text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Reports
      </Link>
      <div className="mt-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">
            Refunded amount by payment method
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Refunds completed between {range.fromIso} and {range.toIso}.
          </p>
        </div>
        <a
          href={`/api/export/refunds?from=${range.fromIso}&to=${range.toIso}`}
          download
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium hover:bg-surface-subtle"
        >
          Export .xlsx
        </a>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>{refunded.length} refunds</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {methodRows.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              No refunds in this range yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="[&>th]:px-6 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Method</th>
                  <th className="text-end">Count</th>
                  <th className="text-end">Total</th>
                  <th>Currency</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {methodRows.map((r) => (
                  <tr key={r.method}>
                    <td className="px-6 py-3 font-medium">{r.method}</td>
                    <td className="px-6 py-3 text-end tabular">{r.count}</td>
                    <td className="px-6 py-3 text-end tabular">{r.amount.toFixed(3)}</td>
                    <td className="px-6 py-3 tabular">{r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
