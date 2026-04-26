'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { listPromoAllocationsAction } from '@/app/actions/promo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Search,
  Gift,
  Shield,
  Mail,
  MailMinus,
  Loader2,
  X,
  Hash,
  User,
  CalendarClock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromoValue } from '@/lib/promo/format';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';

type Item = Awaited<ReturnType<typeof listPromoAllocationsAction>>['items'][number];
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

function formatRelative(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const ms = Date.now() - date.getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return formatDateTime(date);
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

  // Debounced fetch whenever any filter changes.
  //
  // Type filtering happens server-side (so the take=50 cap doesn't hide
  // a whole type bucket), while per-type tab counts come back in the same
  // payload via `counts.compensation` / `counts.recovery` — those counts
  // ignore the type filter so the tabs always reflect the true totals
  // for the current q + date range.
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

  const compensation = useMemo(
    () => items?.filter((it) => it.type === 'CUSTOMER_COMPENSATION') ?? [],
    [items],
  );
  const recovery = useMemo(
    () => items?.filter((it) => it.type === 'SERVICE_RECOVERY') ?? [],
    [items],
  );

  const hasFilters = !!q || type !== 'ALL' || !!range.from || !!range.to;
  const empty = items !== null && items.length === 0;

  return (
    <div className="space-y-5">
      {/* Type tabs — primary navigation. Tabs replace the old type Select
          because splitting compensation vs recovery is the most important
          mental model on this page. */}
      <TypeTabs value={type} onChange={setType} counts={counts} />

      {/* Filter strip — search on the left, date range on the right. */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card px-4 py-3">
        <div className="min-w-[260px] flex-1 space-y-1">
          <Label htmlFor="q" className="text-xs font-medium text-muted-foreground">
            Search
          </Label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="q"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Email, customer, case #, or code"
              className="pl-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs font-medium text-muted-foreground">
            Date range
          </Label>
          <DateRangePicker value={range} onChange={setRange} placeholder="All time" />
        </div>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              setType('ALL');
              setRange({ from: null, to: null });
            }}
            className="h-10"
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Result summary line */}
      <div className="flex items-center text-sm text-muted-foreground">
        {pending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
          </span>
        ) : items === null ? (
          'Type to search.'
        ) : (
          <span className="tabular-nums">
            {total} allocation{total === 1 ? '' : 's'}
          </span>
        )}
      </div>

      {/* Empty state */}
      {empty && (
        <div className="rounded-lg border border-dashed border-border bg-card p-12 text-center">
          <p className="text-sm font-medium text-heading">No allocations found</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Try widening the date range or removing filters.
          </p>
        </div>
      )}

      {/* Sections — two distinct buckets so the agent never confuses a
          customer-emailed comp code with an internal recovery code. */}
      {!empty && items !== null && (
        <div className="space-y-6">
          {(type === 'ALL' || type === 'CUSTOMER_COMPENSATION') && (
            <Section
              kind="CUSTOMER_COMPENSATION"
              items={compensation}
              hideEmpty={type === 'ALL'}
            />
          )}
          {(type === 'ALL' || type === 'SERVICE_RECOVERY') && (
            <Section
              kind="SERVICE_RECOVERY"
              items={recovery}
              hideEmpty={type === 'ALL'}
            />
          )}
        </div>
      )}
    </div>
  );
}

