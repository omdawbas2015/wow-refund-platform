import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Gift, Plus, AlertTriangle } from 'lucide-react';
import { formatMoney, relativeTime } from '@/lib/format';

const PROMO_VIEW_ROLES = new Set([
  'ADMIN',
  'MANAGER',
  'OPERATIONS',
  'TEAM_LEAD',
  'AGENT',
  'READ_ONLY',
]);

export const dynamic = 'force-dynamic';

type PoolSummary = {
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

export default async function PromoPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!PROMO_VIEW_ROLES.has(session.user.role ?? '')) redirect('/');

  const [pools, stockCounts, recentAllocations] = await Promise.all([
    prisma.promoConfig.findMany({
      where: { isActive: true },
      include: {
        brand: true,
        country: { include: { registry: true } },
      },
      orderBy: [{ country: { sortOrder: 'asc' } }, { brand: { sortOrder: 'asc' } }, { type: 'asc' }, { value: 'asc' }],
    }),
    prisma.promoCode.groupBy({
      by: ['configId', 'status'],
      _count: { _all: true },
    }),
    prisma.promoAllocation.findMany({
      include: {
        code: {
          include: {
            config: {
              include: {
                brand: true,
                country: { include: { registry: true } },
              },
            },
          },
        },
        requestedBy: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  const countByPool = new Map<string, Record<string, number>>();
  for (const row of stockCounts) {
    const k = row.configId;
    if (!countByPool.has(k)) countByPool.set(k, {});
    countByPool.get(k)![row.status] = row._count._all;
  }

  const summaries: PoolSummary[] = pools.map((p) => {
    const counts = countByPool.get(p.id) ?? {};
    const available = counts['AVAILABLE'] ?? 0;
    const allocated = counts['ALLOCATED'] ?? 0;
    const used = counts['USED'] ?? 0;
    const expired = counts['EXPIRED'] ?? 0;
    const disabled = counts['DISABLED'] ?? 0;
    return {
      configId: p.id,
      brandId: p.brandId,
      brandName: p.brand.name,
      countryId: p.countryId,
      countryName: p.country.registry?.nameEn ?? p.country.registryCode,
      countryFlag: p.country.registry?.flag ?? '',
      type: p.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
      value: p.value,
      currency: p.currency,
      label: p.label,
      available,
      allocated,
      used,
      expired,
      total: available + allocated + used + expired + disabled,
    };
  });

  const lowStockCount = summaries.filter((s) => s.available <= 3).length;
  const totalAvailable = summaries.reduce((sum, s) => sum + s.available, 0);
  const totalAllocated = summaries.reduce((sum, s) => sum + s.allocated, 0);

  const canAllocate =
    session.user.role !== 'READ_ONLY' && session.user.role !== 'STORES';

  const grouped = groupPools(summaries);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Promo codes</h1>
          <p className="text-sm text-muted-foreground">
            Customer compensation and service recovery pools, organized by country and brand.
          </p>
        </div>
        {canAllocate && (
          <Button asChild>
            <Link href="/promo/allocate">
              <Plus className="mr-2 h-4 w-4" />
              Allocate promo
            </Link>
          </Button>
        )}
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Available codes" value={totalAvailable.toLocaleString()} hint="ready to allocate" />
        <StatCard label="Allocated" value={totalAllocated.toLocaleString()} hint="sent to customers" />
        <StatCard
          label="Low-stock pools"
          value={lowStockCount.toString()}
          hint="≤ 3 codes remaining"
          warn={lowStockCount > 0}
        />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Pools</h2>
        <div className="space-y-6">
          {grouped.map(({ countryId, countryName, countryFlag, items }) => (
            <div key={countryId} className="space-y-2">
              <h3 className="flex items-center gap-2 text-sm font-medium text-heading">
                <span className="text-base" aria-hidden>
                  {countryFlag || '🌐'}
                </span>
                {countryName}
              </h3>
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {items.map((p) => (
                  <PoolCard key={p.configId} pool={p} />
                ))}
              </div>
            </div>
          ))}
          {grouped.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Gift className="h-8 w-8" />
                <p>No promo pools configured yet.</p>
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent allocations</h2>
        <Card>
          <CardContent className="p-0">
            {recentAllocations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No promos allocated yet. Use <span className="font-medium text-heading">Allocate promo</span> to send one.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentAllocations.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-heading">
                        <span className="font-medium">{a.customerEmail}</span>
                        {a.customerName && (
                          <span className="text-muted-foreground">({a.customerName})</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {a.code.config.brand.name} ·{' '}
                        {a.code.config.country.registry?.nameEn ?? a.code.config.country.registryCode} ·{' '}
                        {formatMoney(a.code.config.value, a.code.config.currency)} ·{' '}
                        {a.code.config.type === 'CUSTOMER_COMPENSATION'
                          ? 'Customer compensation'
                          : 'Service recovery'}
                      </div>
                    </div>
                    <div className="font-mono text-xs text-muted-foreground">{a.code.code}</div>
                    <div className="text-xs text-muted-foreground">
                      by {a.requestedBy?.name ?? '—'} · {relativeTime(a.createdAt)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function groupPools(pools: PoolSummary[]) {
  const byCountry = new Map<
    string,
    { countryId: string; countryName: string; countryFlag: string; items: PoolSummary[] }
  >();
  for (const p of pools) {
    if (!byCountry.has(p.countryId)) {
      byCountry.set(p.countryId, {
        countryId: p.countryId,
        countryName: p.countryName,
        countryFlag: p.countryFlag,
        items: [],
      });
    }
    byCountry.get(p.countryId)!.items.push(p);
  }
  return Array.from(byCountry.values());
}

function PoolCard({ pool }: { pool: PoolSummary }) {
  const low = pool.available <= 3;
  const out = pool.available === 0;
  const isCompensation = pool.type === 'CUSTOMER_COMPENSATION';

  return (
    <Link
      href={`/promo/pools/${pool.configId}`}
      className="group block rounded-lg border border-border bg-card p-4 transition hover:border-foreground/20 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-heading">{pool.brandName}</p>
          <p className="text-xs text-muted-foreground">
            {isCompensation ? 'Customer compensation' : 'Service recovery'} ·{' '}
            <span className="font-mono">{formatMoney(pool.value, pool.currency)}</span>
          </p>
        </div>
        {out ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
            <AlertTriangle className="h-3 w-3" />
            Out of stock
          </span>
        ) : low ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            Low
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <div className="flex items-baseline justify-between text-xs text-muted-foreground">
          <span>Available</span>
          <span className="font-mono tabular-nums text-heading">
            {pool.available} / {pool.total || '—'}
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${
              out ? 'bg-red-500' : low ? 'bg-amber-500' : 'bg-emerald-500'
            }`}
            style={{
              width:
                pool.total === 0
                  ? '0%'
                  : `${Math.max(2, Math.min(100, (pool.available / pool.total) * 100))}%`,
            }}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
          <StockPill label="Allocated" value={pool.allocated} />
          <StockPill label="Used" value={pool.used} />
          <StockPill label="Expired" value={pool.expired} />
        </div>
      </div>
    </Link>
  );
}

function StockPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1 text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-xs tabular-nums text-heading">{value}</div>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  warn,
}: {
  label: string;
  value: string;
  hint?: string;
  warn?: boolean;
}) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${warn ? 'text-amber-600 dark:text-amber-400' : 'text-heading'}`}>
          {value}
        </p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}


