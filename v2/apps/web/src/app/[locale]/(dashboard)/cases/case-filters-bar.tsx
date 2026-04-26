'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { STATUS_BUCKETS } from './case-status-buckets';

const ALL_VALUE = '__all__';

type Counts = {
  all: number;
  active: number;
  refunded: number;
  closed: number;
};

/**
 * Filter bar — three rules:
 *   1. Tabs are the ONLY status filter (no separate dropdown).
 *   2. Inline row stays at three controls: search · country · More.
 *   3. Brand + date live behind "More" so the bar stays calm by default,
 *      with a count badge on the trigger when secondary filters are active.
 */
export function CaseFiltersBar({
  countries,
  brands,
  counts,
}: {
  countries: Array<{ id: string; code: string; name: string; flag: string }>;
  brands: Array<{ id: string; name: string }>;
  counts: Counts;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const sp = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === '') sp.delete(k);
        else sp.set(k, v);
      }
      sp.delete('page');
      router.push(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const currentBucket = (searchParams.get('bucket') ?? 'all') as
    | 'all'
    | keyof typeof STATUS_BUCKETS;
  const currentCountry = searchParams.get('countryId') ?? '';
  const currentBrand = searchParams.get('brandId') ?? '';
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  // Filters that live behind "More" — keep this list in sync with the popover.
  const secondaryActiveCount = useMemo(() => {
    let n = 0;
    if (currentBrand) n++;
    if (fromDate || toDate) n++;
    return n;
  }, [currentBrand, fromDate, toDate]);

  // Top-level "any filter applied" check, used to decide whether to render
  // the Clear button. Bucket and pagination don't count.
  const hasAnyFilter = [...searchParams.keys()].some(
    (k) => k !== 'page' && k !== 'pageSize' && k !== 'bucket',
  );

  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="mb-5 space-y-3">
      {/* Status bucket tabs — the single source of truth for status filtering. */}
      <Tabs
        value={currentBucket}
        onValueChange={(v) =>
          setParams({ bucket: v === 'all' ? null : v, status: null })
        }
      >
        <TabsList className="h-10">
          <TabsTrigger value="all">
            All
            <CountBadge value={counts.all} />
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            <CountBadge value={counts.active} />
          </TabsTrigger>
          <TabsTrigger value="refunded">
            Refunded
            <CountBadge value={counts.refunded} />
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed
            <CountBadge value={counts.closed} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Secondary controls — calm three-up row. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-md">
          <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            defaultValue={searchParams.get('q') ?? ''}
            placeholder="Search case #, customer, order…"
            className="ps-9"
            onBlur={(e) => setParams({ q: e.currentTarget.value.trim() || null })}
            onKeyDown={(e) => {
              if (e.key === 'Enter')
                setParams({ q: e.currentTarget.value.trim() || null });
            }}
          />
        </div>

        <Select
          value={currentCountry || ALL_VALUE}
          onValueChange={(v) =>
            setParams({ countryId: v === ALL_VALUE ? null : v })
          }
        >
          <SelectTrigger className="h-10 w-[180px]">
            <SelectValue placeholder="All countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>All countries</SelectItem>
            <SelectGroup>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="me-1.5">{c.flag}</span>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>

        <Popover open={moreOpen} onOpenChange={setMoreOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-10">
              <SlidersHorizontal className="h-4 w-4" />
              More
              {secondaryActiveCount > 0 && (
                <span className="ms-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold text-primary">
                  {secondaryActiveCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] space-y-4 p-4" align="end">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Brand
              </label>
              <Select
                value={currentBrand || ALL_VALUE}
                onValueChange={(v) =>
                  setParams({ brandId: v === ALL_VALUE ? null : v })
                }
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="All brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_VALUE}>All brands</SelectItem>
                  <SelectGroup>
                    {brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted-foreground">
                Date range
              </label>
              <DateRangePicker
                value={{ from: fromDate, to: toDate }}
                onChange={(r) =>
                  setParams({
                    fromDate: r.from,
                    toDate: r.to,
                  })
                }
              />
            </div>

            {secondaryActiveCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => {
                  setParams({
                    brandId: null,
                    fromDate: null,
                    toDate: null,
                  });
                  setMoreOpen(false);
                }}
              >
                Reset
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-10"
            onClick={() => {
              const sp = new URLSearchParams();
              const b = searchParams.get('bucket');
              if (b) sp.set('bucket', b);
              const qs = sp.toString();
              router.push(qs ? `${pathname}?${qs}` : pathname);
            }}
          >
            <X className="h-4 w-4" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Count is hidden when the bucket is empty, so the tab strip doesn't
 * carry useless `0` chips. The active tab uses primary tint.
 */
function CountBadge({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span
      className={cn(
        'ms-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-subtle px-1.5 text-[10px] font-semibold text-muted-foreground',
        'group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary',
      )}
    >
      {value}
    </span>
  );
}
