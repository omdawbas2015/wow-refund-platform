import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; entityType?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const { q, entityType, page } = await searchParams;
  const pageNum = Math.max(1, parseInt(page ?? '1', 10) || 1);

  const where = {
    ...(q ? {
      OR: [
        { actorEmail: { contains: q } },
        { action: { contains: q } },
        { entityId: { contains: q } },
      ],
    } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every privileged action: approvals, status changes, role updates, batch sends.
        </p>
      </div>

      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <CardTitle>{total} entries · page {pageNum} of {pages}</CardTitle>
              <CardDescription>Filter by actor, action, or entity ID.</CardDescription>
            </div>
            <form className="flex gap-2" method="get">
              <input
                type="text"
                name="q"
                defaultValue={q ?? ''}
                placeholder="actor email, action…"
                className="w-56 rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              />
              <select
                name="entityType"
                defaultValue={entityType ?? ''}
                className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Any entity</option>
                <option value="USER">User</option>
                <option value="CASE">Case</option>
                <option value="BATCH">Batch</option>
                <option value="PROMO_CODE">Promo</option>
                <option value="SETTING">Setting</option>
              </select>
              <button type="submit" className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground">
                Filter
              </button>
            </form>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">When</th>
                <th className="p-3">Actor</th>
                <th className="p-3">Action</th>
                <th className="p-3">Entity</th>
                <th className="p-3">ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-muted-foreground">No audit entries found.</td>
                </tr>
              ) : entries.map((e) => (
                <tr key={e.id}>
                  <td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                  <td className="p-3 text-xs">{e.actorEmail ?? <span className="text-muted-foreground">system</span>}</td>
                  <td className="p-3 font-mono text-xs">{e.action}</td>
                  <td className="p-3"><Badge variant="outline">{e.entityType ?? '—'}</Badge></td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">{e.entityId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="flex justify-center gap-2">
          {Array.from({ length: pages }).slice(0, 10).map((_, i) => {
            const p = i + 1;
            const params = new URLSearchParams({ ...(q ? { q } : {}), ...(entityType ? { entityType } : {}), page: String(p) });
            return (
              <a
                key={p}
                href={`?${params}`}
                className={`rounded-md border border-border px-3 py-1 text-xs ${p === pageNum ? 'bg-primary text-primary-foreground' : 'hover:bg-surface-subtle'}`}
              >
                {p}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
