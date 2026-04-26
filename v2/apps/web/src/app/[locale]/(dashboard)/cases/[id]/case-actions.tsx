'use client';

import { useState, useTransition } from 'react';
import type { CaseStatus } from '@wow/db';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, CheckCircle2, XCircle, Ban } from 'lucide-react';
import {
  submitCaseAction,
  approveCaseAction,
  rejectCaseAction,
  cancelCaseAction,
} from '@/app/actions/cases';
import { canTransitionCase } from '@/lib/cases/state-machine';

type Mode = 'idle' | 'rejecting' | 'cancelling';

export function CaseActions(props: {
  caseId: string;
  status: CaseStatus;
  canManage: boolean;
  canCancel: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<Mode>('idle');
  const [reason, setReason] = useState('');

  const canSubmit = canTransitionCase(props.status, 'PENDING_APPROVAL');
  const canApprove = props.canManage && canTransitionCase(props.status, 'APPROVED');
  const canReject = props.canManage && canTransitionCase(props.status, 'REJECTED');
  const canDoCancel = props.canCancel && canTransitionCase(props.status, 'CANCELLED');

  function runWithFormData(action: (fd: FormData) => Promise<{ ok: boolean; error?: string }>, body: Record<string, string>, success: string) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(body)) fd.set(k, v);
    startTransition(async () => {
      const result = await action(fd);
      if (result.ok) {
        toast.success(success);
        setMode('idle');
        setReason('');
      } else {
        toast.error(result.error ?? 'Action failed');
      }
    });
  }

  if (mode === 'rejecting' || mode === 'cancelling') {
    const isReject = mode === 'rejecting';
    return (
      <div className="flex w-full flex-col gap-2 sm:w-96">
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={isReject ? 'Reason for rejection' : 'Reason for cancellation'}
          rows={2}
        />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setMode('idle'); setReason(''); }} disabled={pending}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={pending || reason.trim().length < 1}
            onClick={() =>
              runWithFormData(
                isReject ? rejectCaseAction : cancelCaseAction,
                { caseId: props.caseId, reason: reason.trim() },
                isReject ? 'Case rejected' : 'Case cancelled',
              )
            }
          >
            {isReject ? 'Reject case' : 'Cancel case'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {canSubmit && (
        <Button
          size="sm"
          onClick={() =>
            runWithFormData(
              submitCaseAction,
              { caseId: props.caseId },
              'Case submitted for approval',
            )
          }
          disabled={pending}
        >
          <Send className="h-4 w-4" />
          Submit for approval
        </Button>
      )}
      {canApprove && (
        <Button
          size="sm"
          variant="success"
          onClick={() =>
            runWithFormData(approveCaseAction, { caseId: props.caseId }, 'Case approved')
          }
          disabled={pending}
        >
          <CheckCircle2 className="h-4 w-4" />
          Approve
        </Button>
      )}
      {canReject && (
        <Button size="sm" variant="outline" onClick={() => setMode('rejecting')} disabled={pending}>
          <XCircle className="h-4 w-4" />
          Reject
        </Button>
      )}
      {canDoCancel && (
        <Button size="sm" variant="ghost" onClick={() => setMode('cancelling')} disabled={pending}>
          <Ban className="h-4 w-4" />
          Cancel case
        </Button>
      )}
    </div>
  );
}
