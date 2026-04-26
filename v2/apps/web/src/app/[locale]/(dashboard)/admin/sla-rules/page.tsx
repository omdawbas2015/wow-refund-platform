import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { SlaRulesEditor } from './sla-rules-editor';

export default async function SlaRulesPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [rules, countries, brands, rootCauses] = await Promise.all([
    prisma.slaRule.findMany({ orderBy: [{ isActive: 'desc' }, { name: 'asc' }] }),
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        registryCode: true,
        registry: { select: { nameEn: true } },
      },
    }),
    prisma.brand.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      select: { id: true, name: true },
    }),
    prisma.rootCause.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, label: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">SLA rules</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Set how long a refund case may sit before it is breached. Rules are matched most-specific
        first (country + brand + root cause), with global rules as fallbacks.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Rules ({rules.length})</CardTitle>
          <CardDescription>
            Threshold is total hours from creation to a terminal status. Warning is when the
            visual SLA badge starts trending toward breach.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SlaRulesEditor
            rules={rules.map((r) => ({
              id: r.id,
              name: r.name,
              countryId: r.countryId,
              brandId: r.brandId,
              rootCauseId: r.rootCauseId,
              thresholdHours: r.thresholdHours,
              warningHours: r.warningHours,
              escalateToRole: r.escalateToRole,
              isActive: r.isActive,
            }))}
            countries={countries.map((c) => ({
              id: c.id,
              name: c.registry.nameEn,
              code: c.registryCode,
            }))}
            brands={brands}
            rootCauses={rootCauses.map((rc) => ({ id: rc.id, name: rc.label }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
