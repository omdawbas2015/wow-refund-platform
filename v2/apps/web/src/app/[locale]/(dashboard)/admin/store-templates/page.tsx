import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function StoreTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const templates = await prisma.storeMessageTemplate.findMany({
    orderBy: { key: 'asc' },
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Store Message Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Templated messages used by Help Desk to communicate with stores about refund cases.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>{templates.length} template{templates.length === 1 ? '' : 's'}</CardTitle>
          <CardDescription>Each template has variables that get substituted when sent.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Key</th>
                <th className="p-3">Subject</th>
                <th className="p-3">Body preview</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map((t) => (
                <tr key={t.id}>
                  <td className="p-3 font-mono text-xs">{t.key}</td>
                  <td className="p-3 font-medium">{t.subject}</td>
                  <td className="p-3 max-w-md truncate text-xs text-muted-foreground">{t.body.replace(/\n/g, ' ').slice(0, 120)}</td>
                  <td className="p-3">
                    <Badge variant={t.isActive ? 'success' : 'secondary'}>
                      {t.isActive ? 'Active' : 'Inactive'}
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
