import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { History, Settings2 } from 'lucide-react';
import { AllocatePromoForm, type PoolOption } from './allocate-form';

const ALLOCATE_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT', 'TEAM_LEAD']);
const POOL_MANAGEMENT_ROLES = new Set(['ADMIN', 'MANAGER', 'OPERATIONS']);

export const dynamic = 'force-dynamic';

export default async function AllocatePromoPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/login`);
  if (!ALLOCATE_ROLES.has(session.user.role ?? '')) redirect(`/${locale}/promo`);

  const pools = await prisma.promoConfig.findMany({
    where: { isActive: true },
    include: {
      brand: { select: { id: true, name: true } },
      country: {
        include: { registry: { select: { nameEn: true, flag: true } } },
      },
      codes: {
        where: {
          status: 'AVAILABLE',
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: { id: true },
      },
    },
    orderBy: [
      { country: { sortOrder: 'asc' } },
      { brand: { sortOrder: 'asc' } },
      { type: 'asc' },
      { value: 'asc' },
    ],
  });

  const poolOptions: PoolOption[] = pools.map((p) => ({
    id: p.id,
    brandId: p.brandId,
    brandName: p.brand.name,
    countryId: p.countryId,
    countryName: p.country.registry?.nameEn ?? p.country.registryCode,
    countryFlag: p.country.registry?.flag ?? '',
    type: p.type as 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY',
    value: p.value,
    currency: p.currency,
    available: p.codes.length,
  }));

  const canManagePools = POOL_MANAGEMENT_ROLES.has(session.user.role ?? '');

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <div>
          <h1 className="text-2xl font-semibold text-heading">Allocate promo</h1>
          <p className="text-sm text-muted-foreground">
            Send a promo code to a customer or issue a service-recovery code internally. We'll flag
            any recent promos this customer already received.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/promo/history`}>
              <History className="h-4 w-4" />
              <span>History</span>
            </Link>
          </Button>
          {canManagePools && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/${locale}/promo`}>
                <Settings2 className="h-4 w-4" />
                <span>Manage pools</span>
              </Link>
            </Button>
          )}
        </div>
      </div>
      <AllocatePromoForm pools={poolOptions} />
    </div>
  );
}
