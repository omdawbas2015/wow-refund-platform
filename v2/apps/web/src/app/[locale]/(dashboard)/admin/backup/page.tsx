import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDateTime } from '@/lib/format';
import { BackupSettingsForm } from './form';

export const dynamic = 'force-dynamic';

export default async function BackupAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [settings, logs] = await Promise.all([
    prisma.backupSettings.findUnique({ where: { id: 'singleton' } }),
    prisma.backupLog.findMany({ orderBy: { startedAt: 'desc' }, take: 25 }),
  ]);

  const initial = {
    enabled: settings?.enabled ?? false,
    cronExpr: settings?.cronExpr ?? '0 2 * * *',
    timezone: settings?.timezone ?? 'Asia/Kuwait',
    retentionDays: settings?.retentionDays ?? 30,
    destination: (settings?.destination ?? 'local') as 'local' | 's3' | 'gcs',
    destinationPath: settings?.destinationPath ?? '',
    notifyEmail: settings?.notifyEmail ?? '',
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Backup</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure automated database snapshots and retention. Manual backups
          can be triggered any time and are recorded in the run history.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Last updated{' '}
            {settings?.updatedAt ? formatDateTime(settings.updatedAt) : 'never'}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <BackupSettingsForm initial={initial} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent runs</CardTitle>
          <CardDescription>Last 25 backup attempts.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle/40 text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2.5">Trigger</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Destination</th>
                <th className="px-3 py-2.5">Started</th>
                <th className="px-3 py-2.5">Finished</th>
                <th className="px-3 py-2.5">Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    No backups recorded yet.
                  </td>
                </tr>
              ) : (
                logs.map((l) => (
                  <tr key={l.id}>
                    <td className="px-3 py-2 text-xs">
                      <Badge variant="outline" className="text-[10px]">
                        {l.trigger}
                      </Badge>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge status={l.status} />
                      {l.failureReason ? (
                        <div
                          className="line-clamp-1 max-w-md text-xs text-destructive"
                          title={l.failureReason}
                        >
                          {l.failureReason}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{l.destination}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {formatDateTime(l.startedAt)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {l.finishedAt ? formatDateTime(l.finishedAt) : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs tabular-nums text-muted-foreground">
                      {l.sizeBytes ? formatBytes(Number(l.sizeBytes)) : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant: 'success' | 'secondary' | 'destructive' =
    status === 'SUCCESS' ? 'success' : status === 'FAILED' ? 'destructive' : 'secondary';
  return (
    <Badge variant={variant} className="text-[10px]">
      {status}
    </Badge>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
