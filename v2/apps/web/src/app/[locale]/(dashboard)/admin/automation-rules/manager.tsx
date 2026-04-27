'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Pause, PlayCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
  createAutomationRuleAction,
  updateAutomationRuleAction,
  toggleAutomationRuleAction,
  deleteAutomationRuleAction,
} from '@/app/actions/admin-automation-rules';

export type RuleRow = {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  conditions: string;
  actions: string;
  priority: number;
  isActive: boolean;
  updatedAt: string;
};

type Scope = 'CASE' | 'PROMO' | 'BATCH';

type FormState = {
  id?: string;
  name: string;
  description: string;
  scope: Scope;
  conditions: string;
  actions: string;
  priority: number;
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  scope: 'CASE',
  conditions: '{\n  "amount": { "gte": 5000 }\n}',
  actions: '{\n  "requireApprovalRole": "MANAGER"\n}',
  priority: 100,
  isActive: true,
};

const SCOPE_HINT: Record<Scope, string> = {
  CASE: 'Evaluated when a refund case is created or transitions state.',
  PROMO: 'Evaluated when a promo code is allocated or refunded.',
  BATCH: 'Evaluated when an approval / KNET / Aura batch is generated.',
};

function prettyJson(raw: string) {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

export function AutomationRulesManager({ rows }: { rows: RuleRow[] }) {
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setOpenForm(true);
  };

  const openEdit = (row: RuleRow) => {
    setForm({
      id: row.id,
      name: row.name,
      description: row.description ?? '',
      scope: row.scope as Scope,
      conditions: prettyJson(row.conditions),
      actions: prettyJson(row.actions),
      priority: row.priority,
      isActive: row.isActive,
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const submit = () => {
    start(async () => {
      const result = editingId
        ? await updateAutomationRuleAction({ ...form, id: editingId })
        : await createAutomationRuleAction(form);
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success(editingId ? 'Rule updated' : 'Rule created');
      setOpenForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
    });
  };

  const toggle = (row: RuleRow) => {
    start(async () => {
      const result = await toggleAutomationRuleAction({
        id: row.id,
        isActive: !row.isActive,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Toggle failed');
        return;
      }
      toast.success(row.isActive ? 'Rule paused' : 'Rule activated');
    });
  };

  const confirmDelete = (id: string) => {
    start(async () => {
      const result = await deleteAutomationRuleAction({ id });
      if (!result.ok) {
        toast.error(result.error ?? 'Delete failed');
        return;
      }
      toast.success('Rule deleted');
      setConfirmDeleteId(null);
    });
  };

  const preview = rows.find((r) => r.id === previewId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={openCreate} size="sm">
          <Plus className="me-1.5 h-4 w-4" />
          New rule
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40 text-left">
              <Th>Name</Th>
              <Th>Scope</Th>
              <Th>Priority</Th>
              <Th>Updated</Th>
              <Th>Status</Th>
              <th className="px-3 py-2.5 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No automation rules yet. Click <span className="font-medium text-heading">New rule</span> to add one.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setPreviewId(r.id)}
                      className="font-medium text-heading hover:underline"
                    >
                      {r.name}
                    </button>
                    {r.description ? (
                      <div className="line-clamp-1 max-w-md text-xs text-muted-foreground">
                        {r.description}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="outline" className="font-mono text-[10px]">
                      {r.scope}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.priority}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{r.updatedAt}</td>
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

      {/* Create / edit dialog */}
      <Dialog open={openForm} onOpenChange={(o) => !o && setOpenForm(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit rule' : 'New rule'}</DialogTitle>
            <DialogDescription>{SCOPE_HINT[form.scope]}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 grid gap-1.5">
                <Label htmlFor="ar-name">Name</Label>
                <Input
                  id="ar-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Senior approval for high-value refunds"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="ar-priority">Priority</Label>
                <Input
                  id="ar-priority"
                  type="number"
                  min={0}
                  value={form.priority}
                  onChange={(e) =>
                    setForm({ ...form, priority: parseInt(e.target.value || '0', 10) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ar-scope">Scope</Label>
                <Select
                  value={form.scope}
                  onValueChange={(v: Scope) => setForm({ ...form, scope: v })}
                >
                  <SelectTrigger id="ar-scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASE">CASE</SelectItem>
                    <SelectItem value="PROMO">PROMO</SelectItem>
                    <SelectItem value="BATCH">BATCH</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <label className="col-span-2 mt-7 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                Active (rule will be evaluated at runtime)
              </label>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ar-desc">Description</Label>
              <Input
                id="ar-desc"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="What does this rule do?"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ar-cond">Conditions (JSON)</Label>
              <Textarea
                id="ar-cond"
                value={form.conditions}
                onChange={(e) => setForm({ ...form, conditions: e.target.value })}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="ar-act">Actions (JSON)</Label>
              <Textarea
                id="ar-act"
                value={form.actions}
                onChange={(e) => setForm({ ...form, actions: e.target.value })}
                rows={5}
                className="font-mono text-xs"
              />
            </div>
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

      {/* Preview JSON dialog */}
      <Dialog open={preview !== null} onOpenChange={(o) => !o && setPreviewId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{preview?.name}</DialogTitle>
            <DialogDescription>
              {preview?.scope} · priority {preview?.priority} ·{' '}
              {preview?.isActive ? 'active' : 'paused'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Conditions
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-surface-subtle/40 p-3 text-xs">
                {preview ? prettyJson(preview.conditions) : ''}
              </pre>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actions
              </div>
              <pre className="overflow-x-auto rounded-md border border-border bg-surface-subtle/40 p-3 text-xs">
                {preview ? prettyJson(preview.actions) : ''}
              </pre>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewId(null)}>
              Close
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
            <DialogTitle>Delete this rule?</DialogTitle>
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
