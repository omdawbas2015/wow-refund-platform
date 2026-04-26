import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';
import { relativeTime } from '@/lib/format';
import { formatPromoValue, promoTypeLabel } from '@/lib/promo/format';
import { UploadCodesPanel } from './upload-codes-panel';
import { CodesList, type CodeRow } from './codes-list';

const VIEW_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS', 'TEAM_LEAD', 'AGENT', 'READ_ONLY']);
const UPLOAD_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);
const POOL_ADMIN_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

export const dynamic = 'force-dynamic';

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ locale: string; poolId: string }>;
}) {
  const { locale, poolId } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!VIEW_ROLES.has(session.user.role ?? '')) redirect(`/${locale}`);

  const pool = await prisma.promoConfig.findUnique({
    where: { id: poolId },
    include: {
      brand: true,
      country: { include: { registry: true } },
    },
  });
  if (!pool) notFound();

  const now = new Date();
  const [countsByStatus, staleAvailable, recentCodes, recentAllocations] = await Promise.all([
    prisma.promoCode.groupBy({
      by: ['status'],
      where: { configId: poolId },
      _count: { _all: true },
    }),
    // AVAILABLE-but-past-expiresAt codes we should treat as expired in the UI
    // (mirrors the filter used by allocate page / allocatePromoAction).
    prisma.promoCode.count({
      where: {
        configId: poolId,
        status: 'AVAILABLE',
        expiresAt: { not: null, lte: now },
      },
    }),
    prisma.promoCode.findMany({
      where: { configId: poolId },
      orderBy: { uploadedAt: 'desc' },
      take: 500,
      include: {
        allocations: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { customerEmail: true, createdAt: true },
        },
      },
    }),
    prisma.promoAllocation.findMany({
      where: { code: { configId: poolId } },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        code: { select: { code: true } },
        requestedBy: { select: { name: true } },
      },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const row of countsByStatus) counts[row.status] = row._count._all;
  const rawAvailable = counts['AVAILABLE'] ?? 0;
  const available = Math.max(0, rawAvailable - staleAvailable);
  const allocated = counts['ALLOCATED'] ?? 0;
  const used = counts['USED'] ?? 0;
  const expired = (counts['EXPIRED'] ?? 0) + staleAvailable;
  const total = rawAvailable + allocated + used + (counts['EXPIRED'] ?? 0) + (counts['DISABLED'] ?? 0);

  const canUpload = UPLOAD_ROLES.has(session.user.role ?? '');
  const canAdmin = POOL_ADMIN_ROLES.has(session.user.role ?? '');

  // Codes are sent to the client as already-serialized rows so the filter
  // tabs / search / pagination stay snappy without extra round-trips.
  const codeRows: CodeRow[] = recentCodes.map((c) => {
    // Derive the displayed status: AVAILABLE codes whose expiresAt has passed
    // are shown as EXPIRED to match the totals shown above.
    const effectiveStatus =
      c.status === 'AVAILABLE' && c.expiresAt && c.expiresAt <= now
        ? 'EXPIRED'
        : (c.status as CodeRow['status']);
    const a = c.allocations[0];
    return {
      id: c.id,
      code: c.code,
      status: effectiveStatus,
      uploadedAt: c.uploadedAt.toISOString(),
      expiresAt: c.expiresAt ? c.expiresAt.toISOString() : null,
      allocation: a
        ? { customerEmail: a.customerEmail, createdAt: a.createdAt.toISOString() }
        : null,
    };
  });
  const codeTotals = {
    ALL: total,
    AVAILABLE: available,
    ALLOCATED: allocated,
    USED: used,
    EXPIRED: expired,
    DISABLED: counts['DISABLED'] ?? 0,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/promo`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to promos</span>
          </Link>
        </Button>
      </div>

      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
          <span aria-hidden>{pool.country.registry?.flag ?? '🌐'}</span>
          <span>{pool.country.registry?.nameEn ?? pool.country.registryCode}</span>
          <span>·</span>
          <span>{pool.brand.name}</span>
          <span>·</span>
          <span>{promoTypeLabel(pool.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY')}</span>
        </div>
        <h1 className="text-2xl font-semibold text-heading">
          {formatPromoValue(
            pool.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
            pool.value,
            pool.currency,
          )}{' '}
          pool
        </h1>
        {pool.label && <p className="text-sm text-muted-foreground">{pool.label}</p>}
      </header>

      <section className="grid gap-3 sm:grid-cols-4">
        <StatCard label="Available" value={available} accent="emerald" />
        <StatCard label="Allocated" value={allocated} accent="blue" />
        <StatCard label="Used" value={used} accent="default" />
        <StatCard label="Expired" value={expired} accent="default" />
      </section>

      {canUpload && <UploadCodesPanel poolId={pool.id} />}

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium text-muted-foreground">
            Codes <span className="text-xs">({total.toLocaleString()} total)</span>
          </h2>
        </div>
        <CodesList codes={codeRows} totals={codeTotals} canAdmin={canAdmin} />
      </section>

      {recentAllocations.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted-foreground">Recent allocations</h2>
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {recentAllocations.map((a) => (
                  <li key={a.id} className="px-4 py-2.5 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium text-heading">{a.customerEmail}</span>
                        {a.customerName && (
                          <span className="ml-2 text-muted-foreground">({a.customerName})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-mono">{a.code.code}</span>
                        <span>·</span>
                        <span>
                          by {a.requestedBy?.name ?? '—'} · {relativeTime(a.createdAt)}
                        </span>
                      </div>
                    </div>
                    {a.reason && (
                      <p className="mt-1 text-xs text-muted-foreground">{a.reason}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: 'default' | 'emerald' | 'blue';
}) {
  const valueClass =
    accent === 'emerald'
      ? 'text-emerald-600 dark:text-emerald-400'
      : accent === 'blue'
        ? 'text-blue-600 dark:text-blue-400'
        : 'text-heading';
  return (
    <Card>
      <CardContent className="py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
      </CardContent>
    </Card>
  );
}


