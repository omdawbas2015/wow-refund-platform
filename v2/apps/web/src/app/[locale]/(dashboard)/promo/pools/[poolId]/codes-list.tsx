'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDateTime, relativeTime } from '@/lib/format';
import { CodeRowActions } from './code-row-actions';

type Status = 'AVAILABLE' | 'ALLOCATED' | 'USED' | 'EXPIRED' | 'DISABLED';

export type CodeRow = {
  id: string;
  code: string;
  status: Status;
  uploadedAt: string;
  expiresAt: string | null;
  allocation: { customerEmail: string; createdAt: string } | null;
};

type StatusFilter = 'ALL' | Status;

const PAGE_SIZE = 30;

/**
 * Filterable, paginated list of codes inside a pool.
 *
 * Pools can hold thousands of codes; the previous "render the most recent
 * 50 in a single flat list" was unusable for finding a specific code or
 * reviewing only ALLOCATED ones. Status tabs + search keep this page useful
 * even when the pool grows.
 */
export function CodesList({
  codes,
  totals,
  canAdmin,
}: {
  codes: CodeRow[];
  totals: Record<Status, number> & { ALL: number };
  canAdmin: boolean;
}) {
  const [status, setStatus] = useState<StatusFilter>('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toUpperCase();
    return codes.filter((c) => {
      if (status !== 'ALL' && c.status !== status) return false;
      if (needle) {
        const hay = `${c.code} ${c.allocation?.customerEmail ?? ''}`.toUpperCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [codes, status, q]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const slice = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const tabs: Array<{ value: StatusFilter; label: string; count: number }> = [
    { value: 'ALL', label: 'All', count: totals.ALL },
    { value: 'AVAILABLE', label: 'Available', count: totals.AVAILABLE },
    { value: 'ALLOCATED', label: 'Allocated', count: totals.ALLOCATED },
    { value: 'USED', label: 'Used', count: totals.USED },
    { value: 'EXPIRED', label: 'Expired', count: totals.EXPIRED },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-surface-subtle/60 p-1">
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => {
                setStatus(t.value);
                setPage(0);
              }}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition',
                status === t.value
                  ? 'bg-background text-heading shadow-sm'
                  : 'text-muted-foreground hover:text-heading',
              )}
            >
              {t.label}
              <span className="ml-1.5 tabular-nums text-muted-foreground/80">
                {t.count.toLocaleString()}
              </span>
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(0);
            }}
            placeholder="Search code or recipient email"
            className="pl-9"
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-heading"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {slice.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground">
            {q || status !== 'ALL' ? 'No codes match your filters.' : 'No codes in this pool yet.'}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {slice.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="font-mono text-heading">{c.code}</span>
                  <CodeStatusPill status={c.status} />
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                  {c.allocation && (
                    <span className="truncate" title={c.allocation.customerEmail}>
                      → {c.allocation.customerEmail}
                    </span>
                  )}
                  <span>uploaded {relativeTime(c.uploadedAt)}</span>
                  {c.expiresAt && <span>exp {formatDateTime(c.expiresAt)}</span>}
                  {canAdmin && <CodeRowActions codeId={c.id} status={c.status} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            Showing {safePage * PAGE_SIZE + 1}–
            {Math.min(filtered.length, safePage * PAGE_SIZE + PAGE_SIZE)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </Button>
            <span className="tabular-nums">
              {safePage + 1} / {pageCount}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeStatusPill({ status }: { status: Status }) {
  const map: Record<Status, { bg: string; dot: string; label: string }> = {
    AVAILABLE: {
      bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
      dot: 'bg-emerald-500',
      label: 'Available',
    },
    ALLOCATED: {
      bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
      dot: 'bg-blue-500',
      label: 'Allocated',
    },
    USED: {
      bg: 'bg-muted text-muted-foreground',
      dot: 'bg-muted-foreground',
      label: 'Used',
    },
    EXPIRED: {
      bg: 'bg-red-500/10 text-red-700 dark:text-red-300',
      dot: 'bg-red-500',
      label: 'Expired',
    },
    DISABLED: {
      bg: 'bg-muted text-muted-foreground',
      dot: 'bg-muted-foreground',
      label: 'Disabled',
    },
  };
  const m = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium', m.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', m.dot)} />
      {m.label}
    </span>
  );
}
