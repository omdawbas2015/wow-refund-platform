import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { AllocatePromoForm, type PoolOption } from './allocate-form';

const ALLOCATE_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT', 'TEAM_LEAD']);

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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/promo`}>
            <ArrowLeft className="h-4 w-4" />
            <span>Back to promos</span>
          </Link>
        </Button>
      </div>
      <div>
        <h1 className="text-2xl font-semibold text-heading">Allocate promo</h1>
        <p className="text-sm text-muted-foreground">
          Send a promo code to a customer or issue a service-recovery code internally. We'll flag any
          recent promos this customer already received.
        </p>
      </div>
      <AllocatePromoForm pools={poolOptions} />
    </div>
  );
}
