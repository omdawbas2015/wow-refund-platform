import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Server,
  Database,
  Globe,
  Mail,
  Clock,
  Cpu,
  Package,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * Admin-only system info page.
 *
 * Surfaces the runtime metadata an on-call engineer typically needs in
 * the first 30 seconds of an incident:
 *   - which build are we on (commit + build time)
 *   - which environment / NODE_ENV / region we resolved to
 *   - which DB the app is talking to (URL host, latest migration row)
 *   - whether the cron secret + email webhook are configured
 *   - aggregate row counts (cases, users, batches, audit logs)
 *
 * Everything is read-only and never echoes a full secret value back to
 * the page. We only show "configured / not configured" booleans for
 * sensitive env vars and a redacted host portion of DATABASE_URL so the
 * page is safe to share on a video call.
 */
export default async function SystemInfoPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const [caseCount, userCount, batchCount, auditCount, latestMigration] = await Promise.all([
    prisma.refundCase.count(),
    prisma.user.count(),
    prisma.knetBatch.count(),
    prisma.auditLog.count(),
    // _prisma_migrations is the canonical source of "what schema is
    // live on this database". Falls back gracefully if the raw query
    // fails (e.g. a fresh dev DB without the table yet).
    prisma
      .$queryRawUnsafe<{ migration_name: string; finished_at: Date | null }[]>(
        'SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 1',
      )
      .catch(() => [] as { migration_name: string; finished_at: Date | null }[]),
  ]);

  const latest = latestMigration[0];

  // Redact DATABASE_URL: keep protocol + host + db name only. Never show
  // password or full connection string on a UI an admin might screen-share.
  const dbUrl = process.env['DATABASE_URL'] ?? '';
  const dbDisplay = redactDbUrl(dbUrl);
  const dbDriver = dbUrl.startsWith('file:')
    ? 'SQLite'
    : dbUrl.startsWith('postgres')
      ? 'PostgreSQL'
      : dbUrl
        ? 'Unknown'
        : 'Unconfigured';

  // Configuration flags — booleans only. Never the secret values.
  const cronConfigured = Boolean(process.env['CRON_SECRET']);
  const powerAutomateConfigured = Boolean(process.env['POWER_AUTOMATE_WEBHOOK_URL']);
  const sentryConfigured = Boolean(process.env['SENTRY_DSN']);

  // Build / deploy metadata. Vercel injects VERCEL_GIT_COMMIT_SHA and
  // VERCEL_ENV on every build; outside Vercel we fall back to gracefully
  // labelled "unknown" so the page never crashes locally.
  const commitSha =
    process.env['VERCEL_GIT_COMMIT_SHA'] ??
    process.env['GIT_COMMIT'] ??
    null;
  const buildTime = process.env['BUILD_TIME'] ?? null;
  const deployRegion = process.env['VERCEL_REGION'] ?? process.env['AWS_REGION'] ?? null;
  const deployEnv = process.env['VERCEL_ENV'] ?? process.env['NODE_ENV'] ?? 'unknown';

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-display-md font-normal tracking-tight text-heading">
          System info
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Build, environment, and configuration snapshot. Read-only.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Server className="h-4 w-4" />
            Build
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="Environment"
              value={<Badge variant="secondary">{deployEnv}</Badge>}
            />
            <Row
              label="Commit"
              value={commitSha ? <code className="text-xs">{commitSha.slice(0, 12)}</code> : '—'}
            />
            <Row
              label="Build time"
              value={buildTime ?? '—'}
            />
            <Row label="Region" value={deployRegion ?? '—'} />
            <Row label="Node" value={process.version} />
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Database className="h-4 w-4" />
            Database
          </h2>
          <dl className="space-y-2 text-sm">
            <Row label="Driver" value={dbDriver} />
            <Row
              label="Connection"
              value={<code className="text-xs">{dbDisplay}</code>}
            />
            <Row
              label="Latest migration"
              value={latest?.migration_name ?? '—'}
            />
            <Row
              label="Migrated at"
              value={latest?.finished_at ? formatDateTime(latest.finished_at) : '—'}
            />
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Globe className="h-4 w-4" />
            Integrations
          </h2>
          <dl className="space-y-2 text-sm">
            <Row
              label="CRON_SECRET"
              value={<ConfigBadge ok={cronConfigured} />}
            />
            <Row
              label="Power Automate webhook"
              value={<ConfigBadge ok={powerAutomateConfigured} />}
            />
            <Row label="Sentry DSN" value={<ConfigBadge ok={sentryConfigured} />} />
            <Row
              label="Mail dispatcher"
              value={powerAutomateConfigured ? 'Power Automate' : 'Dev stub'}
            />
          </dl>
        </Card>

        <Card className="p-4">
          <h2 className="mb-3 inline-flex items-center gap-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            <Cpu className="h-4 w-4" />
            Workload
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Cases" value={caseCount} icon={<Mail className="h-4 w-4" />} />
            <Stat label="Users" value={userCount} icon={<Server className="h-4 w-4" />} />
            <Stat label="KNET batches" value={batchCount} icon={<Package className="h-4 w-4" />} />
            <Stat label="Audit events" value={auditCount} icon={<Clock className="h-4 w-4" />} />
          </div>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-surface-subtle p-3">
      <div className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-light">{value.toLocaleString()}</div>
    </div>
  );
}

function ConfigBadge({ ok }: { ok: boolean }) {
  return (
    <Badge variant={ok ? 'success' : 'secondary'}>
      {ok ? 'configured' : 'not set'}
    </Badge>
  );
}

/**
 * Strip credentials and query parameters from a connection string so we
 * can show "where is this app connected to?" without leaking the
 * password. Falls back to '—' for unconfigured environments and to a
 * coarse 'sqlite (local file)' label for SQLite, since the file path is
 * rarely useful and may include the user's home directory.
 */
function redactDbUrl(raw: string): string {
  if (!raw) return '—';
  if (raw.startsWith('file:')) return 'sqlite (local file)';
  try {
    const u = new URL(raw);
    const dbName = u.pathname.replace(/^\//, '');
    const host = u.hostname || '(unknown host)';
    const port = u.port ? `:${u.port}` : '';
    return `${u.protocol}//${host}${port}/${dbName || '(unknown db)'}`;
  } catch {
    return '(unparseable connection string)';
  }
}
