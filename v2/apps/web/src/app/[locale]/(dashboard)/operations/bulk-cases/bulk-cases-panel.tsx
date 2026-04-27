'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CaseStatusBadge } from '@/components/ui/case-status-badge';
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
  Send,
  XCircle,
  UserCog,
  Filter,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import {
  bulkSubmitDraftsAction,
  bulkCancelAction,
  bulkReassignCasesAction,
} from '@/app/actions/bulk-cases';
import type { CaseStatus } from '@/components/ui/case-status-stepper';

export type BulkCaseRow = {
  id: string;
  caseNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  countryName: string;
  countryFlag: string;
  brandName: string;
  totalAmount: number;
  currency: string;
  assignedTo: { id: string; name: string } | null;
  createdAt: string;
};

type BulkAction = 'submit' | 'cancel' | 'reassign';

type FilterState = {
  status: string;
  countryId: string;
  q: string;
};

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_APPROVAL', label: 'Pending approval' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'IN_EXECUTION', label: 'In execution' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
];

export function BulkCasesPanel({
  initialFilters,
  countries,
  agents,
  rows,
  currentUserRole,
}: {
  initialFilters: FilterState;
  countries: { id: string; name: string; flag: string }[];
  agents: { id: string; name: string; email: string; role: string | null }[];
  rows: BulkCaseRow[];
  currentUserRole: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openAction, setOpenAction] = useState<BulkAction | null>(null);
  const [reason, setReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [filters, setFilters] = useState<FilterState>(initialFilters);

  const allIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const someSelected = selected.size > 0 && !allSelected;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(allIds));
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function applyFilters() {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    params.set('status', filters.status);
    if (filters.countryId) params.set('countryId', filters.countryId);
    else params.delete('countryId');
    if (filters.q) params.set('q', filters.q);
    else params.delete('q');
    router.push(`${pathname}?${params.toString()}`);
  }

  const isDraftView = filters.status === 'DRAFT';
  const canSubmitBulk = isDraftView && selected.size > 0;
  const canCancelBulk = selected.size > 0;
  const canReassignBulk = selected.size > 0;
  const canRoleReassign =
    currentUserRole === 'ADMIN' || currentUserRole === 'MANAGER';

  function runAction(action: BulkAction) {
    const ids = Array.from(selected);
    if (ids.length === 0) {
      toast.error('Select at least one case');
      return;
    }
    if (action === 'cancel' && reason.trim().length < 3) {
      toast.error('Reason must be at least 3 characters');
      return;
    }
    if (action === 'reassign' && !assigneeId) {
      toast.error('Pick an assignee');
      return;
    }

    startTransition(async () => {
      let result;
      if (action === 'submit') {
        result = await bulkSubmitDraftsAction({ caseIds: ids });
      } else if (action === 'cancel') {
        result = await bulkCancelAction({ caseIds: ids, reason });
      } else {
        result = await bulkReassignCasesAction({ caseIds: ids, assignedToId: assigneeId });
      }

      if (!result.ok) {
        toast.error(result.error ?? 'Bulk action failed');
        return;
      }

      const okCount = result.succeeded.length;
      const failCount = result.failed.length;
      if (okCount > 0 && failCount === 0) {
        toast.success(`${okCount} case${okCount === 1 ? '' : 's'} updated`);
      } else if (okCount > 0 && failCount > 0) {
        toast.warning(
          `${okCount} updated, ${failCount} skipped — see details on screen`,
          {
            description: result.failed
              .slice(0, 3)
              .map((f) => `${f.id.slice(0, 8)}: ${f.error}`)
              .join('  •  '),
          },
        );
      } else {
        toast.error(
          `All ${failCount} case${failCount === 1 ? '' : 's'} failed`,
          {
            description: result.failed
              .slice(0, 3)
              .map((f) => `${f.id.slice(0, 8)}: ${f.error}`)
              .join('  •  '),
          },
        );
      }

      setSelected(new Set());
      setReason('');
      setAssigneeId('');
      setOpenAction(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="grid gap-3 md:grid-cols-[200px_220px_1fr_auto]">
        <div>
          <Label htmlFor="bulk-status">Status</Label>
          <Select
            value={filters.status}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v }))}
          >
            <SelectTrigger id="bulk-status">
              <SelectValue placeholder="Pick a status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="bulk-country">Country</Label>
          <Select
            value={filters.countryId || 'all'}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, countryId: v === 'all' ? '' : v }))
            }
          >
            <SelectTrigger id="bulk-country">
              <SelectValue placeholder="All countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All countries</SelectItem>
              {countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  <span className="me-1.5">{c.flag}</span>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="bulk-q">Search</Label>
          <Input
            id="bulk-q"
            placeholder="Case #, customer, order…"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') applyFilters();
            }}
          />
        </div>
        <div className="flex items-end">
          <Button type="button" variant="secondary" onClick={applyFilters}>
            <Filter className="me-1.5 h-4 w-4" />
            Apply
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface-subtle/50 px-4 py-2.5 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <CheckCircle2 className="h-4 w-4" />
          <span>
            <span className="font-medium text-heading">{selected.size}</span> of {rows.length} selected
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canSubmitBulk || isPending}
            onClick={() => setOpenAction('submit')}
          >
            <Send className="me-1.5 h-4 w-4" />
            Submit drafts
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!canCancelBulk || isPending}
            onClick={() => setOpenAction('cancel')}
          >
            <XCircle className="me-1.5 h-4 w-4" />
            Cancel
          </Button>
          {canRoleReassign ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canReassignBulk || isPending}
              onClick={() => setOpenAction('reassign')}
            >
              <UserCog className="me-1.5 h-4 w-4" />
              Reassign
            </Button>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[920px] text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-subtle/40 text-start">
              <th className="w-10 px-3 py-2.5">
                <input
                  type="checkbox"
                  className="h-4 w-4 cursor-pointer rounded border-border"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={toggleAll}
                  aria-label="Select all"
                />
              </th>
              <Th>Case</Th>
              <Th>Customer</Th>
              <Th>Country</Th>
              <Th>Brand</Th>
              <Th align="end">Refund</Th>
              <Th>Status</Th>
              <Th>Assignee</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  No cases match these filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr
                  key={r.id}
                  className="cursor-pointer hover:bg-primary/5 data-[state=selected]:bg-primary/10"
                  data-state={selected.has(r.id) ? 'selected' : undefined}
                  onClick={() => toggleOne(r.id)}
                >
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="h-4 w-4 cursor-pointer rounded border-border"
                      checked={selected.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      aria-label={`Select ${r.caseNumber}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{r.caseNumber}</td>
                  <td className="px-3 py-2">
                    <div className="font-medium text-heading">{r.customerName}</div>
                    <div className="text-xs text-muted-foreground">{r.customerEmail}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="me-1.5">{r.countryFlag}</span>
                    {r.countryName}
                  </td>
                  <td className="px-3 py-2">{r.brandName}</td>
                  <td className="px-3 py-2 text-end font-mono">
                    <span className="me-1 text-xs uppercase text-muted-foreground">
                      {r.currency}
                    </span>
                    {r.totalAmount.toFixed(r.currency === 'KWD' ? 3 : 2)}
                  </td>
                  <td className="px-3 py-2">
                    <CaseStatusBadge status={r.status as CaseStatus} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.assignedTo?.name ?? <span className="italic">Unassigned</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation dialogs */}
      <Dialog
        open={openAction === 'submit'}
        onOpenChange={(o) => !o && setOpenAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit {selected.size} draft cases?</DialogTitle>
            <DialogDescription>
              Each selected case will move from <Badge variant="outline">Draft</Badge> to{' '}
              <Badge variant="outline">Pending approval</Badge>. Cases not in DRAFT will be
              skipped and reported back individually.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpenAction(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isPending}
              onClick={() => runAction('submit')}
            >
              {isPending ? 'Submitting…' : `Submit ${selected.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openAction === 'cancel'}
        onOpenChange={(o) => {
          if (!o) {
            setOpenAction(null);
            setReason('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel {selected.size} case{selected.size === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Cases already refunded, rejected, or cancelled will be skipped. The reason is
              stored on each cancelled case and recorded in the audit log.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Cancellation reason</Label>
            <Input
              id="cancel-reason"
              autoFocus
              placeholder="Why are you cancelling these cases?"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            {reason.trim().length > 0 && reason.trim().length < 3 ? (
              <p className="flex items-center gap-1 text-xs text-amber-600">
                <AlertTriangle className="h-3 w-3" />
                Reason must be at least 3 characters
              </p>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setOpenAction(null);
                setReason('');
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isPending || reason.trim().length < 3}
              onClick={() => runAction('cancel')}
            >
              {isPending ? 'Cancelling…' : `Cancel ${selected.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={openAction === 'reassign'}
        onOpenChange={(o) => {
          if (!o) {
            setOpenAction(null);
            setAssigneeId('');
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Reassign {selected.size} case{selected.size === 1 ? '' : 's'}
            </DialogTitle>
            <DialogDescription>
              Pick the user the selected cases should be assigned to. Terminal cases
              (refunded, rejected, cancelled) and archived cases are skipped.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="assignee">New assignee</Label>
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger id="assignee">
                <SelectValue placeholder="Pick a user" />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    <span className="ms-2 text-xs text-muted-foreground">
                      {a.role ?? 'NO ROLE'} · {a.email}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              type="button"
              onClick={() => {
                setOpenAction(null);
                setAssigneeId('');
              }}
            >
              Back
            </Button>
            <Button
              type="button"
              disabled={isPending || !assigneeId}
              onClick={() => runAction('reassign')}
            >
              {isPending ? 'Reassigning…' : `Reassign ${selected.size}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: 'start' | 'end';
}) {
  return (
    <th
      className={`px-3 py-2.5 text-${align === 'end' ? 'end' : 'start'} text-xs font-medium uppercase tracking-wider text-muted-foreground`}
    >
      {children}
    </th>
  );
}
