import { prisma } from '@wow/db';
import type { CaseStatus, Prisma } from '@wow/db';
import { buildSlaConditions, parseSlaParam, type SlaTier } from '@/lib/cases/sla';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Link } from '@/i18n/routing';
import { Plus, FileText, Search, Download } from 'lucide-react';
import { auth } from '@/auth';
import { formatCurrency, formatDate } from '@/lib/utils';
import { caseStatusVariant, caseStatusLabel } from '@/lib/cases/case-status-display';
import { SlaPill } from '@/components/cases/sla-pill';
import { SavedViewsMenu } from '@/components/cases/saved-views-menu';
import { BulkActionsBar, BulkSelectAll, BulkRowCheckbox } from './bulk-actions';

const STATUS_TABS: Array<{ key: 'ALL' | CaseStatus; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'DRAFT', label: 'Draft' },
  { key: 'PENDING_APPROVAL', label: 'Pending' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'IN_EXECUTION', label: 'In execution' },
  { key: 'PARTIALLY_REFUNDED', label: 'Partial' },
  { key: 'REFUNDED', label: 'Refunded' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'CANCELLED', label: 'Cancelled' },
];

const PAGE_SIZE = 25;

interface SearchParams {
  q?: string;
  status?: string;
  sla?: string;
  page?: string;
  mine?: string;
}

const SLA_TABS: Array<{ key: 'all' | 'breached' | 'warning' | 'on_track' | 'closed'; label: string }> = [
  { key: 'all', label: 'Any SLA' },
  { key: 'breached', label: 'Breached' },
  { key: 'warning', label: 'At risk' },
  { key: 'on_track', label: 'On track' },
  { key: 'closed', label: 'Closed' },
];

