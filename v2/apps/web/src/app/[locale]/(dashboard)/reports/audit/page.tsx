import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

interface PageProps {
  searchParams: Promise<{ action?: string; entity?: string; q?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/reports');

  const sp = await searchParams;
  const action = sp.action ?? '';
  const entity = sp.entity ?? '';
  const q = sp.q ?? '';
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where = {
    ...(action ? { action: { contains: action } } : {}),
    ...(entity ? { entityType: entity } : {}),
    ...(q
      ? {
          OR: [
            { actorEmail: { contains: q } },
            { entityId: { contains: q } },
          ],
        }
      : {}),
  };

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/reports" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Reports
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Audit log</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        All system events. Persisted forever; no purge.
      </p>

      <form className="my-6 flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Action
          <input
            type="text"
            name="action"
            defaultValue={action}
            placeholder="case.approved"
            className="h-9 w-48 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Entity
          <select
            name="entity"
            defaultValue={entity}
            className="h-9 w-32 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Any</option>
            <option value="CASE">Case</option>
            <option value="USER">User</option>
            <option value="BATCH">Batch</option>
            <option value="COMPONENT">Component</option>
            <option value="COUNTRY">Country</option>
            <option value="BRAND">Brand</option>
            <option value="PAYMENT_METHOD">Payment method</option>
            <option value="ROOT_CAUSE">Root cause</option>
            <option value="EMAIL_TEMPLATE">Email template</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
          Search
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="email or entity id"
            className="h-9 w-72 rounded-md border border-border bg-background px-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
      </form>

      <Card>
        <CardHeader>
          <CardTitle>
            {total} entries · page {page} of {pages}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="bg-surface-subtle text-muted-foreground">
              <tr className="[&>th]:px-4 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Entity ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {logs.map((l) => (
                <tr key={l.id} className="hover:bg-surface-subtle">
                  <td className="px-4 py-2 tabular text-xs">{formatDateTime(l.createdAt, 'en-US')}</td>
                  <td className="px-4 py-2 text-xs">{l.actorEmail ?? '—'}</td>
                  <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2">
                    {l.entityType ? <Badge variant="outline">{l.entityType}</Badge> : '—'}
                  </td>
                  <td className="px-4 py-2 font-mono text-xs">{l.entityId ?? '—'}</td>
                </tr>
              ))}
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No matching entries.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={`/reports/audit?page=${page - 1}&action=${action}&entity=${entity}&q=${q}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              ← Prev
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={`/reports/audit?page=${page + 1}&action=${action}&entity=${entity}&q=${q}`}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
