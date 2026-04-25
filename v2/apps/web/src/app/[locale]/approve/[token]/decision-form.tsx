'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, XCircle } from 'lucide-react';
import { decideMagicLinkBatchAction } from '@/app/actions/magic-link';

export function ApprovalDecisionForm({
  token,
  batchNumber,
}: {
  token: string;
  batchNumber: string;
}) {
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState('');
  const [done, setDone] = useState<{ kind: 'approved' | 'rejected' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function decide(decision: 'APPROVED' | 'REJECTED') {
    setError(null);
    if (decision === 'REJECTED' && !reason.trim()) {
      setError('Please share a short reason before rejecting.');
      return;
    }
    startTransition(async () => {
      const result = await decideMagicLinkBatchAction({
        token,
        decision,
        reason: reason.trim() || undefined,
      });
      if (result.ok) setDone({ kind: decision === 'APPROVED' ? 'approved' : 'rejected' });
      else setError(result.error);
    });
  }

  if (done) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            {done.kind === 'approved'
              ? `Batch ${batchNumber} approved`
              : `Batch ${batchNumber} rejected`}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          The decision has been recorded. You can close this tab.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Submit decision</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground" htmlFor="reason">
            Reason (required for rejection)
          </label>
          <Input
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Optional note for the team"
            className="mt-1"
          />
        </div>
        {error ? <div className="text-sm text-destructive">{error}</div> : null}
        <div className="flex gap-2">
          <Button onClick={() => decide('APPROVED')} disabled={pending}>
            <CheckCircle2 className="h-4 w-4" />
            Approve all
          </Button>
          <Button variant="outline" onClick={() => decide('REJECTED')} disabled={pending}>
            <XCircle className="h-4 w-4" />
            Reject all
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
