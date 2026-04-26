import { prisma } from '@wow/db';
import { CaseForm } from './case-form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default async function NewCasePage() {
  const [countries, brands, paymentMethods, rootCauses] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        registryCode: true,
        registry: { select: { nameEn: true, currencyCode: true } },
        branches: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, name: true },
        },
      },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, key: true, label: true, requiresAuthCode: true },
    }),
    prisma.rootCause.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">New refund case</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture customer, order, and per-payment-method refund details. The case starts as a
          draft and is sent for approval when you submit it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Case details</CardTitle>
          <CardDescription>All fields marked with * are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <CaseForm
            countries={countries.map((c) => ({
              id: c.id,
              code: c.registryCode,
              name: c.registry.nameEn,
              currency: c.registry.currencyCode,
              branches: c.branches,
            }))}
            brands={brands}
            paymentMethods={paymentMethods}
            rootCauses={rootCauses}
          />
        </CardContent>
      </Card>
    </div>
  );
}
