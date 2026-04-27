import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { BatchSchedulesManager, type ScheduleRow, type CountryOption } from './manager';

export const dynamic = 'force-dynamic';

export default async function BatchSchedulesAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [countries, schedules] = await Promise.all([
    prisma.country.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { registry: true },
    }),
    prisma.batchSchedule.findMany({
      orderBy: [{ isActive: 'desc' }, { type: 'asc' }, { createdAt: 'desc' }],
    }),
  ]);

  const countryById = new Map(countries.map((c) => [c.id, c] as const));

  const countryOptions: CountryOption[] = countries.map((c) => ({
    id: c.id,
    name: c.registry.nameEn,
    flag: c.registry.flag ?? '',
  }));

  const rows: ScheduleRow[] = schedules.map((s) => {
    const country = s.countryId ? countryById.get(s.countryId) : null;
    return {
      id: s.id,
      type: s.type,
      countryId: s.countryId,
      countryName: country ? country.registry.nameEn : null,
      countryFlag: country ? country.registry.flag ?? '' : '',
      cronExpr: s.cronExpr,
      timezone: s.timezone,
      isActive: s.isActive,
      lastRunAt: s.lastRunAt ? formatDateTime(s.lastRunAt) : null,
      nextRunAt: s.nextRunAt ? formatDateTime(s.nextRunAt) : null,
    };
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-heading-lg text-heading">Batch schedules</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cron-driven generation of approval / KNET / Aura batches. APPROVAL
            schedules are scoped to a country; KNET and AURA are global.
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {rows.filter((r) => r.isActive).length} active · {rows.length} total
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Schedules</CardTitle>
          <CardDescription>
            Pause / edit / delete from this page. Cron uses 5 fields,
            e.g. <code>0 17 * * *</code> for 17:00 every day.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BatchSchedulesManager rows={rows} countries={countryOptions} />
        </CardContent>
      </Card>
    </div>
  );
}