function TypeTabs({
  value,
  onChange,
  counts,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
  counts: { all: number; comp: number; rec: number };
}) {
  const tabs: Array<{
    value: TypeFilter;
    label: string;
    count: number;
    Icon: typeof Gift;
    accent: string;
  }> = [
    { value: 'ALL', label: 'All', count: counts.all, Icon: Hash, accent: 'text-heading' },
    {
      value: 'CUSTOMER_COMPENSATION',
      label: 'Customer compensation',
      count: counts.comp,
      Icon: Gift,
      accent: 'text-blue-600 dark:text-blue-400',
    },
    {
      value: 'SERVICE_RECOVERY',
      label: 'Service recovery',
      count: counts.rec,
      Icon: Shield,
      accent: 'text-emerald-600 dark:text-emerald-400',
    },
  ];
  return (
    <div className="flex w-full overflow-x-auto rounded-lg border border-border bg-card p-1">
      {tabs.map((t) => {
        const active = value === t.value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition',
              active
                ? 'bg-background text-heading shadow-sm'
                : 'text-muted-foreground hover:bg-muted/40 hover:text-heading',
            )}
          >
            <t.Icon className={cn('h-4 w-4', active ? t.accent : '')} />
            <span>{t.label}</span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-[11px] tabular-nums',
                active
                  ? 'bg-muted text-heading'
                  : 'bg-muted/60 text-muted-foreground',
              )}
            >
              {t.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Section({
  kind,
  items,
  hideEmpty,
}: {
  kind: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
  items: Item[];
  hideEmpty: boolean;
}) {
  const isComp = kind === 'CUSTOMER_COMPENSATION';
  const Icon = isComp ? Gift : Shield;
  const accent = isComp
    ? 'text-blue-600 dark:text-blue-400'
    : 'text-emerald-600 dark:text-emerald-400';
  const accentBg = isComp ? 'bg-blue-500/10' : 'bg-emerald-500/10';
  const title = isComp ? 'Customer compensation' : 'Service recovery';
  const subtitle = isComp
    ? 'Promo codes emailed to customers'
    : 'Internal recovery codes (100% off)';

  if (hideEmpty && items.length === 0) return null;

  return (
    <section>
      <header className="mb-3 flex items-center gap-3 px-1">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', accentBg)}>
          <Icon className={cn('h-4 w-4', accent)} />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-heading">{title}</h3>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium tabular-nums text-heading">
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
          No {isComp ? 'compensation' : 'recovery'} allocations in this range.
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <AllocationCard key={it.id} item={it} />
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Single allocation card. Three rows:
 *   1. Code · value badge · brand · country · timestamp (right)
 *   2. Customer (name + email) · agent · case #
 *   3. Reason note (truncated) + delivery status pill on the right
 *
 * Hover lifts the card slightly. The left edge has a thin colored bar
 * (blue / emerald) for fast type recognition without alternating-row noise.
 */
function AllocationCard({ item }: { item: Item }) {
  const isComp = item.type === 'CUSTOMER_COMPENSATION';
  return (
    <li
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-md',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          isComp ? 'bg-blue-500/70' : 'bg-emerald-500/70',
        )}
      />

      {/* Row 1: code · value · brand · country | timestamp */}
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pl-1">
        <span className="font-mono text-sm font-semibold tracking-wide text-heading">
          {item.code}
        </span>
        <span
          className={cn(
            'rounded px-1.5 py-0.5 text-xs font-medium',
            isComp
              ? 'bg-blue-500/10 text-blue-700 dark:text-blue-300'
              : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
          )}
        >
          {formatPromoValue(
            item.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
            item.value,
            item.currency,
          )}
        </span>
        <span className="text-sm text-heading">{item.brand}</span>
        <span className="text-xs text-muted-foreground">· {item.country}</span>
        <span
          className="ms-auto inline-flex items-center gap-1 text-xs tabular-nums text-muted-foreground"
          title={formatDateTime(item.createdAt)}
        >
          <CalendarClock className="h-3 w-3" />
          {formatRelative(item.createdAt)}
        </span>
      </div>

      {/* Row 2: customer · agent · case # */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 pl-1 text-xs">
        <span className="inline-flex items-center gap-1.5 text-heading">
          <User className="h-3 w-3 text-muted-foreground" />
          <span className="font-medium">
            {item.customerName ?? item.customerEmail.split('@')[0]}
          </span>
          <span className="text-muted-foreground">· {item.customerEmail}</span>
        </span>
        {item.caseId && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 font-mono text-[11px] text-heading">
            <Hash className="h-2.5 w-2.5" />
            {item.caseId}
          </span>
        )}
        <span className="text-muted-foreground">
          by {item.requestedBy.name ?? 'unknown'}
        </span>
      </div>

      {/* Row 3: reason + delivery status. Always rendered so the pill has
          a stable position; the reason side falls back to an empty span
          when no note was recorded. */}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-1">
        {item.reason ? (
          <p className="line-clamp-1 max-w-[70%] text-xs italic text-muted-foreground">
            “{item.reason}”
          </p>
        ) : (
          <span />
        )}
        <DeliveryPill item={item} />
      </div>
    </li>
  );
}

function DeliveryPill({ item }: { item: Item }) {
  if (item.type === 'SERVICE_RECOVERY') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
        <Shield className="h-3 w-3" />
        Internal only
      </span>
    );
  }
  if (item.emailedAt) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300"
        title={`Emailed ${formatDateTime(item.emailedAt)}`}
      >
        <Mail className="h-3 w-3" />
        Emailed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-300">
      <MailMinus className="h-3 w-3" />
      Not emailed
    </span>
  );
}
