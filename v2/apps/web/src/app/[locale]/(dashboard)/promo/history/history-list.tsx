'use client';

/**
 * Promo allocation history.
 *
 * Per DESIGN.md ("Refund Execution" page override): treat this as an
 * operations desk, not a dashboard. Use a compact table with clear
 * filters, restrained badges, and stable column widths so digits and
 * status pills line up across rows.
 *
 * Layout:
 *   [ Tabs: All · Compensation · Recovery ]
 *   [ Filter strip: search · date range · clear ]
 *   [ Summary: "N allocations" ]
 *   [ Table (desktop) / card list (mobile) ]
 *
 * Server-side type filtering ensures the take=50 cap can't hide an
 * entire type bucket; per-type counts come back in the same payload so
 * the tab badges always reflect the true totals for the current
 * search + date range.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { listPromoAllocationsAction } from '@/app/actions/promo';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';
import {
  Search,
  Mail,
  MailMinus,
  Loader2,
  X,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromoValue } from '@/lib/promo/format';

type Item = Awaited<
  ReturnType<typeof listPromoAllocationsAction>
>['items'][number];
type TypeFilter = 'ALL' | 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';

function formatDateTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatShortDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function PromoHistoryList() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });

  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [serverCounts, setServerCounts] = useState<{
    compensation: number;
    recovery: number;
  }>({ compensation: 0, recovery: 0 });
  const [pending, startTransition] = useTransition();
  const genRef = useRef(0);

  useEffect(() => {
    const gen = ++genRef.current;
    const handle = setTimeout(() => {
      startTransition(async () => {
        const res = await listPromoAllocationsAction({
          q: q || undefined,
          type,
          fromDate: range.from ?? undefined,
          toDate: range.to ?? undefined,
        });
        if (genRef.current !== gen) return;
        setItems(res.items);
        setTotal(res.total);
        setServerCounts(res.counts);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [q, type, range]);

  const counts = useMemo(
    () => ({
      all: serverCounts.compensation + serverCounts.recovery,
      comp: serverCounts.compensation,
      rec: serverCounts.recovery,
    }),
    [serverCounts],
  );

  const hasFilters =
    !!q || type !== 'ALL' || !!range.from || !!range.to;
  const empty = items !== null && items.length === 0;
  const loading = items === null || pending;

  return (
    <div className="space-y-4">
      {/* Tabs — primary segmentation between Compensation and Recovery */}
      <Tabs
        value={type}
        onValueChange={(v) => setType(v as TypeFilter)}
      >
        <TabsList className="h-9">
          <TabsTrigger value="ALL">
            All
            <CountBadge n={counts.all} active={type === 'ALL'} />
          </TabsTrigger>
          <TabsTrigger value="CUSTOMER_COMPENSATION">
            Compensation
            <CountBadge
              n={counts.comp}
              active={type === 'CUSTOMER_COMPENSATION'}
            />
          </TabsTrigger>
          <TabsTrigger value="SERVICE_RECOVERY">
            Recovery
            <CountBadge
              n={counts.rec}
              active={type === 'SERVICE_RECOVERY'}
            />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter strip */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-subtle/40 p-2">
        <div className="relative min-w-[240px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search code, email, customer, case #"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <DateRangePicker
          value={range}
          onChange={setRange}
          placeholder="All time"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              setType('ALL');
              setRange({ from: null, to: null });
            }}
            className="h-8"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Summary line */}
      <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
        <span>
          {loading ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading…
            </span>
          ) : (
            <span className="tabular-nums">
              {total} allocation{total === 1 ? '' : 's'}
              {type !== 'ALL' && (
                <>
                  {' · '}
                  {type === 'CUSTOMER_COMPENSATION'
                    ? 'compensation'
                    : 'recovery'}
                </>
              )}
              {hasFilters && (
                <span className="text-muted-foreground/60">
                  {' '}
                  · filtered
                </span>
              )}
            </span>
          )}
        </span>
      </div>

      {/* Empty state */}
      {empty && !pending && (
        <div className="rounded-lg border border-dashed border-border bg-surface-subtle/30 p-10 text-center">
          <p className="text-sm font-medium text-heading">
            No allocations found
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try widening the date range or removing filters.
          </p>
        </div>
      )}

      {!empty && items !== null && (
        <>
          {/* Desktop: data table */}
          <div className="hidden overflow-x-auto rounded-lg border border-border md:block">
            <table className="w-full min-w-[1100px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-subtle/40">
                  <Th className="w-[140px]">Date</Th>
                  <Th>Code</Th>
                  <Th>Type</Th>
                  <Th align="end">Value</Th>
                  <Th>Customer</Th>
                  <Th>Brand · Country</Th>
                  <Th>Case</Th>
                  <Th>Agent</Th>
                  <Th>Delivery</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {items.map((it) => (
                  <Row key={it.id} item={it} />
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile: stacked card list */}
          <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border md:hidden">
            {items.map((it) => (
              <MobileRow key={it.id} item={it} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function CountBadge({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={cn(
        'ms-1.5 inline-flex h-4 min-w-[18px] items-center justify-center rounded-full px-1.5 text-[10px] font-medium tabular-nums',
        active
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {n}
    </span>
  );
}

function Th({
  children,
  align = 'start',
  className,
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
  className?: string;
}) {
  return (
    <th
      className={cn(
        'whitespace-nowrap px-3 py-2.5 text-xs font-medium text-muted-foreground',
        align === 'end' ? 'text-end' : 'text-start',
        className,
      )}
    >
      {children}
    </th>
  );
}

/** Single allocation table row with expandable inline reason panel. */
function Row({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => setOpen((o) => !o)}
        className="group cursor-pointer transition-colors hover:bg-primary/[0.03]"
      >
        <td
          className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground tabular-nums"
          title={formatDateTime(item.createdAt)}
        >
          <ChevronRight
            className={cn(
              'me-1 inline h-3 w-3 transition-transform',
              open && 'rotate-90',
            )}
          />
          {formatShortDate(item.createdAt)}
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <span className="select-all font-mono text-xs font-semibold tracking-tight text-heading">
            {item.code}
          </span>
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <TypePill type={item.type} />
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-end font-mono text-sm tabular-nums text-heading">
          {formatPromoValue(item.type, item.value, item.currency)}
        </td>
        <td className="px-3 py-3">
          <div className="max-w-[220px]">
            <div className="truncate text-sm text-heading">
              {item.customerName ?? item.customerEmail.split('@')[0]}
            </div>
            <div className="truncate text-xs text-muted-foreground">
              {item.customerEmail}
            </div>
          </div>
        </td>
        <td className="px-3 py-3 text-sm text-heading">
          {item.brand}
          <span className="text-muted-foreground"> · {item.country}</span>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-xs">
          {item.caseId ? (
            <span className="font-mono text-heading">{item.caseId}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
          {item.requestedBy.name ?? '—'}
        </td>
        <td className="whitespace-nowrap px-3 py-3">
          <DeliveryPill type={item.type} emailedAt={item.emailedAt} />
        </td>
      </tr>
      {open && (
        <tr className="bg-surface-subtle/40">
          <td colSpan={9} className="px-3 py-3">
            <DetailPanel item={item} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Mobile-friendly stacked row. */
function MobileRow({ item }: { item: Item }) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="block w-full px-4 py-3 text-start transition-colors hover:bg-primary/[0.03]"
      >
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="select-all font-mono text-xs font-semibold text-heading">
            {item.code}
          </span>
          <span className="font-mono text-sm tabular-nums text-heading">
            {formatPromoValue(item.type, item.value, item.currency)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {item.customerName ?? item.customerEmail}
          </span>
          <TypePill type={item.type} compact />
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <span className="truncate">
            {item.brand} · {item.country}
            {item.caseId && (
              <>
                {' · '}
                <span className="font-mono">{item.caseId}</span>
              </>
            )}
          </span>
          <span title={formatDateTime(item.createdAt)}>
            {formatShortDate(item.createdAt)}
          </span>
        </div>
      </button>
      {open && (
        <div className="border-t border-border bg-surface-subtle/40 px-4 py-3">
          <DetailPanel item={item} />
        </div>
      )}
    </li>
  );
}

function TypePill({
  type,
  compact = false,
}: {
  type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
  compact?: boolean;
}) {
  const isComp = type === 'CUSTOMER_COMPENSATION';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        compact ? 'px-1.5 py-0 text-[10px]' : 'px-2 py-0.5 text-[11px]',
        isComp
          ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
          : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      )}
    >
      {isComp ? 'Compensation' : 'Recovery'}
    </span>
  );
}

function DeliveryPill({
  type,
  emailedAt,
}: {
  type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
  emailedAt: Date | string | null;
}) {
  if (type === 'SERVICE_RECOVERY') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
        Internal only
      </span>
    );
  }
  if (emailedAt) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-700 dark:text-emerald-300">
        <Mail className="h-3 w-3" /> Emailed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">
      <MailMinus className="h-3 w-3" /> Pending
    </span>
  );
}

/** Inline expandable detail with full timestamp + reason. */
function DetailPanel({ item }: { item: Item }) {
  return (
    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-xs">
      <dt className="text-muted-foreground">Allocated</dt>
      <dd className="text-heading tabular-nums">
        {formatDateTime(item.createdAt)}
      </dd>
      {item.type === 'CUSTOMER_COMPENSATION' && (
        <>
          <dt className="text-muted-foreground">Email status</dt>
          <dd>
            {item.emailedAt ? (
              <span className="text-heading tabular-nums">
                Sent · {formatDateTime(item.emailedAt)}
              </span>
            ) : (
              <span className="text-amber-700 dark:text-amber-300">
                Queued — not yet sent
              </span>
            )}
          </dd>
        </>
      )}
      <dt className="text-muted-foreground">Reason</dt>
      <dd className="text-heading">
        {item.reason ? (
          <span className="italic">“{item.reason}”</span>
        ) : (
          <span className="text-muted-foreground">
            No reason was recorded.
          </span>
        )}
      </dd>
    </dl>
  );
}
