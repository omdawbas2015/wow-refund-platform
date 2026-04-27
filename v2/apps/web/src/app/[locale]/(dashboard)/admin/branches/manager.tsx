'use client';

import { useMemo, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Pause, PlayCircle } from 'lucide-react';
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
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
  toggleBranchActiveAction,
} from '@/app/actions/admin-branches';

export type CountryOption = { id: string; name: string; flag: string };

export type BranchRow = {
  id: string;
  name: string;
  nameAr: string | null;
  code: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  sortOrder: number;
  countryId: string;
  countryName: string;
  countryFlag: string;
  caseCount: number;
};

type FormState = {
  id?: string;
  countryId: string;
  name: string;
  nameAr: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  isActive: boolean;
  sortOrder: number;
};

function emptyForm(defaultCountryId: string): FormState {
  return {
    countryId: defaultCountryId,
    name: '',
    nameAr: '',
    code: '',
    address: '',
    phone: '',
    email: '',
    isActive: true,
    sortOrder: 0,
  };
}

export function BranchesManager({
  rows,
  countries,
}: {
  rows: BranchRow[];
  countries: CountryOption[];
}) {
  const [pending, start] = useTransition();
  const [openForm, setOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(countries[0]?.id ?? ''));
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    return rows.filter((r) => r.countryId === filter);
  }, [rows, filter]);

  const openCreate = () => {
    setForm(emptyForm(countries[0]?.id ?? ''));
    setEditingId(null);
    setOpenForm(true);
  };

  const openEdit = (row: BranchRow) => {
    setForm({
      id: row.id,
      countryId: row.countryId,
      name: row.name,
      nameAr: row.nameAr ?? '',
      code: row.code ?? '',
      address: row.address ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      isActive: row.isActive,
      sortOrder: row.sortOrder,
    });
    setEditingId(row.id);
    setOpenForm(true);
  };

  const submit = () => {
    start(async () => {
      const result = editingId
        ? await updateBranchAction({ ...form, id: editingId })
        : await createBranchAction(form);
      if (!result.ok) {
        toast.error(result.error ?? 'Save failed');
        return;
      }
      toast.success(editingId ? 'Branch updated' : 'Branch created');
      setOpenForm(false);
      setEditingId(null);
      setForm(emptyForm(countries[0]?.id ?? ''));
    });
  };

  const toggle = (row: BranchRow) => {
    start(async () => {
      const result = await toggleBranchActiveAction({
        id: row.id,
        isActive: !row.isActive,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Toggle failed');
        return;
      }
      toast.success(row.isActive ? 'Branch deactivated' : 'Branch activated');
    });
  };

  const confirmDelete = (id: string) => {
    start(async () => {
      const result = await deleteBranchAction({ id });
      if (!result.ok) {
        toast.error(result.error ?? 'Delete failed');
        return;
      }
      toast.success('Branch deleted');
      setConfirmDeleteId(null);
    });
  };

  if (countries.length === 0) {
    return (
      <div className="rounded-md border border-warning/30 bg-warning/5 p-4 text-sm text-heading">
        No active countries yet. Activate a country in{' '}
        <a className="font-medium text-primary underline-offset-2 hover:underline" href="/admin/countries">
          /admin/countries
        </a>{' '}
        before adding branches.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="branch-country-filter" className="text-xs text-muted-foreground">
            Country
          </Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger id="branch-country-filter" className="h-8 w-56 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.flag} {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus className="me-1.5 h-4 w-4" />
          New branch
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40 text-left">
              <Th>Country</Th>
              <Th>Name</Th>
              <Th>Code</Th>
              <Th>Contact</Th>
              <Th>Cases</Th>
              <Th>Status</Th>
              <th className="px-3 py-2.5 text-end text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                  No branches yet for this filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 text-xs">
                    <span className="me-1">{r.countryFlag}</span>
                    {r.countryName}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-heading">{r.name}</div>
                    {r.nameAr ? (
                      <div className="text-xs text-muted-foreground">{r.nameAr}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.code ?? '—'}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {r.email ? <div className="truncate max-w-[200px]" title={r.email}>{r.email}</div> : null}
                    {r.phone ? <div>{r.phone}</div> : null}
                    {!r.email && !r.phone ? '—' : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.caseCount}</td>
                  <td className="px-3 py-2">
                    {r.isActive ? (
                      <Badge variant="success" className="text-[10px]">
                        Active
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px]">
                        Inactive
                      </Badge>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1.5">
                      <IconBtn
                        title={r.isActive ? 'Deactivate' : 'Activate'}
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
                        disabled={pending || r.caseCount > 0}
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
            <DialogTitle>{editingId ? 'Edit branch' : 'New branch'}</DialogTitle>
            <DialogDescription>
              Branches are scoped to one country. Email is optional but recommended for
              store communications.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-country">Country</Label>
                <Select
                  value={form.countryId}
                  onValueChange={(v) => setForm({ ...form, countryId: v })}
                >
                  <SelectTrigger id="b-country">
                    <SelectValue placeholder="Pick a country" />
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
              <div className="grid gap-1.5">
                <Label htmlFor="b-code">Code</Label>
                <Input
                  id="b-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  placeholder="KW-01"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-name">Name (English)</Label>
                <Input
                  id="b-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Salmiya Mall"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="b-namear">Name (Arabic)</Label>
                <Input
                  id="b-namear"
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="السالمية مول"
                  dir="rtl"
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="b-address">Address</Label>
              <Input
                id="b-address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Block 1, Salem Al Mubarak St…"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-phone">Phone</Label>
                <Input
                  id="b-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+965 …"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="b-email">Email</Label>
                <Input
                  id="b-email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="store@wow.local"
                  type="email"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="b-sort">Sort order</Label>
                <Input
                  id="b-sort"
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm({ ...form, sortOrder: parseInt(e.target.value || '0', 10) })
                  }
                />
              </div>
              <label className="mt-7 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                Active
              </label>
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

      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this branch?</DialogTitle>
            <DialogDescription>
              This is permanent. Audit-log entries are retained.
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
