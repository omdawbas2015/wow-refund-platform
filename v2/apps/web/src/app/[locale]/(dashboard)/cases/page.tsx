import { prisma } from '@wow/db';
import type { CaseStatus } from '@wow/db';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import { Plus, FileText, Search } from 'lucide-react';
import { auth } from '@/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { caseStatusVariant, caseStatusLabel } from '@/lib/cases/case-status-display';

const STATUS_TABS: Array<{ key: 'ALL' | CaseStatus; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'IN_EXECUTION', label: 'In execution' },
  { key: 'PARTIALLY_REFUNDED', label: 'Partial' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: 'REJECTED', label: 'Rejected' },
];

const PAGE_SIZE = 25;

interface SearchParams {
  q?: string;
  status?: string;
  page?: string;
}

export default async function CasesPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const session = await auth();
  const locale = session?.user?.preferredLocale ?? 'en';
  const localePrefix = locale === 'ar' ? 'ar-KW' : 'en-US';

  const q = (sp.q ?? '').trim();
  const statusParam = (sp.status ?? '').toUpperCase();
  const status = STATUS_TABS.find((t) => t.key === statusParam)?.key ?? 'ALL';
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  const where = {
    deletedAt: null,
    ...(status !== 'ALL' ? { status: status as CaseStatus } : {}),
    ...(q
      ? {
          OR: [
            { caseNumber: { contains: q } },
            { orderNumber: { contains: q } },
            { customerEmail: { contains: q } },
            { customerName: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.refundCase.count({ where }),
    prisma.refundCase.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        caseNumber: true,
        status: true,
        orderNumber: true,
        orderCurrency: true,
        totalRefundAmount: true,
        customerName: true,
        customerEmail: true,
        createdAt: true,
        country: { select: { registryCode: true } },
        brand: { select: { name: true } },
        _count: { select: { components: true } },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function pageUrl(p: number) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status !== 'ALL') params.set('status', status);
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/cases${qs ? `?${qs}` : ''}`;
  }

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Refund Cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, track, and manage customer refund cases.
          </p>
        </div>
        <Button asChild>
          <Link href="/cases/new">
            <Plus className="h-4 w-4" />
            New case
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3">
        <form className="flex flex-wrap items-center gap-3" action="/cases" method="get">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search by case number, order, customer…"
              className="ps-9"
            />
          </div>
          {status !== 'ALL' ? <input type="hidden" name="status" value={status} /> : null}
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </Card>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (tab.key !== 'ALL') params.set('status', tab.key);
          const href = `/cases${params.toString() ? `?${params.toString()}` : ''}`;
          const active = tab.key === status;
          return (
            <Link
              key={tab.key}
              href={href}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-surface text-body hover:bg-surface-subtle'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Table */}
      <Card className="overflow-hidden p-0">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle">
              <FileText className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No cases match your filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-muted-foreground">
                <tr className="text-start [&>th]:px-4 [&>th]:py-2.5 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                  <th>Case</th>
                  <th>Country</th>
                  <th>Brand</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="text-end">Amount</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-subtle/50">
                    <td className="px-4 py-2.5">
                      <Link href={`/cases/${r.id}`} className="font-medium text-primary hover:underline">
                        {r.caseNumber}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {r._count.components} component{r._count.components === 1 ? '' : 's'}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs uppercase tabular">{r.country.registryCode}</td>
                    <td className="px-4 py-2.5">{r.brand.name}</td>
                    <td className="px-4 py-2.5 tabular">{r.orderNumber}</td>
                    <td className="px-4 py-2.5">
                      <div>{r.customerName}</div>
                      <div className="truncate text-xs text-muted-foreground">{r.customerEmail}</div>
                    </td>
                    <td className="px-4 py-2.5 text-end tabular">
                      {formatCurrency(r.totalRefundAmount, r.orderCurrency, localePrefix, 2)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={caseStatusVariant(r.status)}>{caseStatusLabel(r.status)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground tabular">
                      {formatDate(r.createdAt, localePrefix)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
          <div>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </div>
          <div className="flex gap-1">
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={page <= 1}
            >
              <Link href={pageUrl(Math.max(1, page - 1))}>Previous</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              disabled={page >= totalPages}
            >
              <Link href={pageUrl(Math.min(totalPages, page + 1))}>Next</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
