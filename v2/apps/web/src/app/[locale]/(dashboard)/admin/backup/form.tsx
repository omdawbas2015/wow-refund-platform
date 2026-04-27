'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Save, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  saveBackupSettingsAction,
  triggerManualBackupAction,
} from '@/app/actions/admin-backup-settings';

export type BackupFormState = {
  enabled: boolean;
  cronExpr: string;
  timezone: string;
  retentionDays: number;
  destination: 'local' | 's3' | 'gcs';
  destinationPath: string;
  notifyEmail: string;
};

const DESTINATION_HINT: Record<BackupFormState['destination'], string> = {
  local: 'Local filesystem path on the server (e.g. /var/backups/wow).',
  s3: 'S3 URI (e.g. s3://wow-backups/prod). Requires AWS credentials in env.',
  gcs: 'GCS URI (e.g. gs://wow-backups/prod). Requires GCS credentials in env.',
};

export function BackupSettingsForm({ initial }: { initial: BackupFormState }) {
  const [pending, start] = useTransition();
  const [running, startRun] = useTransition();
  const [form, setForm] = useState<BackupFormState>(initial);

  const save = () => {
    start(async () => {
      const result = await saveBackupSettingsAction(form);
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success('Backup settings saved');
    });
  };

  const runNow = () => {
    startRun(async () => {
      const result = await triggerManualBackupAction();
      if (!result.ok) {
        toast.error(result.error ?? 'Run failed');
        return;
      }
      toast.success('Manual backup triggered');
    });
  };

  return (
    <div className="space-y-4">
      <label className="flex items-start gap-3 rounded-md border border-border bg-surface-subtle/30 p-3">
        <input
          type="checkbox"
          checked={form.enabled}
          onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
          className="mt-0.5 h-4 w-4"
        />
        <div className="text-sm">
          <div className="font-medium text-heading">Enable scheduled backups</div>
          <div className="text-xs text-muted-foreground">
            When off, only manual backups run. Existing run history is preserved.
          </div>
        </div>
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="bk-cron">Cron (5 fields)</Label>
          <Input
            id="bk-cron"
            value={form.cronExpr}
            onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
            placeholder="0 2 * * *"
            className="font-mono"
            disabled={!form.enabled}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bk-tz">Timezone</Label>
          <Input
            id="bk-tz"
            value={form.timezone}
            onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            placeholder="Asia/Kuwait"
            disabled={!form.enabled}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bk-retention">Retention (days)</Label>
          <Input
            id="bk-retention"
            type="number"
            min={1}
            max={3650}
            value={form.retentionDays}
            onChange={(e) =>
              setForm({ ...form, retentionDays: parseInt(e.target.value || '0', 10) })
            }
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="bk-dest">Destination</Label>
          <Select
            value={form.destination}
            onValueChange={(v: BackupFormState['destination']) =>
              setForm({ ...form, destination: v })
            }
          >
            <SelectTrigger id="bk-dest">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="local">Local filesystem</SelectItem>
              <SelectItem value="s3">Amazon S3</SelectItem>
              <SelectItem value="gcs">Google Cloud Storage</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 grid gap-1.5">
          <Label htmlFor="bk-path">Destination path</Label>
          <Input
            id="bk-path"
            value={form.destinationPath}
            onChange={(e) => setForm({ ...form, destinationPath: e.target.value })}
            placeholder="/var/backups/wow"
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">{DESTINATION_HINT[form.destination]}</p>
        </div>
        <div className="sm:col-span-2 grid gap-1.5">
          <Label htmlFor="bk-email">Notify on failure (email)</Label>
          <Input
            id="bk-email"
            type="email"
            value={form.notifyEmail}
            onChange={(e) => setForm({ ...form, notifyEmail: e.target.value })}
            placeholder="ops@wow.local"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-2">
        <Button onClick={save} disabled={pending}>
          <Save className="me-1.5 h-4 w-4" />
          {pending ? 'Saving…' : 'Save settings'}
        </Button>
        <Button variant="outline" onClick={runNow} disabled={running}>
          <PlayCircle className="me-1.5 h-4 w-4" />
          {running ? 'Running…' : 'Run backup now'}
        </Button>
      </div>
    </div>
  );
}
