'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, X, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromoValue, promoTypeShortLabel } from '@/lib/promo/format';

export type PoolSummary = {
  configId: string;
  brandId: string;
  brandName: string;
  countryId: string;
  countryName: string;
  countryFlag: string;
  type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
  value: number;
  currency: string;
  label: string | null;
  available: number;
  allocated: number;
  used: number;
  expired: number;
  total: number;
};

type TypeFilter = 'ALL' | 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';

/**
 * Operational pool browser — filterable, dense, scannable.
 *
 * Renders pools as table-style rows grouped by brand. With dozens of pools
 * (brands × countries × tiers), a card-grid wall becomes unreadable; rows
 * keep the data density a refund team needs while still being clickable.
 */
export function PoolsBoard({ pools, locale }: { pools: PoolSummary[]; locale: string }) {
  const [q, setQ] = useState('');
  const [brandId, setBrandId] = useState<string>('ALL');
  const [countryId, setCountryId] = useState<string>('ALL');
  const [type, setType] = useState<TypeFilter>('ALL');
  const [stockOnly, setStockOnly] = useState<'ALL' | 'LOW' | 'OUT'>('ALL');

  const brands = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of pools) m.set(p.brandId, p.brandName);
    return Array.from(m.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pools]);

  const countries = useMemo(() => {
    const m = new Map<string, { name: string; flag: string }>();
    for (const p of pools) m.set(p.countryId, { name: p.countryName, flag: p.countryFlag });
    return Array.from(m.entries())
      .map(([id, v]) => ({ id, name: v.name, flag: v.flag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pools]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return pools.filter((p) => {
      if (brandId !== 'ALL' && p.brandId !== brandId) return false;
      if (countryId !== 'ALL' && p.countryId !== countryId) return false;
      if (type !== 'ALL' && p.type !== type) return false;
      if (stockOnly === 'LOW' && p.available > 3) return false;
      if (stockOnly === 'OUT' && p.available !== 0) return false;
      if (needle) {
        const hay = `${p.brandName} ${p.countryName} ${p.label ?? ''} ${p.value}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [pools, q, brandId, countryId, type, stockOnly]);

  const groups = useMemo(() => groupByBrand(filtered), [filtered]);

  const hasFilters =
    q.trim() !== '' || brandId !== 'ALL' || countryId !== 'ALL' || type !== 'ALL' || stockOnly !== 'ALL';

  function clearFilters() {
    setQ('');
    setBrandId('ALL');
    setCountryId('ALL');
    setType('ALL');
    setStockOnly('ALL');
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid gap-3 md:grid-cols-12">
          <div className="md:col-span-4 space-y-1.5">
            <Label htmlFor="pools-q">Search</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pools-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Brand, country, label, or value"
                className="pl-9"
              />
            </div>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="pools-brand">Brand</Label>
            <Select value={brandId} onValueChange={setBrandId}>
              <SelectTrigger id="pools-brand">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All brands</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3 space-y-1.5">
            <Label htmlFor="pools-country">Country</Label>
            <Select value={countryId} onValueChange={setCountryId}>
              <SelectTrigger id="pools-country">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All countries</SelectItem>
                {countries.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="mr-2" aria-hidden>
                      {c.flag || '🌐'}
                    </span>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-1.5">
            <Label htmlFor="pools-stock">Stock</Label>
            <Select value={stockOnly} onValueChange={(v) => setStockOnly(v as typeof stockOnly)}>
              <SelectTrigger id="pools-stock">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All stock</SelectItem>
                <SelectItem value="LOW">Low (≤ 3)</SelectItem>
                <SelectItem value="OUT">Out of stock</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <TypeSegmented value={type} onChange={setType} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {filtered.length} of {pools.length} pool{pools.length === 1 ? '' : 's'}
            </span>
            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2">
                <X className="mr-1 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Grouped rows */}
      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
          No pools match your filters.
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <BrandSection key={g.brandId} group={g} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

function TypeSegmented({
  value,
  onChange,
}: {
  value: TypeFilter;
  onChange: (v: TypeFilter) => void;
}) {
  const options: Array<{ value: TypeFilter; label: string }> = [
    { value: 'ALL', label: 'All types' },
    { value: 'CUSTOMER_COMPENSATION', label: 'Compensation' },
    { value: 'SERVICE_RECOVERY', label: 'Recovery' },
  ];
  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-subtle/60 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition',
            value === o.value
              ? 'bg-background text-heading shadow-sm'
              : 'text-muted-foreground hover:text-heading',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function groupByBrand(pools: PoolSummary[]) {
  const m = new Map<string, { brandId: string; brandName: string; items: PoolSummary[] }>();
  for (const p of pools) {
    if (!m.has(p.brandId)) m.set(p.brandId, { brandId: p.brandId, brandName: p.brandName, items: [] });
    m.get(p.brandId)!.items.push(p);
  }
  // Sort within each brand: country alpha → type → value
  for (const g of m.values()) {
    g.items.sort((a, b) => {
      if (a.countryName !== b.countryName) return a.countryName.localeCompare(b.countryName);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.value - b.value;
    });
  }
  return Array.from(m.values()).sort((a, b) => a.brandName.localeCompare(b.brandName));
}

function BrandSection({
  group,
  locale,
}: {
  group: { brandId: string; brandName: string; items: PoolSummary[] };
  locale: string;
}) {
  const totalAvailable = group.items.reduce((s, p) => s + p.available, 0);
  const lowCount = group.items.filter((p) => p.available <= 3).length;
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle/40 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-heading">{group.brandName}</span>
          <span className="text-xs text-muted-foreground">
            {group.items.length} pool{group.items.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            <span className="font-medium text-heading tabular-nums">
              {totalAvailable.toLocaleString()}
            </span>{' '}
            available
          </span>
          {lowCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {lowCount} low
            </span>
          )}
        </div>
      </div>
      <div className="divide-y divide-border">
        {group.items.map((p) => (
          <PoolRow key={p.configId} pool={p} locale={locale} />
        ))}
      </div>
    </div>
  );
}

function PoolRow({ pool, locale }: { pool: PoolSummary; locale: string }) {
  const out = pool.available === 0;
  const low = !out && pool.available <= 3;
  const isRecovery = pool.type === 'SERVICE_RECOVERY';
  const stockPct = pool.total === 0 ? 0 : Math.min(100, (pool.available / pool.total) * 100);

  return (
    <Link
      href={`/${locale}/promo/pools/${pool.configId}`}
      className="grid grid-cols-12 items-center gap-3 px-4 py-3 text-sm transition hover:bg-surface-subtle/30"
    >
      {/* Country */}
      <div className="col-span-12 flex items-center gap-2 sm:col-span-3">
        <span className="text-base" aria-hidden>
          {pool.countryFlag || '🌐'}
        </span>
        <span className="truncate text-heading">{pool.countryName}</span>
      </div>

      {/* Type */}
      <div className="col-span-4 sm:col-span-2">
        <TypeChip type={pool.type} />
      </div>

      {/* Value */}
      <div className="col-span-4 font-mono text-heading sm:col-span-2">
        {formatPromoValue(pool.type, pool.value, pool.currency)}
      </div>

      {/* Stock bar */}
      <div className="col-span-4 sm:col-span-3">
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted-foreground">Available</span>
          <span className="font-mono tabular-nums text-heading">
            {pool.available} / {pool.total || '—'}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              out ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-emerald-500',
            )}
            style={{ width: `${Math.max(2, stockPct)}%` }}
          />
        </div>
      </div>

      {/* Status pill */}
      <div className="col-span-12 flex items-center justify-end gap-2 sm:col-span-2">
        {out ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
            Out
          </span>
        ) : low ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            Low · {pool.available}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            {pool.allocated} allocated
            {isRecovery ? '' : pool.used ? ` · ${pool.used} used` : ''}
          </span>
        )}
      </div>
    </Link>
  );
}

function TypeChip({ type }: { type: PoolSummary['type'] }) {
  const recovery = type === 'SERVICE_RECOVERY';
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
        recovery
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'bg-blue-500/10 text-blue-700 dark:text-blue-400',
      )}
    >
      {promoTypeShortLabel(type)}
    </span>
  );
}
