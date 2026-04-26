import { notFound } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { caseStatusLabel, caseStatusVariant } from '@/lib/cases/case-status-display';
import { SlaPill } from '@/components/cases/sla-pill';

/**
 * Customer journey view. The route param is the URL-encoded email — emails
 * are the closest thing the schema has to a stable customer identifier (we
 * don't model a Customer table; cases store contact fields directly).
 *
 * Aggregates everything we know about that email across cases so an agent
 * who picks up a follow-up call can see the full history without manually
 * searching the cases list.
 */
export default async function CustomerPage({
  params,
}: {
  params: Promise<{ email: string; locale: string }>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const me = session.user;
  const localeFmt = me.preferredLocale === 'ar' ? 'ar-KW' : 'en-US';

  const { email: rawEmail } = await params;
  const email = decodeURIComponent(rawEmail).trim().toLowerCase();
  if (!email || !email.includes('@')) notFound();

  const cases = await prisma.refundCase.findMany({
    where: {
      deletedAt: null,
      customerEmail: { equals: email },
    },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      caseNumber: true,
      status: true,
      orderNumber: true,
      orderDate: true,
      orderAmount: true,
      orderCurrency: true,
      totalRefundAmount: true,
      customerName: true,
      customerPhone: true,
      createdAt: true,
      country: { select: { registryCode: true, registry: { select: { nameEn: true } } } },
      brand: { select: { name: true } },
      _count: { select: { components: true, notes: true } },
    },
  });

  if (cases.length === 0) notFound();

  // Aggregate snapshot at the top.
  const inFlight = cases.filter(
    (c) => c.status !== 'REFUNDED' && c.status !== 'REJECTED' && c.status !== 'CANCELLED',
  ).length;
  const latest = cases[0];
  // Names + phones can drift across cases; show the most-recent and flag
  // earlier variants so an agent notices conflicting contact info.
  const nameVariants = Array.from(new Set(cases.map((c) => c.customerName))).slice(0, 5);
  const phoneVariants = Array.from(
    new Set(cases.map((c) => c.customerPhone).filter((p): p is string => !!p)),
  ).slice(0, 5);
  // Per-currency refund totals. Summing across currencies into a single
  // figure would produce a nonsensical number — e.g. a 50 KWD + 100 AED
  // refund would render as "150 KWD" if we picked the dominant currency
  // and just summed everything. Instead we sum REFUNDED case amounts per
  // currency and render each line on the stat card.
  const refundedByCurrency = new Map<string, number>();
  for (const c of cases) {
    if (c.status !== 'REFUNDED') continue;
    refundedByCurrency.set(
      c.orderCurrency,
      (refundedByCurrency.get(c.orderCurrency) ?? 0) + c.totalRefundAmount,
    );
  }
  const refundedLines = Array.from(refundedByCurrency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([currency, amount]) => formatCurrency(amount, currency, localeFmt, 2));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <div className="text-xs uppercase text-muted-foreground">Customer journey</div>
        <h1 className="text-display-md font-normal tracking-tight text-heading break-all">
          {latest!.customerName}
        </h1>
        <p className="mt-1 text-body break-all">{email}</p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total cases" value={String(cases.length)} />
        <StatCard label="In flight" value={String(inFlight)} tint={inFlight > 0 ? 'text-warning' : undefined} />
        <StatCard
          label="Refunded to date"
          value={refundedLines.length === 0 ? '—' : refundedLines[0]!}
          extra={refundedLines.length > 1 ? refundedLines.slice(1) : undefined}
        />
        <StatCard
          label="Latest case"
          value={formatDateTime(latest!.createdAt, localeFmt)}
        />
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact</CardTitle>
            <CardDescription>Most recent on top — earlier variants flagged.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-xs text-muted-foreground">Names on file</div>
              <ul className="space-y-0.5">
                {nameVariants.map((n, i) => (
                  <li key={n} className={i === 0 ? 'font-medium' : 'text-muted-foreground'}>
                    {n}
                    {i === 0 ? null : <span className="ms-1 text-[10px] uppercase">earlier</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Phones</div>
              {phoneVariants.length === 0 ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <ul className="space-y-0.5">
                  {phoneVariants.map((p) => (
                    <li key={p} className="tabular">{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>New refund for this customer</CardTitle>
            <CardDescription>Pre-fills the contact section from the latest case.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/cases/new?email=${encodeURIComponent(email)}`}
              className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Start new case →
            </Link>
            <p className="mt-3 text-xs text-muted-foreground">
              The customer-lookup field on the new-case form already detects this email.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>All cases</CardTitle>
            <Link
              href={`/cases?q=${encodeURIComponent(email)}`}
              className="text-xs uppercase tracking-wide text-muted-foreground hover:text-primary"
            >
              View in cases list →
            </Link>
          </div>
          <CardDescription>{cases.length} case{cases.length === 1 ? '' : 's'} ordered most recent first</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Case</th>
                <th className="p-3">Country / Brand</th>
                <th className="p-3">Order</th>
                <th className="p-3">Refund</th>
                <th className="p-3">Status</th>
                <th className="p-3">Age</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-surface-subtle/40">
                  <td className="p-3">
                    <Link href={`/cases/${c.id}`} className="font-medium text-primary hover:underline">
                      {c.caseNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {formatDateTime(c.createdAt, localeFmt)}
                    </div>
                  </td>
                  <td className="p-3">
                    <div>{c.country.registry.nameEn}</div>
                    <div className="text-xs text-muted-foreground">{c.brand.name}</div>
                  </td>
                  <td className="p-3 tabular">
                    <div>{c.orderNumber}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(c.orderAmount, c.orderCurrency, localeFmt, 2)}
                    </div>
                  </td>
                  <td className="p-3 tabular">
                    {formatCurrency(c.totalRefundAmount, c.orderCurrency, localeFmt, 2)}
                    <div className="text-xs text-muted-foreground">
                      {c._count.components} component{c._count.components === 1 ? '' : 's'}
                    </div>
                  </td>
                  <td className="p-3">
                    <Badge variant={caseStatusVariant(c.status)}>{caseStatusLabel(c.status)}</Badge>
                  </td>
                  <td className="p-3">
                    <SlaPill status={c.status} createdAt={c.createdAt} />
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

function StatCard({
  label,
  value,
  tint,
  extra,
}: {
  label: string;
  value: string;
  tint?: string;
  extra?: string[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-body">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-display-md font-light tabular ${tint ?? ''}`}>{value}</div>
        {extra && extra.length > 0 ? (
          <div className="mt-1 space-y-0.5 text-xs text-muted-foreground tabular">
            {extra.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
