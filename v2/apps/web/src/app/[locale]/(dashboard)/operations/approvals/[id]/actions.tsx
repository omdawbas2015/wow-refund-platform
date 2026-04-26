'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { BatchStatus, CaseStatus } from '@wow/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  decideApprovalBatchAction,
  sendApprovalBatchAction,
  cancelApprovalBatchAction,
} from '@/app/actions/approval-batches';

interface CaseRow {
  id: string;
  caseNumber: string;
  customerName: string;
  orderNumber: string;
  amount: number;
  currency: string;
  status: CaseStatus;
}

export function ApprovalBatchActions(props: {
  batchId: string;
  status: BatchStatus;
  recipientEmails: string;
  cases: CaseRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [decisions, setDecisions] = useState<
    Record<string, { decision: 'APPROVE' | 'REJECT'; reason?: string }>
  >({});
  const [cancelMode, setCancelMode] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  function setDecision(caseId: string, decision: 'APPROVE' | 'REJECT', reason?: string) {
    setDecisions((prev) => ({ ...prev, [caseId]: { decision, reason } }));
  }

  function clearDecision(caseId: string) {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[caseId];
      return next;
    });
  }

  function send() {
    const fd = new FormData();
    fd.set('batchId', props.batchId);
    startTransition(async () => {
      const result = await sendApprovalBatchAction(fd);
      if (result.ok) {
        toast.success('Batch sent');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function submitDecisions() {
    const decided = Object.entries(decisions).map(([caseId, v]) => ({
      caseId,
      decision: v.decision,
      reason: v.reason,
    }));
    if (decided.length === 0) {
      toast.error('Make at least one decision');
      return;
    }
    startTransition(async () => {
      const result = await decideApprovalBatchAction({ batchId: props.batchId, decisions: decided });
      if (result.ok) {
        toast.success(`Decided: ${result.data.approved} approved, ${result.data.rejected} rejected`);
        setDecisions({});
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function cancel() {
    if (!cancelReason.trim()) {
      toast.error('Reason required');
      return;
    }
    const fd = new FormData();
    fd.set('batchId', props.batchId);
    fd.set('reason', cancelReason);
    startTransition(async () => {
      const result = await cancelApprovalBatchAction(fd);
      if (result.ok) {
        toast.success('Batch cancelled');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  // DRAFT — only Send / Cancel
  if (props.status === 'DRAFT') {
    return (
      <div className="rounded-md border border-border bg-surface-subtle p-4">
        <div className="mb-2 text-sm">
          Draft batch with {props.cases.length} case(s). Recipients: <code>{props.recipientEmails}</code>
        </div>
        <div className="flex gap-2">
          <Button onClick={send} disabled={pending}>
            {pending ? 'Sending…' : 'Send to manager'}
          </Button>
          <Button variant="outline" onClick={() => setCancelMode((v) => !v)} disabled={pending}>
            {cancelMode ? 'Keep batch' : 'Cancel batch'}
          </Button>
        </div>
        {cancelMode ? (
          <div className="mt-3 flex flex-col gap-2">
            <Textarea
              placeholder="Why is this batch being cancelled?"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
            />
            <div>
              <Button variant="destructive" onClick={cancel} disabled={pending}>
                Confirm cancel
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // COMPLETED / CANCELLED — read only
  if (props.status === 'COMPLETED' || props.status === 'CANCELLED') {
    return (
      <div className="rounded-md border border-border bg-surface-subtle p-4 text-sm text-muted-foreground">
        This batch is {props.status.toLowerCase()}. No further actions.
      </div>
    );
  }

  // SENT / AWAITING_RESPONSE / PARTIALLY_DECIDED — decision UI
  const undecided = props.cases.filter((c) => c.status === 'PENDING_APPROVAL');
  return (
    <div className="rounded-md border border-border bg-surface-subtle p-4">
      <div className="mb-3 text-sm">
        Record manager decisions ({undecided.length} undecided, {Object.keys(decisions).length} pending submit)
      </div>
      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
              <th>Case</th>
              <th>Customer</th>
              <th>Decision</th>
              <th>Reason (if reject)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {undecided.map((c) => {
              const d = decisions[c.id];
              return (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-medium">{c.caseNumber}</td>
                  <td className="px-3 py-2">{c.customerName}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={d?.decision === 'APPROVE' ? 'default' : 'outline'}
                        onClick={() => setDecision(c.id, 'APPROVE')}
                        type="button"
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant={d?.decision === 'REJECT' ? 'destructive' : 'outline'}
                        onClick={() => setDecision(c.id, 'REJECT', d?.reason)}
                        type="button"
                      >
                        Reject
                      </Button>
                      {d ? (
                        <Button size="sm" variant="ghost" onClick={() => clearDecision(c.id)} type="button">
                          Clear
                        </Button>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    {d?.decision === 'REJECT' ? (
                      <input
                        className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                        placeholder="Reason"
                        value={d.reason ?? ''}
                        onChange={(e) => setDecision(c.id, 'REJECT', e.target.value)}
                      />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
            {undecided.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  All cases have been decided.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button
          onClick={submitDecisions}
          disabled={pending || Object.keys(decisions).length === 0}
        >
          {pending ? 'Saving…' : `Submit decisions (${Object.keys(decisions).length})`}
        </Button>
      </div>
    </div>
  );
}