export default async function CasesPage(props: { searchParams: Promise<SearchParams> }) {
  const sp = await props.searchParams;
  const session = await auth();
  const locale = session?.user?.preferredLocale ?? 'en';
  const localePrefix = locale === 'ar' ? 'ar-KW' : 'en-US';

  const q = (sp.q ?? '').trim();
  const statusParam = (sp.status ?? '').toUpperCase();
  const status = STATUS_TABS.find((t) => t.key === statusParam)?.key ?? 'ALL';
  const sla: SlaTier | 'all' = parseSlaParam(sp.sla);
  const mine = sp.mine === '1' && !!session?.user?.id;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  // Translate the SLA filter into Prisma conditions. We always emit the
  // `notIn: TERMINAL` guard for tier filters (breached/warning/on_track),
  // even when a specific status tab is also selected, so that combinations
  // like `status=REFUNDED + sla=breached` correctly return zero rows
  // instead of leaking terminal cases that just happen to be old enough —
  // which the SlaPill would render as "Closed", contradicting the active
  // tab. The conditions are AND'd into the where clause so they don't
  // collide with the top-level `status` key.
  const slaConditions = buildSlaConditions(sla);

  const andConditions: Prisma.RefundCaseWhereInput[] = [...slaConditions];
  if (mine && session?.user?.id) {
    andConditions.push({
      OR: [
        { assignedToId: session.user.id },
        { createdById: session.user.id },
      ],
    });
  }
  if (q) {
    andConditions.push({
      OR: [
        { caseNumber: { contains: q } },
        { orderNumber: { contains: q } },
        { customerEmail: { contains: q } },
        { customerName: { contains: q } },
      ],
    });
  }

  const where: Prisma.RefundCaseWhereInput = {
    deletedAt: null,
    ...(status !== 'ALL' ? { status: status as CaseStatus } : {}),
    ...(andConditions.length > 0 ? { AND: andConditions } : {}),
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
    if (sla !== 'all') params.set('sla', sla);
    if (mine) params.set('mine', '1');
    if (p > 1) params.set('page', String(p));
    const qs = params.toString();
    return `/cases${qs ? `?${qs}` : ''}`;
  }

  function slaUrl(key: typeof SLA_TABS[number]['key']) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status !== 'ALL') params.set('status', status);
    if (mine) params.set('mine', '1');
    if (key !== 'all') params.set('sla', key);
    const qs = params.toString();
    return `/cases${qs ? `?${qs}` : ''}`;
  }

  function mineUrl(next: boolean) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (status !== 'ALL') params.set('status', status);
    if (sla !== 'all') params.set('sla', sla);
    if (next) params.set('mine', '1');
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
        <div className="flex items-center gap-2">
          <SavedViewsMenu
            scope="CASES"
            basePath="/cases"
            currentQs={(() => {
              const p = new URLSearchParams();
              if (q) p.set('q', q);
              if (status !== 'ALL') p.set('status', status);
              if (sla !== 'all') p.set('sla', sla);
              if (mine) p.set('mine', '1');
              return p.toString();
            })()}
            isAdmin={session?.user?.role === 'ADMIN'}
          />
          <Button asChild variant="outline">
            <a
              href={(() => {
                const p = new URLSearchParams();
                if (q) p.set('q', q);
                if (status !== 'ALL') p.set('status', status);
                if (sla !== 'all') p.set('sla', sla);
                if (mine) p.set('mine', '1');
                const qs = p.toString();
                return `/api/export/cases${qs ? `?${qs}` : ''}`;
              })()}
              download
            >
              <Download className="h-4 w-4" />
              Export
            </a>
          </Button>
          <Button asChild>
            <Link href="/cases/new">
              <Plus className="h-4 w-4" />
              New case
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-4 p-3">
        {/*
          No `action` attribute on purpose: the form posts back to the
          current URL, which already carries the [locale] prefix. Hard-
          coding `action="/cases"` would drop the prefix and bounce an
          Arabic user back to /en/cases via the i18n middleware.
         */}
        <form className="flex flex-wrap items-center gap-3" method="get">
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
          {sla !== 'all' ? <input type="hidden" name="sla" value={sla} /> : null}
          {mine ? <input type="hidden" name="mine" value="1" /> : null}
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </Card>

      {/* Scope: my cases / everyone */}
      {session?.user?.id ? (
        <div className="mb-3 flex flex-wrap gap-1">
          <Link
            href={mineUrl(false)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              !mine
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-subtle text-muted-foreground hover:bg-surface-subtle/70'
            }`}
          >
            All cases
          </Link>
          <Link
            href={mineUrl(true)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              mine
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-subtle text-muted-foreground hover:bg-surface-subtle/70'
            }`}
          >
            My cases
          </Link>
        </div>
      ) : null}

      {/* SLA tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {SLA_TABS.map((tab) => {
          const active = tab.key === sla;
          return (
            <Link
              key={tab.key}
              href={slaUrl(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-subtle text-muted-foreground hover:bg-surface-subtle/70'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Status tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => {
          const params = new URLSearchParams();
          if (q) params.set('q', q);
          if (tab.key !== 'ALL') params.set('status', tab.key);
          if (sla !== 'all') params.set('sla', sla);
          if (mine) params.set('mine', '1');
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

      {/* Bulk action bar — only renders when there are rows. */}
      {rows.length > 0 ? (
        <BulkActionsBar
          cases={rows.map((r) => ({ id: r.id, caseNumber: r.caseNumber, status: r.status }))}
        />
      ) : null}

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
                  <th className="w-8">
                    <BulkSelectAll />
                  </th>
                  <th>Case</th>
                  <th>Country</th>
                  <th>Brand</th>
                  <th>Order</th>
                  <th>Customer</th>
                  <th className="text-end">Amount</th>
                  <th>Status</th>
                  <th>Age</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-subtle/50">
                    <td className="px-4 py-2.5">
                      <BulkRowCheckbox caseId={r.id} />
                    </td>
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
                    <td className="px-4 py-2.5">
                      <SlaPill status={r.status} createdAt={r.createdAt} />
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
