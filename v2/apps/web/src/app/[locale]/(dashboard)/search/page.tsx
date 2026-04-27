import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { caseStatusLabel, caseStatusVariant } from '@/lib/cases/case-status-display';

interface SearchParams {
  q?: string;
}

const RESULT_LIMIT = 20;

/**
 * Global search across the most useful operational entities. The query is
 * a `contains` match (SQLite is case-insensitive for ASCII by default).
 *
 * Per-section limit keeps the page responsive: each section returns at
 * most `RESULT_LIMIT` rows. If the user wants more, deep-links into the
 * dedicated list pages are provided.
 *
 * Permissions: any signed-in user can search; the dedicated detail pages
 * still enforce their own ACLs when followed.
 */
export default async function GlobalSearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) return null;
  const me = session.user;
  const localeFmt = me.preferredLocale === 'ar' ? 'ar-KW' : 'en-US';

  const sp = await searchParams;
  const q = (sp.q ?? '').trim();

  if (!q) return <EmptyState />;
  // SQLite has no trigram index — short queries would scan the whole table.
  if (q.length < 2) {
    return (
      <Wrapper q={q}>
        <p className="text-sm text-muted-foreground">
          Type at least 2 characters to search.
        </p>
      </Wrapper>
    );
  }

  const [cases, customers, batches, knet, aura, users] = await Promise.all([
    prisma.refundCase.findMany({
      where: {
        deletedAt: null,
        OR: [
          { caseNumber: { contains: q } },
          { orderNumber: { contains: q } },
          { customerEmail: { contains: q } },
          { customerName: { contains: q } },
          { customerPhone: { contains: q } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: RESULT_LIMIT,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        customerName: true,
        customerEmail: true,
        orderNumber: true,
        totalRefundAmount: true,
        orderCurrency: true,
        createdAt: true,
        country: { select: { registryCode: true } },
        brand: { select: { name: true } },
      },
    }),
    // Customer aggregate: distinct email + count via groupBy.
    prisma.refundCase.groupBy({
      by: ['customerEmail'],
      where: {
        deletedAt: null,
        OR: [
          { customerEmail: { contains: q } },
          { customerName: { contains: q } },
          { customerPhone: { contains: q } },
        ],
      },
      _count: { _all: true },
      orderBy: { _count: { customerEmail: 'desc' } },
      take: RESULT_LIMIT,
    }),
    prisma.approvalBatch.findMany({
      where: { batchNumber: { contains: q } },
      orderBy: { createdAt: 'desc' },
      take: RESULT_LIMIT,
      select: {
        id: true,
        batchNumber: true,
        status: true,
        createdAt: true,
        country: { select: { registryCode: true } },
        _count: { select: { cases: true } },
      },
    }),
    prisma.knetBatch.findMany({
      where: { batchNumber: { contains: q } },
      orderBy: { createdAt: 'desc' },
      take: RESULT_LIMIT,
      select: {
        id: true,
        batchNumber: true,
        status: true,
        createdAt: true,
        _count: { select: { components: true } },
      },
    }),
    prisma.auraBatch.findMany({
      where: { batchNumber: { contains: q } },
      orderBy: { createdAt: 'desc' },
      take: RESULT_LIMIT,
      select: { id: true, batchNumber: true, status: true, createdAt: true },
    }),
    me.role === 'ADMIN'
      ? prisma.user.findMany({
          where: {
            OR: [
              { email: { contains: q } },
              { name: { contains: q } },
              { phone: { contains: q } },
            ],
          },
          orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
          take: RESULT_LIMIT,
          select: {
            id: true,
            email: true,
            name: true,
            status: true,
            role: { select: { key: true } },
          },
        })
      : Promise.resolve([] as Array<never>),
  ]);

  const customerSamples = await prisma.refundCase.findMany({
    where: {
      deletedAt: null,
      customerEmail: { in: customers.map((c) => c.customerEmail) },
    },
    orderBy: { createdAt: 'desc' },
    distinct: ['customerEmail'],
    select: { customerEmail: true, customerName: true, customerPhone: true },
  });
  const customerNameByEmail = new Map(
    customerSamples.map((c) => [c.customerEmail, c]),
  );

  const totalHits =
    cases.length +
    customers.length +
    batches.length +
    knet.length +
    aura.length +
    users.length;

  return (
    <Wrapper q={q}>
      <p className="mb-4 text-xs uppercase tracking-wide text-muted-foreground">
        {totalHits} result{totalHits === 1 ? '' : 's'} (capped at {RESULT_LIMIT} per section)
      </p>

      {totalHits === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No matches for &ldquo;{q}&rdquo;.
          </CardContent>
        </Card>
      ) : null}

      {cases.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Cases ({cases.length})</CardTitle>
              <Link
                href={`/cases?q=${encodeURIComponent(q)}`}
                className="text-xs uppercase tracking-wide text-muted-foreground hover:text-primary"
              >
                See all in /cases →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Case</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Order</th>
                  <th className="p-3">Refund</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Created</th>
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
                        {c.country.registryCode} · {c.brand.name}
                      </div>
                    </td>
                    <td className="p-3">
                      <div>{c.customerName}</div>
                      <div className="text-xs text-muted-foreground break-all">{c.customerEmail}</div>
                    </td>
                    <td className="p-3 tabular">{c.orderNumber}</td>
                    <td className="p-3 tabular">
                      {formatCurrency(c.totalRefundAmount, c.orderCurrency, localeFmt, 2)}
                    </td>
                    <td className="p-3">
                      <Badge variant={caseStatusVariant(c.status)}>{caseStatusLabel(c.status)}</Badge>
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {formatDateTime(c.createdAt, localeFmt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ) : null}

      {customers.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Customers ({customers.length})</CardTitle>
            <CardDescription>Distinct emails matching the query.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border text-sm">
              {customers.map((c) => {
                const sample = customerNameByEmail.get(c.customerEmail);
                return (
                  <li key={c.customerEmail} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-subtle/40">
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/customers/${encodeURIComponent(c.customerEmail.toLowerCase())}`}
                        className="font-medium text-primary hover:underline break-all"
                      >
                        {c.customerEmail}
                      </Link>
                      {sample ? (
                        <div className="text-xs text-muted-foreground">
                          {sample.customerName}
                          {sample.customerPhone ? ` · ${sample.customerPhone}` : ''}
                        </div>
                      ) : null}
                    </div>
                    <span className="text-xs text-muted-foreground tabular">
                      {c._count._all} case{c._count._all === 1 ? '' : 's'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {(batches.length > 0 || knet.length > 0 || aura.length > 0) ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Batches</CardTitle>
            <CardDescription>Approval, KNET, and Aura batches matching the query.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border text-sm">
              {batches.map((b) => (
                <li key={`apb-${b.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-subtle/40">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/operations/approvals/${b.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {b.batchNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      Approval batch · {b.country.registryCode} · {b._count.cases} case{b._count.cases === 1 ? '' : 's'}
                    </div>
                  </div>
                  <Badge variant="outline">{b.status}</Badge>
                </li>
              ))}
              {knet.map((b) => (
                <li key={`knet-${b.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-subtle/40">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/operations/knet/${b.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {b.batchNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      KNET batch · {b._count.components} component{b._count.components === 1 ? '' : 's'}
                    </div>
                  </div>
                  <Badge variant="outline">{b.status}</Badge>
                </li>
              ))}
              {aura.map((b) => (
                <li key={`aura-${b.id}`} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-subtle/40">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/operations/aura/${b.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {b.batchNumber}
                    </Link>
                    <div className="text-xs text-muted-foreground">Aura batch</div>
                  </div>
                  <Badge variant="outline">{b.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {users.length > 0 ? (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Users ({users.length})</CardTitle>
            <CardDescription>Admin-only result section.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border text-sm">
              {users.map((u) => (
                <li key={u.id} className="flex items-center justify-between gap-3 p-3 hover:bg-surface-subtle/40">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/users?q=${encodeURIComponent(u.email)}`}
                      className="font-medium text-primary hover:underline break-all"
                    >
                      {u.email}
                    </Link>
                    <div className="text-xs text-muted-foreground">
                      {u.name} · {u.role?.key ?? 'no role'}
                    </div>
                  </div>
                  <Badge variant="outline">{u.status}</Badge>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </Wrapper>
  );
}

function Wrapper({ q, children }: { q: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <div className="text-xs uppercase text-muted-foreground">Search</div>
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          Results for &ldquo;{q}&rdquo;
        </h1>
      </div>

      <form className="mb-6 flex gap-2">
        <Input
          name="q"
          defaultValue={q}
          placeholder="Case number, order, customer email, batch…"
          className="max-w-md"
        />
        <Button type="submit">Search</Button>
      </form>

      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <div className="text-xs uppercase text-muted-foreground">Search</div>
        <h1 className="text-display-md font-normal tracking-tight text-heading">Global search</h1>
      </div>

      <form className="mb-6 flex gap-2">
        <Input
          name="q"
          placeholder="Case number, order, customer email, batch…"
          className="max-w-md"
          autoFocus
        />
        <Button type="submit">Search</Button>
      </form>

      <p className="text-sm text-muted-foreground">
        Searches cases, customers, batches (approval / KNET / Aura), and users (admin).
      </p>
    </div>
  );
}
