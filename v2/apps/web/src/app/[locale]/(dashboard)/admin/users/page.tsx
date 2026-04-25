import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/utils';

export default async function UsersPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: { role: true, approvedBy: { select: { email: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">Users</h1>
        <p className="mt-2 text-body">All registered users in the system.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{users.length} user{users.length === 1 ? '' : 's'}</CardTitle>
          <CardDescription>Including pending, active, and suspended accounts.</CardDescription>
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
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-muted-foreground">{user.email}</td>
                  <td className="p-3">{user.role?.name ?? <span className="text-muted-foreground">—</span>}</td>
                  <td className="p-3">
                    <Badge
                      variant={
                        user.status === 'ACTIVE'
                          ? 'success'
                          : user.status === 'PENDING'
                            ? 'warning'
                            : 'secondary'
                      }
                    >
                      {user.status}
                    </Badge>
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{formatDateTime(user.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
