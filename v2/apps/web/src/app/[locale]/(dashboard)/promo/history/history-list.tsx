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
import { Search, Gift, Shield, Mail, MailMinus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type Item = Awaited<ReturnType<typeof listPromoAllocationsAction>>['items'][number];

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

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
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

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
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        });
        if (genRef.current !== gen) return;
        setItems(res.items);
        setTotal(res.total);
      });
    }, 250);
    return () => clearTimeout(handle);
  }, [q, type, fromDate, toDate]);

  const empty = useMemo(() => items !== null && items.length === 0, [items]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <div className="sm:col-span-2 space-y-1.5">
          <Label htmlFor="q">Search</Label>
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
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All types</SelectItem>
              <SelectItem value="CUSTOMER_COMPENSATION">Customer compensation</SelectItem>
              <SelectItem value="SERVICE_RECOVERY">Service recovery</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:col-span-4 md:col-span-1">
          <div className="space-y-1.5">
            <Label htmlFor="fromDate">From</Label>
            <Input id="fromDate" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="toDate">To</Label>
            <Input id="toDate" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
        {(q || type !== 'ALL' || fromDate || toDate) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQ('');
              setType('ALL');
              setFromDate('');
              setToDate('');
            }}
          >
            Clear filters
          </Button>
        )}
      </div>

      {empty ? (
        <div className="rounded-lg border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm text-muted-foreground">No allocations match your filters.</p>
        </div>
      ) : items && items.length > 0 ? (
        <div className="space-y-2">
          {items.map((it) => (
            <AllocationCard key={it.id} item={it} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function AllocationCard({ item }: { item: Item }) {
  const isCompensation = item.type === 'CUSTOMER_COMPENSATION';
  const Icon = isCompensation ? Gift : Shield;
  return (
    <div
      className={cn(
        'flex flex-wrap items-start gap-3 rounded-lg border p-4 transition',
        isCompensation
          ? 'border-blue-200/70 bg-blue-50/30 dark:border-blue-900/30 dark:bg-blue-950/10'
          : 'border-emerald-200/70 bg-emerald-50/30 dark:border-emerald-900/30 dark:bg-emerald-950/10',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 flex-none items-center justify-center rounded-md',
          isCompensation
            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
          <span className="font-mono text-heading">{item.code}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-heading font-medium">{formatMoney(item.value, item.currency)}</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">
            {item.brand} <span className="opacity-60">· {item.country}</span>
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{item.customerName ? `${item.customerName} · ` : ''}{item.customerEmail}</span>
          {item.caseId && <span>Case: <span className="font-mono">{item.caseId}</span></span>}
          <span>by {item.requestedBy.name ?? 'unknown'}</span>
          {isCompensation ? (
            item.emailedAt ? (
              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                <Mail className="h-3 w-3" /> Emailed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1">
                <MailMinus className="h-3 w-3" /> Not emailed
              </span>
            )
          ) : (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
              Internal only
            </span>
          )}
        </div>
        {item.reason && (
          <p className="text-xs text-muted-foreground italic">"{item.reason}"</p>
        )}
      </div>

      <div className="text-right text-xs text-muted-foreground">
        {formatDateTime(item.createdAt)}
      </div>
    </div>
  );
}
