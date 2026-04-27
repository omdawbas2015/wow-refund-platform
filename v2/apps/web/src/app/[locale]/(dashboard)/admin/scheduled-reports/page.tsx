import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { ScheduledReportsManager } from './manager';

export const dynamic = 'force-dynamic';

export default async function ScheduledReportsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const reports = await prisma.scheduledReport.findMany({
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
  });

  const rows = reports.map((r) => ({
    id: r.id,
    name: r.name,
    cronExpr: r.cronExpr,
    timezone: r.timezone,
    scope: r.scope,
    filters: r.filters,
    recipients: r.recipients,
    format: r.format,
    isActive: r.isActive,
    lastRunAt: r.lastRunAt ? formatDateTime(r.lastRunAt) : null,
    createdAt: formatDateTime(r.createdAt),
  }));

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-heading-lg text-heading">Scheduled Reports</h1>
          <Badge variant="outline" className="text-xs">
            {rows.filter((r) => r.isActive).length} active · {rows.length} total
          </Badge>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Runs an aggregated email summary on a schedule. Cron uses 5 fields (UTC),
          e.g. <code>0 8 * * 1-5</code> for 08:00 weekdays. The cron sweep at
          <code className="mx-1">/api/cron/scheduled-reports</code> picks up due
          reports — schedule it externally (Vercel Cron is configured at every 5 min).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reports</CardTitle>
          <CardDescription>
            Pause/resume, edit, run-on-demand, or remove.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScheduledReportsManager rows={rows} />
        </CardContent>
      </Card>
    </div>
  );
}
