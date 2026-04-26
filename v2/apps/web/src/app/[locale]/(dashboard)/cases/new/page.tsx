import Link from 'next/link';
import { prisma } from '@wow/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronLeft } from 'lucide-react';
import { NewCaseForm } from './new-case-form';

export const dynamic = 'force-dynamic';

export default async function NewCasePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  const [countries, brands, branches, paymentMethods, rootCauses] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      include: { registry: true },
      orderBy: { sortOrder: 'asc' },
    }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ countryId: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.paymentMethod.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    prisma.rootCause.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm">
          <Link href={`/${locale}/cases`}>
            <ChevronLeft className="h-4 w-4" />
            Back to cases
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-heading-lg">Create refund case</CardTitle>
          <p className="text-sm text-muted-foreground">
            Enter the customer, order, and refund details. Cases start as <span className="font-mono text-xs">DRAFT</span> —
            submit for approval once reviewed.
          </p>
        </CardHeader>
        <CardContent>
          <NewCaseForm
            locale={locale}
            countries={countries.map((c) => ({
              id: c.id,
              code: c.registry.code,
              name: c.registry.nameEn,
              flag: c.registry.flag ?? '',
              currency: c.registry.currencyCode,
            }))}
            brands={brands.map((b) => ({ id: b.id, name: b.name }))}
            branches={branches.map((b) => ({
              id: b.id,
              countryId: b.countryId,
              name: b.name,
            }))}
            paymentMethods={paymentMethods.map((pm) => ({
              id: pm.id,
              key: pm.key,
              label: pm.label,
              requiresAuthCode: pm.requiresAuthCode,
            }))}
            rootCauses={rootCauses.map((r) => ({ id: r.id, name: r.label }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
