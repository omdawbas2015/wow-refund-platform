import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import type { Prisma, UserStatus } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Link } from '@/i18n/routing';
import { formatDateTime } from '@/lib/utils';
import { UserRowActions } from './user-row-actions';

interface SearchParams {
  q?: string;
  status?: string;
}

const STATUS_TABS: Array<{ key: 'ALL' | UserStatus; label: string }> = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'ACTIVE', label: 'Active' },
  { key: 'SUSPENDED', label: 'Suspended' },
  { key: 'ARCHIVED', label: 'Archived' },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const sp = await searchParams;
  const q = (sp.q ?? '').trim();
  const statusKey = (sp.status ?? 'ALL') as 'ALL' | UserStatus;

  const where: Prisma.UserWhereInput = {};
  // ARCHIVED users carry deletedAt; we still want to surface them when the
  // tab is explicitly selected, but the "All" view excludes them.
  if (statusKey === 'ARCHIVED') {
    where.OR = [{ status: 'ARCHIVED' }, { deletedAt: { not: null } }];
  } else if (statusKey === 'ALL') {
    where.deletedAt = null;
  } else {
    where.deletedAt = null;
    where.status = statusKey;
  }
  if (q) {
    where.AND = [
      {
        OR: [
          { email: { contains: q } },
          { name: { contains: q } },
          { phone: { contains: q } },
        ],
      },
    ];
  }

  const [users, counts] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: { role: true, approvedBy: { select: { email: true } } },
      take: 200,
    }),
    prisma.user.groupBy({
      by: ['status'],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
  ]);

  const countByStatus = (s: UserStatus) =>
    counts.find((row) => row.status === s)?._count?._all ?? 0;
  const tabCount = (key: 'ALL' | UserStatus): number => {
    if (key === 'ALL') return counts.reduce((sum, row) => sum + row._count._all, 0);
    return countByStatus(key);
  };

  const tabHref = (key: 'ALL' | UserStatus) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (key !== 'ALL') params.set('status', key);
    return `/admin/users${params.toString() ? `?${params.toString()}` : ''}`;
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Users</h1>
          <p className="mt-2 text-body">Suspend / reactivate accounts and review approval state.</p>
        </div>
        <Link
          href="/admin/pending-approvals"
          className="text-xs uppercase tracking-wide text-primary hover:underline"
        >
          Pending approvals →
        </Link>
      </div>

      <Card className="mb-4">
        <form className="flex flex-wrap items-center gap-2 p-4">
          <Input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search by name, email, phone…"
            className="max-w-sm"
          />
          {statusKey !== 'ALL' ? (
            <input type="hidden" name="status" value={statusKey} />
          ) : null}
          <Button type="submit" size="sm" variant="outline">
            Search
          </Button>
        </form>
      </Card>

      <div className="mb-4 flex flex-wrap gap-1">
        {STATUS_TABS.map((tab) => {
          const active = tab.key === statusKey;
          return (
            <Link
              key={tab.key}
              href={tabHref(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-surface-subtle text-muted-foreground hover:bg-surface-subtle/70'
              }`}
            >
              {tab.label}
              <span className="ms-1 tabular text-[10px] opacity-70">{tabCount(tab.key)}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {users.length} user{users.length === 1 ? '' : 's'}
          </CardTitle>
          <CardDescription>
            Showing up to 200 rows. Refine with status tabs or search to narrow.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Status</th>
                <th className="p-3">Created</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-muted-foreground">{user.email}</td>
                  <td className="p-3">
                    {user.role?.name ?? <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-3">
                    <Badge
                      variant={
                        user.status === 'ACTIVE'
                          ? 'success'
                          : user.status === 'PENDING'
                            ? 'warning'
                            : user.status === 'SUSPENDED'
                              ? 'destructive'
                              : 'secondary'
                      }
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">
                    {formatDateTime(user.createdAt)}
                  </td>
                  <td className="p-3 text-right">
                    <UserRowActions
                      userId={user.id}
                      status={user.status}
                      isSelf={user.id === session.user.id}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 ? (
                <tr>
                  <td className="p-6 text-center text-sm text-muted-foreground" colSpan={6}>
                    No users match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
