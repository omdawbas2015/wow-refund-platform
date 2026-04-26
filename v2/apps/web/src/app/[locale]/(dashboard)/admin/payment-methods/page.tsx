import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { PaymentMethodsEditor } from './editor';

export default async function PaymentMethodsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const methods = await prisma.paymentMethod.findMany({
    orderBy: [{ sortOrder: 'asc' }, { key: 'asc' }],
  });

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">Payment methods</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Methods that can be selected on a refund component. KNET-style methods require an
        authorization code; BATCH execution methods participate in finance batches.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Methods</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodsEditor
            methods={methods.map((m) => ({
              id: m.id,
              key: m.key,
              label: m.label,
              labelAr: m.labelAr,
              iconSlug: m.iconSlug,
              iconUrl: m.iconUrl,
              color: m.color,
              requiresAuthCode: m.requiresAuthCode,
              executionType: m.executionType as 'MANUAL' | 'BATCH',
              isActive: m.isActive,
              sortOrder: m.sortOrder,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
