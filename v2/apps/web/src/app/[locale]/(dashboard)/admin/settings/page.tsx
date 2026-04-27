import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import { prisma } from '@wow/db';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { upsertSettingAction } from '@/app/actions/admin-extras';

export const dynamic = 'force-dynamic';

const COMMON_SETTINGS: Array<{ key: string; label: string; description: string; type: 'text' | 'number' | 'boolean' }> = [
  { key: 'sla.warning_days', label: 'SLA warning threshold (days)', description: 'Send a warning when an open case reaches this age.', type: 'number' },
  { key: 'sla.breach_days', label: 'SLA breach threshold (days)', description: 'Mark a case as breached after this many days open.', type: 'number' },
  { key: 'duplicate.window_days', label: 'Duplicate detection window (days)', description: 'How far back to look for duplicate orders.', type: 'number' },
  { key: 'company.legal_name', label: 'Company legal name', description: 'Used in customer-facing emails.', type: 'text' },
  { key: 'company.support_email', label: 'Support email', description: 'Reply-to address on outbound customer emails.', type: 'text' },
  { key: 'feature.dark_mode', label: 'Allow dark mode', description: 'Show theme toggle in user profile.', type: 'boolean' },
  { key: 'feature.aura_sidecar', label: 'Aura sidecar', description: 'Enable Aura points return on cases.', type: 'boolean' },
];

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/');

  const all = await prisma.setting.findMany({ orderBy: { key: 'asc' } });
  const map = new Map(all.map((s) => [s.key, s.value]));

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div>
        <h1 className="text-heading-lg text-heading">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace-wide configuration. Changes apply immediately to all users.
        </p>
      </div>

      {COMMON_SETTINGS.map((s) => {
        const current = map.get(s.key) ?? '';
        return (
          <Card key={s.key}>
            <CardHeader>
              <CardTitle className="text-base">{s.label}</CardTitle>
              <CardDescription>{s.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={upsertSettingAction} className="flex items-end gap-3">
                <input type="hidden" name="key" value={s.key} />
                <div className="flex-1">
                  <label className="text-xs text-muted-foreground">Current: <span className="font-mono">{current || '(not set)'}</span></label>
                  {s.type === 'boolean' ? (
                    <select
                      name="value"
                      defaultValue={current || 'false'}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="true">Enabled</option>
                      <option value="false">Disabled</option>
                    </select>
                  ) : (
                    <input
                      type={s.type === 'number' ? 'number' : 'text'}
                      name="value"
                      defaultValue={current}
                      className="mt-1 w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
                    />
                  )}
                </div>
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
                >
                  Save
                </button>
              </form>
            </CardContent>
          </Card>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle>All settings</CardTitle>
          <CardDescription>Raw view of every key/value pair stored in the database.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-surface-subtle text-left text-caption uppercase text-muted-foreground">
              <tr>
                <th className="p-3">Key</th>
                <th className="p-3">Value</th>
                <th className="p-3">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {all.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">No settings configured yet.</td>
                </tr>
              ) : all.map((s) => (
                <tr key={s.key}>
                  <td className="p-3 font-mono text-xs">{s.key}</td>
                  <td className="p-3 text-xs">{s.value}</td>
                  <td className="p-3 text-xs text-muted-foreground">{s.updatedAt.toISOString().slice(0, 16).replace('T', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
