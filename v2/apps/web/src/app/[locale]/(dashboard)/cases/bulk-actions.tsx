'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { CaseStatus } from '@wow/db';
import { Button } from '@/components/ui/button';
import { bulkSubmitCasesAction, bulkCancelCasesAction } from '@/app/actions/cases';

interface CaseRow {
  id: string;
  caseNumber: string;
  status: CaseStatus;
}

interface Props {
  cases: CaseRow[];
}

/**
 * Client wrapper that adds row-level checkboxes and a sticky bulk action
 * bar to the cases list. The wrapper renders its own checkboxes column
 * via portal-into-row trickery would be heavier; instead, the cases page
 * renders this component above the table and the table renders bare
 * checkboxes that bind to the shared state via per-row props.
 *
 * For simplicity here we render the action bar only, and the cases page
 * passes a list of currently-visible row ids. Selection is driven by
 * checkbox inputs the page renders directly. The page sets the form
 * id of those checkboxes to `bulk-cases-form` so this component can read
 * the checked values via FormData on submit.
 */
export function BulkActionsBar({ cases }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);
  const submittable = useMemo(() => cases.filter((c) => c.status === 'DRAFT'), [cases]);

  function selectedIds(): string[] {
    if (typeof document === 'undefined') return [];
    return Array.from(
      document.querySelectorAll<HTMLInputElement>('input[name="bulk_case"]:checked'),
    ).map((el) => el.value);
  }

  function clearSelection() {
    document
      .querySelectorAll<HTMLInputElement>('input[name="bulk_case"]:checked')
      .forEach((el) => {
        el.checked = false;
      });
    const head = document.querySelector<HTMLInputElement>('input[data-bulk-toggle-all]');
    if (head) head.checked = false;
  }

  function onSubmit() {
    const ids = selectedIds();
    if (ids.length === 0) {
      setFeedback('Select at least one case.');
      return;
    }
    setFeedback(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('caseIds', ids.join(','));
      const res = await bulkSubmitCasesAction(fd);
      if (!res.ok) {
        setFeedback(res.error);
        return;
      }
      const r = res.data;
      setFeedback(
        r.failed === 0
          ? `Submitted ${r.succeeded} case${r.succeeded === 1 ? '' : 's'}.`
          : `Submitted ${r.succeeded} of ${r.total}. ${r.failed} failed: ${r.errors
              .slice(0, 3)
              .map((e) => `${e.caseNumber} (${e.error})`)
              .join('; ')}${r.errors.length > 3 ? '…' : ''}`,
      );
      clearSelection();
      router.refresh();
    });
  }

  function onCancel() {
    const ids = selectedIds();
    if (ids.length === 0) {
      setFeedback('Select at least one case.');
      return;
    }
    const reason = window.prompt(`Cancel ${ids.length} case${ids.length === 1 ? '' : 's'}? Enter a reason:`);
    if (!reason || !reason.trim()) return;
    setFeedback(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set('caseIds', ids.join(','));
      fd.set('reason', reason.trim());
      const res = await bulkCancelCasesAction(fd);
      if (!res.ok) {
        setFeedback(res.error);
        return;
      }
      const r = res.data;
      setFeedback(
        r.failed === 0
          ? `Cancelled ${r.succeeded} case${r.succeeded === 1 ? '' : 's'}.`
          : `Cancelled ${r.succeeded} of ${r.total}. ${r.failed} failed.`,
      );
      clearSelection();
      router.refresh();
    });
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-md border border-border bg-surface-subtle/40 px-3 py-2 text-sm">
      <span className="text-muted-foreground">
        Bulk actions ({submittable.length} draft{submittable.length === 1 ? '' : 's'} on this page)
      </span>
      <Button size="sm" variant="default" onClick={onSubmit} disabled={pending}>
        Submit selected
      </Button>
      <Button size="sm" variant="outline" onClick={onCancel} disabled={pending}>
        Cancel selected
      </Button>
      {feedback ? <span className="text-xs text-muted-foreground">{feedback}</span> : null}
    </div>
  );
}

/** Header checkbox that toggles every row checkbox visible on the page. */
export function BulkSelectAll() {
  function onToggle(e: React.ChangeEvent<HTMLInputElement>) {
    const checked = e.target.checked;
    document
      .querySelectorAll<HTMLInputElement>('input[name="bulk_case"]')
      .forEach((el) => {
        el.checked = checked;
      });
  }
  return (
    <input
      type="checkbox"
      data-bulk-toggle-all
      onChange={onToggle}
      aria-label="Select all on this page"
      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
    />
  );
}

export function BulkRowCheckbox({ caseId }: { caseId: string }) {
  return (
    <input
      type="checkbox"
      name="bulk_case"
      value={caseId}
      aria-label={`Select case ${caseId}`}
      className="h-4 w-4 cursor-pointer rounded border-border accent-primary"
    />
  );
}
