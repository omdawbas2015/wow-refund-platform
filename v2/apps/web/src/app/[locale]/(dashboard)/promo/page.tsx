import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, History } from 'lucide-react';
import { relativeTime } from '@/lib/format';
import { formatPromoValue, promoTypeLabel } from '@/lib/promo/format';
import { PromoExportButton } from './export-button';
import { PoolsBoard, type PoolSummary } from './pools-board';

/**
 * Who gets the pool-management dashboard. Agents / team leads / read-only
 * users are bounced to the allocate page (or history for read-only) since
 * the pool inventory view isn't useful to them day-to-day.
 */
const POOL_MANAGEMENT_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

export const dynamic = 'force-dynamic';

export default async function PromoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  const role = session.user.role ?? '';
  // Agents / team leads → allocate directly. Read-only → history only.
  if (role === 'AGENT' || role === 'TEAM_LEAD') {
    redirect(`/${locale}/promo/allocate`);
  }
  if (role === 'READ_ONLY') {
    redirect(`/${locale}/promo/history`);
  }
  if (!POOL_MANAGEMENT_ROLES.has(role)) redirect(`/${locale}`);

  const now = new Date();
  const [pools, stockCounts, staleAvailableCounts, recentAllocations] = await Promise.all([
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
    // Codes still flagged AVAILABLE but whose expiresAt has already passed —
    // counted separately so we can subtract them from "Available" (matches the
    // filter used by allocate page + allocatePromoAction).
    prisma.promoCode.groupBy({
      by: ['configId'],
      where: {
        status: 'AVAILABLE',
        expiresAt: { not: null, lte: now },
      },
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
  const staleByPool = new Map<string, number>(
    staleAvailableCounts.map((r) => [r.configId, r._count._all]),
  );

  const summaries: PoolSummary[] = pools.map((p) => {
    const counts = countByPool.get(p.id) ?? {};
    const rawAvailable = counts['AVAILABLE'] ?? 0;
    const stale = staleByPool.get(p.id) ?? 0;
    // "Available" should exclude already-expired codes that still carry the
    // AVAILABLE status flag; treat those as expired in the UI.
    const available = Math.max(0, rawAvailable - stale);
    const allocated = counts['ALLOCATED'] ?? 0;
    const used = counts['USED'] ?? 0;
    const expired = (counts['EXPIRED'] ?? 0) + stale;
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

  // Must mirror ALLOCATE_*_ROLES in app/actions/promo.ts so we don't render
  // an "Allocate promo" button for roles the server action will reject.
  const ALLOCATE_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT', 'TEAM_LEAD']);
  const canAllocate = ALLOCATE_ROLES.has(session.user.role ?? '');

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Promo codes</h1>
          <p className="text-sm text-muted-foreground">
            Manage compensation and service-recovery pools across brands and countries.
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <PromoExportButton />
          <Button asChild variant="outline">
            <Link href={`/${locale}/promo/history`}>
              <History className="mr-2 h-4 w-4" />
              History
            </Link>
          </Button>
          {canAllocate && (
            <Button asChild>
              <Link href={`/${locale}/promo/allocate`}>
                <Plus className="mr-2 h-4 w-4" />
                Allocate promo
              </Link>
            </Button>
          )}
        </div>
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
        <PoolsBoard pools={summaries} locale={locale} />
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
                        {formatPromoValue(
                          a.code.config.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
                          a.code.config.value,
                          a.code.config.currency,
                        )}{' '}
                        ·{' '}
                        {promoTypeLabel(
                          a.code.config.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
                        )}
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


