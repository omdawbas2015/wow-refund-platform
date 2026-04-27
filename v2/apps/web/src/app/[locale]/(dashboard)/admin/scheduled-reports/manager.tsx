'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Plus,
  Pencil,
  Play,
  Trash2,
  Pause,
  PowerOff,
  PlayCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  createScheduledReportAction,
  updateScheduledReportAction,
  deleteScheduledReportAction,
  toggleScheduledReportAction,
  runScheduledReportNowAction,
} from '@/app/actions/scheduled-reports';

export interface ScheduledReportRowView {
  id: string;
  name: string;
  cronExpr: string;
  timezone: string;
  scope: string;
  filters: string;
  recipients: string;
  format: string;
  isActive: boolean;
  lastRunAt: string | null;
  createdAt: string;
}

type FormState = {
  id?: string;
  name: string;
  cronExpr: string;
  timezone: string;
  scope: 'DASHBOARD' | 'CASES' | 'PROMOS';
  filters: string;
  recipients: string;
  format: 'XLSX' | 'PDF';
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  cronExpr: '0 8 * * 1-5',
  timezone: 'Asia/Kuwait',
  scope: 'DASHBOARD',
  filters: '{}',
  recipients: '',
  format: 'XLSX',
  isActive: true,
};

export function ScheduledReportsManager({ rows }: { rows: ScheduledReportRowView[] }) {
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setOpenForm(true);
  };

  const openEdit = (row: ScheduledReportRowView) => {
    setForm({
      id: row.id,
      name: row.name,
      cronExpr: row.cronExpr,
      timezone: row.timezone,
      scope: row.scope as FormState['scope'],
      filters: row.filters,
      recipients: row.recipients,
      format: row.format as FormState['format'],
      isActive: row.isActive,
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const submit = () => {
    start(async () => {
      const result = editingId
        ? await updateScheduledReportAction({ ...form, id: editingId })
        : await createScheduledReportAction(form);
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success(editingId ? 'Report updated' : 'Report created');
      setOpenForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    });
  };

  const toggle = (row: ScheduledReportRowView) => {
    start(async () => {
      const result = await toggleScheduledReportAction({ id: row.id, isActive: !row.isActive });
      if (!result.ok) {
        toast.error(result.error ?? 'Toggle failed');
        return;
      }
      toast.success(row.isActive ? 'Report paused' : 'Report activated');
    });
  };

  const runNow = (row: ScheduledReportRowView) => {
    start(async () => {
      const result = await runScheduledReportNowAction({ id: row.id });
      if (!result.ok) {
        toast.error(result.error ?? 'Run failed');
        return;
      }
      const { rows: rowsCount, delivered, failed } = result.data;
      if (failed === 0) {
        toast.success(`Ran "${row.name}": ${delivered} email${delivered === 1 ? '' : 's'} sent · ${rowsCount} rows summarised`);
      } else {
        toast.warning(`Ran "${row.name}": ${delivered} delivered · ${failed} failed`);
      }
    });
  };

  const confirmDelete = (id: string) => {
    start(async () => {
      const result = await deleteScheduledReportAction({ id });
      if (!result.ok) {
        toast.error(result.error ?? 'Delete failed');
        return;
      }
      toast.success('Report deleted');
      setConfirmDeleteId(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="me-1.5 h-4 w-4" />
          New report
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40 text-left">
              <Th>Name</Th>
              <Th>Schedule</Th>
              <Th>Scope</Th>
              <Th>Recipients</Th>
              <Th>Last run</Th>
              <Th>Status</Th>
              <th className="px-3 py-2.5 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No scheduled reports yet. Click{' '}
                  <span className="font-medium text-heading">New report</span> to add one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="font-medium text-heading">{r.name}</div>
                    <div className="text-xs text-muted-foreground">Created {r.createdAt}</div>
                  </td>
                  <td className="px-3 py-2">
                    <code className="text-xs">{r.cronExpr}</code>
                    <div className="text-xs text-muted-foreground">{r.timezone}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {r.scope}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <div className="max-w-[220px] truncate" title={r.recipients}>
                      {r.recipients}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.lastRunAt ?? <span className="italic">never</span>}
                  </td>
                  <td className="px-3 py-2">
                    {r.isActive ? (
                      <Badge variant="success" className="text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Paused
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn
                        title="Run now"
                        onClick={() => runNow(r)}
                        disabled={pending}
                      >
                        <Play className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title={r.isActive ? 'Pause' : 'Activate'}
                        onClick={() => toggle(r)}
                        disabled={pending}
                      >
                        {r.isActive ? (
                          <Pause className="h-3.5 w-3.5" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5" />
                        )}
                      </IconBtn>
                      <IconBtn
                        title="Edit"
                        onClick={() => openEdit(r)}
                        disabled={pending}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        title="Delete"
                        onClick={() => setConfirmDeleteId(r.id)}
                        disabled={pending}
                        variant="destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create / edit dialog */}
      <Dialog open={openForm} onOpenChange={(o) => !o && setOpenForm(false)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit scheduled report' : 'New scheduled report'}</DialogTitle>
            <DialogDescription>
              All fields run as UTC. Filters are an optional JSON object
              forwarded to the report builder.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="sr-name">Name</Label>
              <Input
                id="sr-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Daily ops snapshot"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sr-cron">Cron (5 fields)</Label>
                <Input
                  id="sr-cron"
                  value={form.cronExpr}
                  onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
                  className="font-mono"
                  placeholder="0 8 * * 1-5"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sr-tz">Timezone</Label>
                <Input
                  id="sr-tz"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="Asia/Kuwait"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="sr-scope">Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v: FormState['scope']) => setForm({ ...form, scope: v })}
                >
                  <SelectTrigger id="sr-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DASHBOARD">Dashboard snapshot</SelectItem>
                    <SelectItem value="CASES">Refund cases</SelectItem>
                    <SelectItem value="PROMOS">Promo codes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="sr-format">Format</Label>
                <Select
                  value={form.format}
                  onValueChange={(v: FormState['format']) => setForm({ ...form, format: v })}
                >
                  <SelectTrigger id="sr-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XLSX">XLSX</SelectItem>
                    <SelectItem value="PDF">PDF</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sr-filters">Filters (JSON)</Label>
              <Input
                id="sr-filters"
                value={form.filters}
                onChange={(e) => setForm({ ...form, filters: e.target.value })}
                className="font-mono text-xs"
                placeholder='{"countryId":"…","fromDays":7}'
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="sr-recipients">Recipients (comma-separated)</Label>
              <Input
                id="sr-recipients"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                placeholder="ops@wow.local, finance@wow.local"
              />
            </div>
            <label className="mt-1 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              Active (cron will run this report)
            </label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenForm(false)} disabled={pending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={pending}>
              {pending ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this scheduled report?</DialogTitle>
            <DialogDescription>
              This is permanent. Past audit-log entries are retained.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDeleteId(null)} disabled={pending}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId && confirmDelete(confirmDeleteId)}
              disabled={pending}
            >
              <PowerOff className="me-1.5 h-4 w-4" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2.5 text-start text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}

function IconBtn({
  children,
  title,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'destructive';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={`inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-heading transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50 ${
        variant === 'destructive' ? 'hover:border-destructive/50 hover:text-destructive' : ''
      }`}
    >
      {children}
    </button>
  );
}
