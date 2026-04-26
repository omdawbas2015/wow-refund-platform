import { notFound, redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { Badge } from '@/components/ui/badge';
import { TemplateEditor } from './editor';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EmailTemplateDetailPage({ params }: PageProps) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const template = await prisma.emailTemplate.findUnique({ where: { id } });
  if (!template) notFound();

  let placeholders: string[] = [];
  if (template.placeholders) {
    try {
      const parsed = JSON.parse(template.placeholders);
      if (Array.isArray(parsed)) placeholders = parsed;
    } catch {
      placeholders = [];
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/admin/email-templates"
        className="text-xs uppercase text-muted-foreground hover:text-primary"
      >
        ← Email templates
      </Link>
      <h1 className="mt-2 flex items-center gap-2 text-display-md font-normal tracking-tight text-heading">
        {template.key}
        <Badge variant="outline">{template.locale}</Badge>
        {!template.isActive ? <Badge variant="secondary">Inactive</Badge> : null}
      </h1>
      {template.description ? (
        <p className="mt-1 text-sm text-muted-foreground">{template.description}</p>
      ) : null}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Edit</CardTitle>
        </CardHeader>
        <CardContent>
          <TemplateEditor
            templateId={template.id}
            initial={{
              subject: template.subject,
              body: template.body,
              description: template.description,
              isActive: template.isActive,
            }}
            placeholders={placeholders}
          />
        </CardContent>
      </Card>
    </div>
  );
}
