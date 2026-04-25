'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
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
import { STATUS_BUCKETS, STATUS_LABELS } from './case-status-buckets';

const ALL_VALUE = '__all__';

type Counts = {
  all: number;
  active: number;
  refunded: number;
  closed: number;
};

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

  const currentBucket = (searchParams.get('bucket') ?? 'all') as 'all' | keyof typeof STATUS_BUCKETS;
  const currentStatus = searchParams.get('status') ?? '';
  const currentCountry = searchParams.get('countryId') ?? '';
  const currentBrand = searchParams.get('brandId') ?? '';
  const fromDate = searchParams.get('fromDate');
  const toDate = searchParams.get('toDate');

  const statusesInBucket =
    currentBucket === 'all'
      ? ([
          ...STATUS_BUCKETS.active,
          ...STATUS_BUCKETS.refunded,
          ...STATUS_BUCKETS.closed,
        ] as readonly string[])
      : (STATUS_BUCKETS[currentBucket] as readonly string[]);

  // `bucket` is a tab selection, not a clearable filter — exclude it so the
  // Clear button only appears when an actual filter (search, country, brand,
  // status, date range) is applied.
  const hasAnyFilter = [...searchParams.keys()].some(
    (k) => k !== 'page' && k !== 'pageSize' && k !== 'bucket',
  );

  return (
    <div className="mb-5 space-y-3">
      {/* Status bucket tabs */}
      <Tabs
        value={currentBucket}
        onValueChange={(v) =>
          setParams({ bucket: v === 'all' ? null : v, status: null })
        }
      >
        <TabsList className="h-10">
          <TabsTrigger value="all">
            All <CountBadge value={counts.all} />
          </TabsTrigger>
          <TabsTrigger value="active">
            Active <CountBadge value={counts.active} />
          </TabsTrigger>
          <TabsTrigger value="refunded">
            Refunded <CountBadge value={counts.refunded} />
          </TabsTrigger>
          <TabsTrigger value="closed">
            Closed <CountBadge value={counts.closed} />
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Secondary controls */}
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

        <Select
          value={currentBrand || ALL_VALUE}
          onValueChange={(v) =>
            setParams({ brandId: v === ALL_VALUE ? null : v })
          }
        >
          <SelectTrigger className="h-10 w-[170px]">
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

        <Select
          value={currentStatus || ALL_VALUE}
          onValueChange={(v) =>
            setParams({ status: v === ALL_VALUE ? null : v })
          }
        >
          <SelectTrigger className="h-10 w-[200px]">
            <SelectValue placeholder="Any status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_VALUE}>Any status</SelectItem>
            {statusesInBucket.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <DateRangePicker
          value={{ from: fromDate, to: toDate }}
          onChange={(r) =>
            setParams({
              fromDate: r.from,
              toDate: r.to,
            })
          }
        />

        {hasAnyFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              // Preserve the current bucket so clearing filters doesn't yank
              // the user out of the tab they were inspecting.
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

function CountBadge({ value }: { value: number }) {
  // The TabsTrigger is a `group`, so we read its active state via
  // group-data-[state=active] rather than the span's own data attribute.
  return (
    <span className="ms-1 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-surface-subtle px-1.5 text-[10px] font-semibold text-muted-foreground group-data-[state=active]:bg-primary/10 group-data-[state=active]:text-primary">
      {value}
    </span>
  );
}
