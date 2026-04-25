import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { PaymentMethodsAdmin } from './payment-methods-admin';

export default async function PaymentMethodsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const methods = await prisma.paymentMethod.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { components: true } } },
  });

  const rows = methods.map((m) => ({
    id: m.id,
    key: m.key,
    label: m.label,
    labelAr: m.labelAr,
    iconSlug: m.iconSlug,
    color: m.color,
    requiresAuthCode: m.requiresAuthCode,
    executionType: m.executionType,
    isActive: m.isActive,
    sortOrder: m.sortOrder,
    usageCount: m._count.components,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-heading-lg text-heading">Payment Methods</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage available payment gateways. Methods in use cannot be deleted, only deactivated.
          </p>
        </div>
      </div>
      <PaymentMethodsAdmin methods={rows} />
    </div>
  );
}
