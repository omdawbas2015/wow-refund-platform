import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { RootCausesEditor } from './editor';

export default async function RootCausesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const rootCauses = await prisma.rootCause.findMany({
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Root causes</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Available reasons agents can attach to a refund case. Used in reports.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Causes</CardTitle>
        </CardHeader>
        <CardContent>
          <RootCausesEditor
            rootCauses={rootCauses.map((r) => ({
              id: r.id,
              key: r.key,
              label: r.label,
              labelAr: r.labelAr,
              category: r.category,
              requiresEvidence: r.requiresEvidence,
              isActive: r.isActive,
              sortOrder: r.sortOrder,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
