import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Upload } from 'lucide-react';
import { formatMoney, formatDateTime, relativeTime } from '@/lib/format';
import { UploadCodesPanel } from './upload-codes-panel';

const VIEW_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS', 'TEAM_LEAD', 'AGENT', 'READ_ONLY']);
const UPLOAD_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

export const dynamic = 'force-dynamic';

export default async function PoolDetailPage({
  params,
}: {
  params: Promise<{ poolId: string }>;
}) {
  const { poolId } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!VIEW_ROLES.has(session.user.role ?? '')) redirect('/');

  const pool = await prisma.promoConfig.findUnique({
    where: { id: poolId },
    include: {
      brand: true,
      country: { include: { registry: true } },
    },
  });
  if (!pool) notFound();

  const [countsByStatus, recentCodes, recentAllocations] = await Promise.all([
    prisma.promoCode.groupBy({
      by: ['status'],
      where: { configId: poolId },
      _count: { _all: true },
    }),
    prisma.promoCode.findMany({
      where: { configId: poolId },
      orderBy: { uploadedAt: 'desc' },
      take: 50,
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
  const available = counts['AVAILABLE'] ?? 0;
  const allocated = counts['ALLOCATED'] ?? 0;
  const used = counts['USED'] ?? 0;
  const expired = counts['EXPIRED'] ?? 0;
  const total = available + allocated + used + expired + (counts['DISABLED'] ?? 0);

  const canUpload = UPLOAD_ROLES.has(session.user.role ?? '');

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-sm">
        <Button asChild variant="ghost" size="sm">
          <Link href="/promo">
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
          <span>
            {pool.type === 'CUSTOMER_COMPENSATION' ? 'Customer compensation' : 'Service recovery'}
          </span>
        </div>
        <h1 className="text-2xl font-semibold text-heading">
          {formatMoney(pool.value, pool.currency)} pool
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

      <section>
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Codes <span className="text-xs">({total} total)</span>
        </h2>
        <Card>
          <CardContent className="p-0">
            {recentCodes.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No codes in this pool yet.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {recentCodes.map((c) => (
                  <li
                    key={c.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-heading">{c.code}</span>
                      <CodeStatusPill status={c.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {c.allocations[0] && (
                        <span className="truncate">
                          → {c.allocations[0].customerEmail}
                        </span>
                      )}
                      <span>uploaded {relativeTime(c.uploadedAt)}</span>
                      {c.expiresAt && (
                        <span>exp {formatDateTime(c.expiresAt)}</span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
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

function CodeStatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    AVAILABLE: { bg: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500', label: 'Available' },
    ALLOCATED: { bg: 'bg-blue-500/10 text-blue-700 dark:text-blue-300', dot: 'bg-blue-500', label: 'Allocated' },
    USED: { bg: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', label: 'Used' },
    EXPIRED: { bg: 'bg-red-500/10 text-red-700 dark:text-red-300', dot: 'bg-red-500', label: 'Expired' },
    DISABLED: { bg: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', label: 'Disabled' },
  };
  const m = map[status] ?? map['AVAILABLE']!;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${m.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}
