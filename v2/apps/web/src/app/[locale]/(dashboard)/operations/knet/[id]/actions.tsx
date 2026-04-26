'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { ComponentStatus, KnetBatchStatus } from '@wow/db';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  ingestKnetArnsAction,
  sendKnetBatchAction,
  verifyKnetArnAction,
} from '@/app/actions/knet-batches';

interface ComponentRow {
  id: string;
  authCode: string | null;
  arn: string | null;
  amount: number;
  currency: string;
  status: ComponentStatus;
  caseId: string;
  caseNumber: string;
  customerName: string;
}

export function KnetBatchActions(props: {
  batchId: string;
  status: KnetBatchStatus;
  recipientEmails: string;
  components: ComponentRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [arnPaste, setArnPaste] = useState('');

  function send() {
    const fd = new FormData();
    fd.set('batchId', props.batchId);
    startTransition(async () => {
      const result = await sendKnetBatchAction(fd);
      if (result.ok) {
        toast.success('Sent to finance');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function ingest() {
    /**
     * Accepts CSV-like input where each line is:
     *   CASE_NUMBER  AUTH_CODE  ARN
     * (whitespace-separated). Auth code is used to disambiguate cases with multiple
     * components.
     */
    const lines = arnPaste
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      toast.error('Paste ARN response first');
      return;
    }
    const arns: { componentId: string; arn: string }[] = [];
    const skipped: string[] = [];
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 3) {
        skipped.push(line);
        continue;
      }
      const [caseNumber, authCode, arn] = parts;
      // `parts` came from a whitespace split, so `authCode` is never the
      // empty string here — components with no auth code on file can
      // only be matched if the operator types `-` or `N/A` as a
      // placeholder for that token. The placeholder is documented in
      // the textarea below so this convention is discoverable.
      const isNoAuthPlaceholder = authCode === '-' || authCode?.toUpperCase() === 'N/A';
      const match = props.components.find(
        (c) =>
          c.caseNumber === caseNumber &&
          (isNoAuthPlaceholder ? !c.authCode : (c.authCode ?? '') === authCode),
      );
      if (!match) {
        skipped.push(line);
        continue;
      }
      arns.push({ componentId: match.id, arn: arn ?? '' });
    }
    if (arns.length === 0) {
      toast.error(`No matches. Skipped ${skipped.length} line(s).`);
      return;
    }
    startTransition(async () => {
      const result = await ingestKnetArnsAction({ batchId: props.batchId, arns });
      if (result.ok) {
        toast.success(
          `Updated ${result.data.updated} component(s)${skipped.length ? ` · skipped ${skipped.length}` : ''}`,
        );
        setArnPaste('');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function verify(componentId: string, approve: boolean) {
    const fd = new FormData();
    fd.set('componentId', componentId);
    fd.set('approve', approve ? 'true' : 'false');
    startTransition(async () => {
      const result = await verifyKnetArnAction(fd);
      if (result.ok) {
        toast.success(approve ? 'ARN verified' : 'ARN rejected');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (props.status === 'DRAFT') {
    return (
      <div className="rounded-md border border-border bg-surface-subtle p-4">
        <div className="mb-2 text-sm">
          Draft batch with {props.components.length} component(s). Recipients:{' '}
          <code>{props.recipientEmails}</code>
        </div>
        <Button onClick={send} disabled={pending}>
          {pending ? 'Sending…' : 'Send to finance'}
        </Button>
      </div>
    );
  }

  if (props.status === 'COMPLETED' || props.status === 'CANCELLED') {
    return (
      <div className="rounded-md border border-border bg-surface-subtle p-4 text-sm text-muted-foreground">
        This batch is {props.status.toLowerCase()}. No further actions.
      </div>
    );
  }

  // SENT / AWAITING_ARNS / ARNS_RECEIVED
  const arnReceived = props.components.filter((c) => c.status === 'ARN_RECEIVED');

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-surface-subtle p-4">
        <div className="mb-2 text-sm font-medium">Paste finance ARN response</div>
        <Textarea
          rows={5}
          placeholder={`REF-KW-2026-000001  123456  ARN-KW-9999-AAA
REF-KW-2026-000002  654321  ARN-KW-9999-BBB
# use "-" or "N/A" if a component has no auth code:
REF-KW-2026-000003  -        ARN-KW-9999-CCC`}
          value={arnPaste}
          onChange={(e) => setArnPaste(e.target.value)}
        />
        <div className="mt-2 flex justify-end">
          <Button onClick={ingest} disabled={pending}>
            {pending ? 'Saving…' : 'Ingest ARNs'}
          </Button>
        </div>
      </div>

      {arnReceived.length > 0 ? (
        <div className="rounded-md border border-border bg-card">
          <div className="border-b border-border px-4 py-2 text-sm font-medium">
            Verify ARNs ({arnReceived.length})
          </div>
          <ul className="divide-y divide-border">
            {arnReceived.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{c.caseNumber}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.customerName} · auth {c.authCode ?? '—'} · arn{' '}
                    <span className="tabular">{c.arn ?? '—'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => verify(c.id, true)} disabled={pending}>
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => verify(c.id, false)}
                    disabled={pending}
                  >
                    Reject
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
