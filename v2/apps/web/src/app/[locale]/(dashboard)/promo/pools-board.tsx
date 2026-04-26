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
import {
  Search,
  X,
  AlertTriangle,
  ChevronRight,
  Gift,
  Shield,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPromoValue } from '@/lib/promo/format';

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
 * Country-first pool browser. Each country is a section header with a
 * flag + total stock; inside, every brand operating in that country is a
 * card showing its compensation tiers + recovery indicator. Clicking a
 * tier on a card jumps directly to /promo/pools/[poolId] for management.
 *
 * This mirrors how a refund agent thinks about the catalog — "what do we
 * have for Kuwait?" — instead of forcing them to scan brand-by-brand.
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

  const countryGroups = useMemo(() => groupByCountry(filtered), [filtered]);

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
                placeholder="Brand, country, or value"
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

      {countryGroups.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-card/40 px-6 py-12 text-center text-sm text-muted-foreground">
          No pools match your filters.
        </div>
      ) : (
        <div className="space-y-6">
          {countryGroups.map((g) => (
            <CountrySection key={g.countryId} group={g} locale={locale} />
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

type CountryGroup = {
  countryId: string;
  countryName: string;
  countryFlag: string;
  brands: BrandGroup[];
};

type BrandGroup = {
  brandId: string;
  brandName: string;
  pools: PoolSummary[];
};

function groupByCountry(pools: PoolSummary[]): CountryGroup[] {
  const countries = new Map<
    string,
    { countryId: string; countryName: string; countryFlag: string; brands: Map<string, BrandGroup> }
  >();
  for (const p of pools) {
    if (!countries.has(p.countryId)) {
      countries.set(p.countryId, {
        countryId: p.countryId,
        countryName: p.countryName,
        countryFlag: p.countryFlag,
        brands: new Map(),
      });
    }
    const c = countries.get(p.countryId)!;
    if (!c.brands.has(p.brandId)) {
      c.brands.set(p.brandId, { brandId: p.brandId, brandName: p.brandName, pools: [] });
    }
    c.brands.get(p.brandId)!.pools.push(p);
  }
  // Sort tiers within each brand: compensation tiers ascending, then recovery
  for (const c of countries.values()) {
    for (const b of c.brands.values()) {
      b.pools.sort((a, x) => {
        if (a.type !== x.type) return a.type === 'CUSTOMER_COMPENSATION' ? -1 : 1;
        return a.value - x.value;
      });
    }
  }
  return Array.from(countries.values())
    .map((c) => ({
      countryId: c.countryId,
      countryName: c.countryName,
      countryFlag: c.countryFlag,
      brands: Array.from(c.brands.values()).sort((a, b) =>
        a.brandName.localeCompare(b.brandName),
      ),
    }))
    .sort((a, b) => a.countryName.localeCompare(b.countryName));
}

function CountrySection({ group, locale }: { group: CountryGroup; locale: string }) {
  const totalAvailable = group.brands.reduce(
    (s, b) => s + b.pools.reduce((sb, p) => sb + p.available, 0),
    0,
  );
  // Match BrandStockChip's "Low" definition exactly (>0 && <=3) so the
  // header badge can't say "low" while a card on the row reads "Out".
  const lowBrands = group.brands.filter((b) =>
    b.pools.some((p) => p.available > 0 && p.available <= 3),
  ).length;

  return (
    <section>
      <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl leading-none" aria-hidden>
            {group.countryFlag || '🌐'}
          </span>
          <h3 className="text-lg font-semibold tracking-tight text-heading">
            {group.countryName}
          </h3>
          <span className="text-xs text-muted-foreground">
            {group.brands.length} brand{group.brands.length === 1 ? '' : 's'}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">
            <span className="font-semibold text-heading tabular-nums">
              {totalAvailable.toLocaleString()}
            </span>{' '}
            available
          </span>
          {lowBrands > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 font-medium text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {lowBrands} brand{lowBrands === 1 ? '' : 's'} low
            </span>
          )}
        </div>
      </header>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.brands.map((b) => (
          <BrandCard key={b.brandId} brand={b} locale={locale} />
        ))}
      </div>
    </section>
  );
}

function BrandCard({ brand, locale }: { brand: BrandGroup; locale: string }) {
  const compensation = brand.pools.filter((p) => p.type === 'CUSTOMER_COMPENSATION');
  const recovery = brand.pools.find((p) => p.type === 'SERVICE_RECOVERY');
  const totalAvailable = brand.pools.reduce((s, p) => s + p.available, 0);
  const anyLow = brand.pools.some((p) => p.available > 0 && p.available <= 3);
  const allOut = brand.pools.every((p) => p.available === 0);

  return (
    <article
      className={cn(
        'group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition',
        'hover:border-blue-500/40 hover:shadow-md',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-base font-semibold tracking-tight text-heading">
            {brand.brandName}
          </h4>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-semibold text-heading tabular-nums">
              {totalAvailable.toLocaleString()}
            </span>{' '}
            codes available
          </p>
        </div>
        <BrandStockChip allOut={allOut} anyLow={anyLow} />
      </div>

      {compensation.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Gift className="h-3 w-3" />
            Customer compensation
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {compensation.map((p) => (
              <PoolTierTile key={p.configId} pool={p} locale={locale} />
            ))}
          </div>
        </div>
      )}

      {recovery && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Shield className="h-3 w-3" />
            Service recovery
          </div>
          <PoolTierTile pool={recovery} locale={locale} variant="recovery" />
        </div>
      )}

      <div className="mt-1 flex items-center justify-end text-xs text-muted-foreground opacity-0 transition group-hover:opacity-100">
        Click any tier to manage
        <ChevronRight className="ml-1 h-3 w-3" />
      </div>
    </article>
  );
}

function BrandStockChip({ allOut, anyLow }: { allOut: boolean; anyLow: boolean }) {
  if (allOut)
    return (
      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400">
        Out
      </span>
    );
  if (anyLow)
    return (
      <span className="inline-flex flex-none items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
        <AlertTriangle className="h-3 w-3" />
        Low
      </span>
    );
  return (
    <span className="inline-flex flex-none items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Healthy
    </span>
  );
}

/**
 * Single tier inside a BrandCard. Click → pool detail page. Shows the
 * tier's value (or "100% off") prominently and a small `available/total`
 * pill below; disabled when the tier is out of stock.
 */
function PoolTierTile({
  pool,
  locale,
  variant = 'compensation',
}: {
  pool: PoolSummary;
  locale: string;
  variant?: 'compensation' | 'recovery';
}) {
  const out = pool.available === 0;
  const low = !out && pool.available <= 3;
  const stockColor = out
    ? 'text-red-600 dark:text-red-400'
    : low
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-muted-foreground';

  const baseClasses = cn(
    'flex flex-col items-start gap-1 rounded-lg border px-3 py-2 text-left transition',
    'hover:border-blue-500/40 hover:bg-blue-500/[0.04] focus:outline-none focus:ring-2 focus:ring-blue-500/40',
    out && 'opacity-60',
    variant === 'recovery' &&
      'border-emerald-500/30 bg-emerald-500/[0.04] hover:border-emerald-500/60 hover:bg-emerald-500/[0.08]',
    variant === 'compensation' && 'border-border bg-surface-subtle/40',
  );

  return (
    <Link href={`/${locale}/promo/pools/${pool.configId}`} className={baseClasses}>
      <span className="font-mono text-sm font-semibold tabular-nums text-heading">
        {formatPromoValue(pool.type, pool.value, pool.currency)}
      </span>
      <span className={cn('text-[10px] font-medium tabular-nums', stockColor)}>
        {out ? 'Out of stock' : `${pool.available} / ${pool.total || '—'}`}
      </span>
    </Link>
  );
}
