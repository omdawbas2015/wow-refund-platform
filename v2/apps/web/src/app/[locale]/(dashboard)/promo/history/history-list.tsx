'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { listPromoAllocationsAction } from '@/app/actions/promo';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Gift, Shield, Mail, MailMinus, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromoValue } from '@/lib/promo/format';
import {
  DateRangePicker,
  type DateRangeValue,
} from '@/components/ui/date-range-picker';

type Item = Awaited<ReturnType<typeof listPromoAllocationsAction>>['items'][number];

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

export function PromoHistoryList() {
  const [q, setQ] = useState('');
  const [type, setType] = useState<'ALL' | 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY'>('ALL');
  const [range, setRange] = useState<DateRangeValue>({ from: null, to: null });

  const [items, setItems] = useState<Item[] | null>(null);
  const [total, setTotal] = useState(0);
  const [pending, startTransition] = useTransition();
  const genRef = useRef(0);

  // Debounced fetch whenever any filter changes.
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
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [q, type, range]);

  const empty = useMemo(() => items !== null && items.length === 0, [items]);

  const hasFilters = !!q || type !== 'ALL' || !!range.from || !!range.to;

  return (
    <div className="space-y-4">
      {/* Filters — single panel: search, type, and a single date-range
          popover (with calendar + presets). */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="q" className="text-xs text-muted-foreground">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Email, customer name, case #, or code"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="type" className="text-xs text-muted-foreground">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
              <SelectTrigger id="type" className="min-w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All types</SelectItem>
                <SelectItem value="CUSTOMER_COMPENSATION">Customer compensation</SelectItem>
                <SelectItem value="SERVICE_RECOVERY">Service recovery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Date range</Label>
            <DateRangePicker value={range} onChange={setRange} placeholder="Any date" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {pending ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          ) : items === null ? (
            'Type to search.'
          ) : (
            `${total} allocation${total === 1 ? '' : 's'}`
          )}
        </span>
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              setType('ALL');
              setRange({ from: null, to: null });
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear filters
          </Button>
        )}
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No allocations match your filters.</p>
        </div>
      ) : items && items.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <AllocationRow key={it.id} item={it} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Single allocation row — designed to scan vertically: type icon on the
 * left, code + value + brand · country on top, customer + agent + delivery
 * status underneath, allocation timestamp on the far right. The compensation
 * (blue) vs recovery (emerald) color is signalled by a left accent bar so
 * the page doesn't read as alternating-color "stripes".
 */
function AllocationRow({ item }: { item: Item }) {
  const isCompensation = item.type === 'CUSTOMER_COMPENSATION';
  const Icon = isCompensation ? Gift : Shield;
  return (
    <li
      className={cn(
        'group relative flex flex-wrap items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
      )}
    >
      <span
        className={cn(
          'absolute inset-y-0 left-0 w-1',
          isCompensation ? 'bg-blue-500/70' : 'bg-emerald-500/70',
        )}
        aria-hidden
      />
      <div
        className={cn(
          'mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-md',
          isCompensation
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-sm">
          <span className="font-mono text-heading">{item.code}</span>
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-xs font-medium',
              isCompensation
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
          <span className="text-xs text-muted-foreground">
            {item.brand} <span className="opacity-60">· {item.country}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span className="text-heading">
            {item.customerName ? `${item.customerName} · ` : ''}
            {item.customerEmail}
          </span>
          {item.caseId && (
            <span>
              Case: <span className="font-mono text-heading">{item.caseId}</span>
            </span>
          )}
          <span>by {item.requestedBy.name ?? 'unknown'}</span>
          {isCompensation ? (
            item.emailedAt ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
                <Mail className="h-3 w-3" /> Emailed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-amber-700 dark:text-amber-300">
                <MailMinus className="h-3 w-3" /> Not emailed
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-emerald-700 dark:text-emerald-300">
              <Shield className="h-3 w-3" /> Internal only
            </span>
          )}
        </div>
        {item.reason && (
          <p className="truncate text-xs text-muted-foreground">
            <span className="opacity-60">Note:</span>{' '}
            <span className="italic">"{item.reason}"</span>
          </p>
        )}
      </div>

      <div className="ms-2 self-start text-right text-xs tabular-nums text-muted-foreground">
        {formatDateTime(item.createdAt)}
      </div>
    </li>
  );
}
