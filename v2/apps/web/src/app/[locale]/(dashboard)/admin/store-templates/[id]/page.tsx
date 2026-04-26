import { redirect, notFound } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { TemplateEditor } from './editor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StoreTemplateEditorPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const { id } = await params;
  const isNew = id === 'new';

  const template = isNew
    ? null
    : await prisma.storeMessageTemplate.findUnique({ where: { id } });
  if (!isNew && !template) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/admin/store-templates"
        className="text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Store templates
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">
        {isNew ? 'New template' : template?.label}
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Subject and body support <code>{'{{caseNumber}}'}</code> and <code>{'{{note}}'}</code>.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Template</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateEditor template={template} />
        </CardContent>
      </Card>
    </div>
  );
}
