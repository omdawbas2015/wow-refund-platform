import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function RootCausesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const causes = await prisma.rootCause.findMany({
    orderBy: [{ sortOrder: 'asc' }, { label: 'asc' }],
    include: { _count: { select: { cases: true } } },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Root Causes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Standardized reasons for refund requests. Used to power root-cause analytics.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{causes.length} root cause{causes.length === 1 ? '' : 's'}</CardTitle>
          <CardDescription>Categories you can attribute a refund to during approval.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Key</th>
                <th className="p-3">Label</th>
                <th className="p-3">Cases</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {causes.map((c) => (
                <tr key={c.id}>
                  <td className="p-3 font-mono text-xs">{c.key}</td>
                  <td className="p-3 font-medium">
                    {c.label}
                    {c.labelAr ? <span className="ms-2 text-xs text-muted-foreground">{c.labelAr}</span> : null}
                  </td>
                  <td className="p-3">{c._count.cases}</td>
                  <td className="p-3">
                    <Badge variant={c.isActive ? 'success' : 'secondary'}>
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
