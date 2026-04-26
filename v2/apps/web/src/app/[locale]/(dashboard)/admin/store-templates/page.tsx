import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default async function StoreTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const templates = await prisma.storeMessageTemplate.findMany({
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">
            Store message templates
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Categorized issue templates for the help desk. Subject and body support
            <code className="mx-1">{'{{caseNumber}}'}</code> and <code>{'{{note}}'}</code>.
          </p>
        </div>
        <Link href="/admin/store-templates/new">
          <Button>New template</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{templates.length} templates</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {templates.length === 0 ? (
            <div className="px-6 py-6 text-sm text-muted-foreground">
              No templates yet. The seed includes the four standard categories
              (NO_ASSET_ID, NO_DESCRIPTION, SOURCE_OF_LEAKAGE, NOT_UNDER_OUR_SCOPE).
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {templates.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-6 py-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{t.label}</span>
                      <code className="text-xs text-muted-foreground">{t.key}</code>
                      {!t.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
                    </div>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {t.subject}
                    </p>
                  </div>
                  <Link
                    href={`/admin/store-templates/${t.id}`}
                    className="text-xs uppercase text-primary hover:underline"
                  >
                    Edit
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
