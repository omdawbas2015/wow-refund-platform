import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default async function EmailTemplatesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const templates = await prisma.emailTemplate.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }, { locale: 'asc' }],
  });

  // Group by (category, key) so EN/AR appear together.
  type Row = { key: string; category: string; subjectEn?: string; subjectAr?: string; isActiveEn?: boolean; isActiveAr?: boolean };
  const grouped = new Map<string, Row>();
  for (const t of templates) {
    const k = `${t.category}::${t.key}`;
    const row = grouped.get(k) ?? { key: t.key, category: t.category };
    if (t.locale === 'ar') {
      row.subjectAr = t.subject;
      row.isActiveAr = t.isActive;
    } else {
      row.subjectEn = t.subject;
      row.isActiveEn = t.isActive;
    }
    grouped.set(k, row);
  }

  const byCategory = [...grouped.values()].reduce<Record<string, Row[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Email Templates</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Templated outbound emails. Variables in <code className="rounded bg-surface-subtle px-1 py-0.5 text-xs">{'{{double_curly}}'}</code> are substituted at send time. Each template has separate EN/AR rows.
        </p>
      </div>
      {Object.entries(byCategory).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle>{cat}</CardTitle>
            <CardDescription>{items.length} template{items.length === 1 ? '' : 's'}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
                <tr>
                  <th className="p-3">Key</th>
                  <th className="p-3">Subject (EN)</th>
                  <th className="p-3">Locales</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((t) => (
                  <tr key={t.key}>
                    <td className="p-3 font-mono text-xs">{t.key}</td>
                    <td className="p-3 font-medium">{t.subjectEn ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="p-3 text-xs text-muted-foreground">
                      {[t.subjectEn ? 'EN' : null, t.subjectAr ? 'AR' : null].filter(Boolean).join(' · ')}
                    </td>
                    <td className="p-3">
                      <Badge variant={(t.isActiveEn || t.isActiveAr) ? 'success' : 'secondary'}>
                        {(t.isActiveEn || t.isActiveAr) ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
