import Link from 'next/link';
import { prisma } from '@wow/db';
import { caseListFiltersSchema } from '@wow/validators';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Plus, FileText, Search } from 'lucide-react';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
import { formatDate, formatMoney } from '@/lib/format';
import { CaseFiltersBar } from './case-filters-bar';

export const dynamic = 'force-dynamic';

export default async function CasesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const sp = await searchParams;

  const parsedFilters = caseListFiltersSchema.safeParse({
    q: sp['q'],
    countryId: sp['countryId'],
    brandId: sp['brandId'],
    status: sp['status'],
    assignedToId: sp['assignedToId'],
    fromDate: sp['fromDate'],
    toDate: sp['toDate'],
    page: sp['page'] ?? '1',
    pageSize: sp['pageSize'] ?? '25',
  });
  const filters = parsedFilters.success
    ? parsedFilters.data
    : { page: 1, pageSize: 25 };

  const where: Record<string, unknown> = { deletedAt: null };
  if (filters.q) {
    where['OR'] = [
      { caseNumber: { contains: filters.q } },
      { customerName: { contains: filters.q } },
      { customerEmail: { contains: filters.q } },
      { orderNumber: { contains: filters.q } },
    ];
  }
  if (filters.countryId) where['countryId'] = filters.countryId;
  if (filters.brandId) where['brandId'] = filters.brandId;
  if (filters.status) where['status'] = filters.status;
  if (filters.assignedToId) where['assignedToId'] = filters.assignedToId;
  if (filters.fromDate || filters.toDate) {
    const createdAt: Record<string, Date> = {};
    if (filters.fromDate) createdAt['gte'] = filters.fromDate;
    if (filters.toDate) createdAt['lte'] = filters.toDate;
    where['createdAt'] = createdAt;
  }

  const [countries, brands, total, cases] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.refundCase.count({ where }),
    prisma.refundCase.findMany({
      where,
      include: {
        country: { include: { registry: true } },
        brand: true,
        createdBy: { select: { name: true } },
        assignedTo: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / filters.pageSize));

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Refund Cases</h1>
          <p className="mt-2 text-body">Create, track, and manage customer refund cases.</p>
        </div>
        <Button asChild>
          <Link href={`/${locale}/cases/new`}>
            <Plus className="h-4 w-4" />
            New case
          </Link>
        </Button>
      </div>

      <CaseFiltersBar
        countries={countries.map((c) => ({
          id: c.id,
          code: c.registry.code,
          name: c.registry.nameEn,
          flag: c.registry.flag ?? '',
        }))}
        brands={brands.map((b) => ({ id: b.id, name: b.name }))}
      />

      {cases.length === 0 ? (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-subtle">
                <FileText className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-heading-sm text-heading">No cases found</h3>
              <p className="max-w-md text-sm text-muted-foreground">
                Try adjusting your filters, or create a new refund case to get started.
              </p>
              <Button asChild className="mt-2">
                <Link href={`/${locale}/cases/new`}>
                  <Plus className="h-4 w-4" />
                  New case
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-subtle text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-start font-medium">Case #</th>
                    <th className="px-4 py-3 text-start font-medium">Customer</th>
                    <th className="px-4 py-3 text-start font-medium">Brand · Country</th>
                    <th className="px-4 py-3 text-start font-medium">Order</th>
                    <th className="px-4 py-3 text-end font-medium">Refund</th>
                    <th className="px-4 py-3 text-start font-medium">Status</th>
                    <th className="px-4 py-3 text-start font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cases.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-surface-subtle/50 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/${locale}/cases/${c.id}`}
                          className="font-mono text-sm font-medium text-primary hover:underline"
                        >
                          {c.caseNumber}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.customerName}</div>
                        <div className="text-xs text-muted-foreground">{c.customerEmail}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-lg leading-none">{c.country.registry.flag ?? '🌐'}</span>
                          <div>
                            <div className="text-sm font-medium">{c.brand.name}</div>
                            <div className="text-xs text-muted-foreground">{c.country.registry.nameEn}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-mono text-xs">{c.orderNumber}</div>
                        <div className="text-xs text-muted-foreground">{formatDate(c.orderDate)}</div>
                      </td>
                      <td className="px-4 py-3 text-end font-mono">
                        {formatMoney(c.totalRefundAmount, c.orderCurrency)}
                        {c.isPartial && (
                          <div className="text-xs font-normal text-muted-foreground">
                            of {formatMoney(c.orderAmount, c.orderCurrency)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <CaseStatusBadge status={c.status} />
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {formatDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <div className="text-xs text-muted-foreground">
                  Page {filters.page} of {totalPages} · {total} cases
                </div>
                <div className="flex gap-2">
                  {filters.page > 1 && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={{
                          pathname: `/${locale}/cases`,
                          query: { ...sp, page: filters.page - 1 },
                        }}
                      >
                        Previous
                      </Link>
                    </Button>
                  )}
                  {filters.page < totalPages && (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={{
                          pathname: `/${locale}/cases`,
                          query: { ...sp, page: filters.page + 1 },
                        }}
                      >
                        Next
                      </Link>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
