'use client';

import { useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { caseStatuses } from '@wow/validators';

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  PENDING_APPROVAL: 'Pending approval',
  APPROVED: 'Approved',
  IN_EXECUTION: 'In execution',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export function CaseFiltersBar({
  countries,
  brands,
}: {
  countries: Array<{ id: string; code: string; name: string; flag: string }>;
  brands: Array<{ id: string; name: string }>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const sp = new URLSearchParams(searchParams.toString());
      if (value === null || value === '') sp.delete(key);
      else sp.set(key, value);
      sp.delete('page');
      router.push(`${pathname}?${sp.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const hasAnyFilter = [...searchParams.keys()].some((k) => k !== 'page' && k !== 'pageSize');

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[220px] max-w-sm">
        <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          defaultValue={searchParams.get('q') ?? ''}
          placeholder="Search case #, customer, order…"
          className="ps-9"
          onBlur={(e) => setParam('q', e.currentTarget.value.trim() || null)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setParam('q', e.currentTarget.value.trim() || null);
          }}
        />
      </div>

      <select
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        defaultValue={searchParams.get('countryId') ?? ''}
        onChange={(e) => setParam('countryId', e.currentTarget.value || null)}
      >
        <option value="">All countries</option>
        {countries.map((c) => (
          <option key={c.id} value={c.id}>
            {c.flag} {c.name}
          </option>
        ))}
      </select>

      <select
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        defaultValue={searchParams.get('brandId') ?? ''}
        onChange={(e) => setParam('brandId', e.currentTarget.value || null)}
      >
        <option value="">All brands</option>
        {brands.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>

      <select
        className="h-10 rounded-md border border-border bg-surface px-3 text-sm"
        defaultValue={searchParams.get('status') ?? ''}
        onChange={(e) => setParam('status', e.currentTarget.value || null)}
      >
        <option value="">All statuses</option>
        {caseStatuses.map((s) => (
          <option key={s} value={s}>
            {STATUS_LABELS[s] ?? s}
          </option>
        ))}
      </select>

      {hasAnyFilter && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
        >
          <X className="h-4 w-4" />
          Clear
        </Button>
      )}
    </div>
  );
}
