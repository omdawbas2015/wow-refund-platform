'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Pause, PlayCircle, Trash2 } from 'lucide-react';
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
  createBatchScheduleAction,
  updateBatchScheduleAction,
  toggleBatchScheduleAction,
  deleteBatchScheduleAction,
} from '@/app/actions/admin-batch-schedules';

export type CountryOption = { id: string; name: string; flag: string };

export type ScheduleRow = {
  id: string;
  type: string;
  countryId: string | null;
  countryName: string | null;
  countryFlag: string;
  cronExpr: string;
  timezone: string;
  isActive: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
};

type Type = 'APPROVAL' | 'KNET' | 'AURA';

type FormState = {
  id?: string;
  type: Type;
  countryId: string;
  cronExpr: string;
  timezone: string;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  type: 'APPROVAL',
  countryId: '',
  cronExpr: '0 17 * * *',
  timezone: 'Asia/Kuwait',
  isActive: true,
};

const TYPE_HINT: Record<Type, string> = {
  APPROVAL: 'Generates approval batches for one country.',
  KNET: 'Global KNET batch generator (no country scope).',
  AURA: 'Global Aura sidecar batch generator.',
};

export function BatchSchedulesManager({
  rows,
  countries,
}: {
  rows: ScheduleRow[];
  countries: CountryOption[];
}) {
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const requiresCountry = form.type === 'APPROVAL';

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, countryId: countries[0]?.id ?? '' });
    setEditingId(null);
    setOpenForm(true);
  };

  const openEdit = (row: ScheduleRow) => {
    setForm({
      id: row.id,
      type: row.type as Type,
      countryId: row.countryId ?? '',
      cronExpr: row.cronExpr,
      timezone: row.timezone,
      isActive: row.isActive,
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const submit = () => {
    if (form.type === 'APPROVAL' && !form.countryId) {
      toast.error('APPROVAL schedules require a country');
      return;
    }
    start(async () => {
      const result = editingId
        ? await updateBatchScheduleAction({ ...form, id: editingId })
        : await createBatchScheduleAction(form);
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success(editingId ? 'Schedule updated' : 'Schedule created');
      setOpenForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    });
  };

  const toggle = (row: ScheduleRow) => {
    start(async () => {
      const result = await toggleBatchScheduleAction({ id: row.id, isActive: !row.isActive });
      if (!result.ok) {
        toast.error(result.error ?? 'Toggle failed');
        return;
      }
      toast.success(row.isActive ? 'Schedule paused' : 'Schedule activated');
    });
  };

  const confirmDelete = (id: string) => {
    start(async () => {
      const result = await deleteBatchScheduleAction({ id });
      if (!result.ok) {
        toast.error(result.error ?? 'Delete failed');
        return;
      }
      toast.success('Schedule deleted');
      setConfirmDeleteId(null);
    });
  };

  const grouped = useMemo(() => {
    const order: Type[] = ['APPROVAL', 'KNET', 'AURA'];
    const map = new Map<Type, ScheduleRow[]>();
    for (const t of order) map.set(t, []);
    for (const r of rows) {
      const t = r.type as Type;
      if (map.has(t)) map.get(t)!.push(r);
    }
    return order.map((t) => ({ type: t, rows: map.get(t) ?? [] }));
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} size="sm" disabled={countries.length === 0}>
          <Plus className="me-1.5 h-4 w-4" />
          New schedule
        </Button>
      </div>

      {countries.length === 0 ? (
        <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm text-heading">
          Activate at least one country before adding APPROVAL schedules.
        </div>
      ) : null}

      {grouped.map((group) => (
        <div key={group.type} className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.type}
            </h3>
            <span className="text-xs text-muted-foreground">— {TYPE_HINT[group.type]}</span>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-subtle/40 text-left">
                  <Th>Country</Th>
                  <Th>Cron</Th>
                  <Th>Timezone</Th>
                  <Th>Last run</Th>
                  <Th>Next run</Th>
                  <Th>Status</Th>
                  <th className="px-3 py-2.5 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {group.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-6 text-center text-xs text-muted-foreground"
                    >
                      No {group.type} schedules yet.
                    </td>
                  </tr>
                ) : (
                  group.rows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2 text-xs">
                        {r.countryName ? (
                          <>
                            <span className="me-1">{r.countryFlag}</span>
                            {r.countryName}
                          </>
                        ) : (
                          <span className="text-muted-foreground">global</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{r.cronExpr}</td>
                      <td className="px-3 py-2 text-xs">{r.timezone}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.lastRunAt ?? <span className="italic">never</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.nextRunAt ?? <span className="italic">—</span>}
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
                          <IconBtn title="Edit" onClick={() => openEdit(r)} disabled={pending}>
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
        </div>
      ))}

      {/* Create / edit dialog */}
      <Dialog open={openForm} onOpenChange={(o) => !o && setOpenForm(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit batch schedule' : 'New batch schedule'}</DialogTitle>
            <DialogDescription>
              KNET and AURA schedules ignore the country field — they run
              globally. APPROVAL schedules require a country.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="bs-type">Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: Type) => setForm({ ...form, type: v })}
                >
                  <SelectTrigger id="bs-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVAL">APPROVAL</SelectItem>
                    <SelectItem value="KNET">KNET</SelectItem>
                    <SelectItem value="AURA">AURA</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bs-country">Country {requiresCountry ? '' : '(ignored)'}</Label>
                <Select
                  value={form.countryId}
                  onValueChange={(v) => setForm({ ...form, countryId: v })}
                  disabled={!requiresCountry}
                >
                  <SelectTrigger id="bs-country">
                    <SelectValue placeholder={requiresCountry ? 'Pick a country' : '—'} />
                  </SelectTrigger>
                  <SelectContent>
                    {countries.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.flag} {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="bs-cron">Cron (5 fields)</Label>
                <Input
                  id="bs-cron"
                  value={form.cronExpr}
                  onChange={(e) => setForm({ ...form, cronExpr: e.target.value })}
                  className="font-mono"
                  placeholder="0 17 * * *"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="bs-tz">Timezone</Label>
                <Input
                  id="bs-tz"
                  value={form.timezone}
                  onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                  placeholder="Asia/Kuwait"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                className="h-4 w-4"
              />
              Active
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

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this schedule?</DialogTitle>
            <DialogDescription>This is permanent.</DialogDescription>
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
              <Trash2 className="me-1.5 h-4 w-4" />
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
