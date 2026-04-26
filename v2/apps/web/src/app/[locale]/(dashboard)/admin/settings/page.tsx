import { redirect } from 'next/navigation';
import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from '@/i18n/routing';
import { FeatureFlagsEditor } from './feature-flags-editor';
import { SettingsEditor } from './settings-editor';

export default async function SettingsAdminPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/admin');

  const [flags, settings] = await Promise.all([
    prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
    prisma.setting.findMany({ orderBy: { key: 'asc' } }),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link href="/admin" className="text-xs uppercase text-muted-foreground hover:text-primary">
        ← Admin
      </Link>
      <h1 className="mt-2 text-display-md font-normal tracking-tight text-heading">System settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Toggle feature flags and tune system-wide configuration. All changes are audit-logged.
      </p>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Feature flags</CardTitle>
          <CardDescription>
            Turn modules on or off for the entire workspace. Disabling a flag hides
            the relevant UI entry points without removing data.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FeatureFlagsEditor
            flags={flags.map((f) => ({
              key: f.key,
              enabled: f.enabled,
              description: f.description,
              updatedAt: f.updatedAt.toISOString(),
            }))}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>System settings</CardTitle>
          <CardDescription>
            Free-form key/value pairs (JSON-encoded). Use lowercase dotted keys, e.g.{' '}
            <code className="rounded bg-surface-subtle px-1 py-0.5 text-xs">refund.daily_cutoff</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SettingsEditor
            settings={settings.map((s) => ({
              key: s.key,
              value: s.value,
              description: s.description,
              updatedAt: s.updatedAt.toISOString(),
              updatedBy: s.updatedBy,
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
