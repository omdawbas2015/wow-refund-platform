import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';

export default async function EmailTemplatesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }, { locale: 'asc' }],
  });

  const grouped = new Map<string, typeof templates>();
  for (const t of templates) {
    const arr = grouped.get(t.category) ?? [];
    arr.push(t);
    grouped.set(t.category, arr);
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Email templates</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Subjects and bodies for all outbound mail. Placeholders use <code>{'{{variable}}'}</code> and
        are documented per template.
      </p>

      <div className="mt-6 space-y-4">
        {[...grouped.entries()].map(([category, list]) => (
          <Card key={category}>
            <CardHeader>
              <CardTitle>{category}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ul className="divide-y divide-border">
                {list.map((t) => (
                  <li key={t.id}>
                    <Link
                      href={`/admin/email-templates/${t.id}`}
                      className="flex items-center justify-between gap-3 px-6 py-3 hover:bg-surface-subtle"
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{t.key}</div>
                        <div className="text-xs text-muted-foreground truncate">{t.subject}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{t.locale}</Badge>
                        {!t.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
