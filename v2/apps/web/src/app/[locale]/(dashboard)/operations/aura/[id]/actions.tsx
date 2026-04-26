'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import {
  sendAuraBatchAction,
  completeAuraBatchAction,
  cancelAuraBatchAction,
} from '@/app/actions/aura-batches';

interface Props {
  batchId: string;
  status: string;
  recipientEmails: string;
}

export function AuraBatchActions(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [responseRawBody, setResponseRawBody] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  function handleSend() {
    if (!confirm(`Send batch to ${props.recipientEmails}?`)) return;
    startTransition(async () => {
      const r = await sendAuraBatchAction({ batchId: props.batchId });
      if (r.ok) {
        toast.success('Batch sent');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function handleComplete() {
    startTransition(async () => {
      const r = await completeAuraBatchAction({
        batchId: props.batchId,
        responseRawBody: responseRawBody || undefined,
      });
      if (r.ok) {
        toast.success('Batch completed; cases marked Aura-COMPLETED');
        setResponseRawBody('');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error('Reason is required');
      return;
    }
    if (!confirm('Cancel this batch?')) return;
    startTransition(async () => {
      const r = await cancelAuraBatchAction({
        batchId: props.batchId,
        reason: cancelReason,
      });
      if (r.ok) {
        toast.success('Batch cancelled');
        setCancelReason('');
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-xs text-muted-foreground">
          Recipients: <span className="tabular">{props.recipientEmails}</span>
        </div>

        {props.status === 'DRAFT' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleSend} disabled={pending}>
              {pending ? 'Sending…' : 'Send to Aura team'}
            </Button>
            <span className="text-xs text-muted-foreground">
              Email is dispatched and the batch flips to SENT.
            </span>
          </div>
        ) : null}

        {(props.status === 'SENT' || props.status === 'AWAITING') ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Mark as completed</div>
            <Textarea
              rows={4}
              placeholder="Optional: paste the Aura team's reply for the audit log"
              value={responseRawBody}
              onChange={(e) => setResponseRawBody(e.target.value)}
            />
            <div className="flex justify-end">
              <Button onClick={handleComplete} disabled={pending}>
                {pending ? 'Working…' : 'Complete batch'}
              </Button>
            </div>
          </div>
        ) : null}

        {props.status !== 'COMPLETED' && props.status !== 'CANCELLED' ? (
          <div className="space-y-2 rounded-md border border-border p-3">
            <div className="text-sm font-medium">Cancel batch</div>
            <Textarea
              rows={2}
              placeholder="Reason (required)"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
            />
            <div className="flex justify-end">
              <Button variant="destructive" onClick={handleCancel} disabled={pending}>
                {pending ? 'Working…' : 'Cancel batch'}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
