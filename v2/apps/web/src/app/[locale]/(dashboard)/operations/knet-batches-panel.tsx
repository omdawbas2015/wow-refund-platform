'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle2 } from 'lucide-react';
import {
  createKnetBatchAction,
  verifyComponentArnAction,
} from '@/app/actions/batches';

interface PendingComponent {
  id: string;
  caseId: string;
  caseNumber: string;
  customerName: string;
  authCode: string | null;
  amount: number;
  currency: string;
  status: string;
  suggestedArn: string | null;
}

interface BatchComponent {
  id: string;
  caseNumber: string;
  customerName: string;
  authCode: string | null;
  amount: number;
  currency: string;
  status: string;
  suggestedArn: string | null;
}

interface LiveBatch {
  id: string;
  batchNumber: string;
  status: string;
  sentAt: string | null;
  totalComponents: number;
  arnsReceived: number;
  verifiedComponents: number;
  components: BatchComponent[];
}

export function KnetBatchesPanel({
  pendingComponents,
  liveBatches,
}: {
  pendingComponents: PendingComponent[];
  liveBatches: LiveBatch[];
}) {
  const [pending, startTransition] = useTransition();

  function handleCreateBatch() {
    startTransition(async () => {
      const result = await createKnetBatchAction({});
      if (result.ok && 'data' in result && result.data) {
        toast.success(
          `KNET batch ${result.data.batchNumber} sent — ${result.data.components} component${
            result.data.components === 1 ? '' : 's'
          }.`,
        );
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Send KNET batch</CardTitle>
            <CardDescription>
              Roll up approved KNET components without an ARN, email Finance, and wait for the
              ARN suggestions.
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={pending || pendingComponents.length === 0}
            onClick={handleCreateBatch}
          >
            <Send className="h-3.5 w-3.5" />
            Send batch ({pendingComponents.length})
          </Button>
        </CardHeader>
        <CardContent>
          {pendingComponents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No KNET components are awaiting a batch.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">Case</th>
                    <th className="px-3 py-2 text-start font-medium">Customer</th>
                    <th className="px-3 py-2 text-start font-medium">Auth code</th>
                    <th className="px-3 py-2 text-end font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingComponents.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-3 py-2 font-mono">{c.caseNumber}</td>
                      <td className="px-3 py-2 text-muted-foreground">{c.customerName}</td>
                      <td className="px-3 py-2 font-mono text-xs">{c.authCode ?? '—'}</td>
                      <td className="px-3 py-2 text-end tabular">
                        {c.amount.toFixed(2)} {c.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live KNET batches</CardTitle>
          <CardDescription>
            Batches awaiting ARN replies from Finance. ARNs suggested by Power Automate
            need an agent verification before the case is marked refunded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {liveBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live KNET batches.</p>
          ) : (
            liveBatches.map((b) => (
              <KnetBatchCard key={b.id} batch={b} pending={pending} />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KnetBatchCard({ batch, pending }: { batch: LiveBatch; pending: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-heading">
          <Badge variant="outline" className="text-[10px]">
            {batch.batchNumber}
          </Badge>
          <Badge
            variant={batch.status === 'ARNS_RECEIVED' ? 'success' : 'secondary'}
            className="text-[10px]"
          >
            {batch.status.replace(/_/g, ' ')}
          </Badge>
          {batch.sentAt ? (
            <span className="text-xs text-muted-foreground">
              sent {new Date(batch.sentAt).toLocaleString()}
            </span>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          {batch.verifiedComponents}/{batch.arnsReceived}/{batch.totalComponents}
          <span className="ms-1 uppercase">verified/received/total</span>
        </div>
      </div>

      <table className="mt-3 w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs text-muted-foreground">
            <th className="px-2 py-2 text-start font-medium">Case</th>
            <th className="px-2 py-2 text-start font-medium">Customer</th>
            <th className="px-2 py-2 text-start font-medium">Auth</th>
            <th className="px-2 py-2 text-end font-medium">Amount</th>
            <th className="px-2 py-2 text-start font-medium">ARN</th>
            <th className="px-2 py-2 text-end font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {batch.components.map((c) => (
            <ArnRow key={c.id} component={c} disabled={pending} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArnRow({
  component,
  disabled,
}: {
  component: BatchComponent;
  disabled: boolean;
}) {
  const [arn, setArn] = useState(component.suggestedArn ?? '');
  const [submitting, startTransition] = useTransition();

  function handleVerify() {
    if (!arn.trim()) {
      toast.error('Enter an ARN before verifying.');
      return;
    }
    startTransition(async () => {
      const result = await verifyComponentArnAction({
        componentId: component.id,
        arn: arn.trim(),
      });
      if (result.ok) toast.success(`ARN saved for ${component.caseNumber}.`);
      else toast.error(result.error);
    });
  }

  const isDone = component.status === 'REFUNDED';
  const isReady = component.status === 'ARN_RECEIVED';

  return (
    <tr className="border-b border-border/60 last:border-b-0">
      <td className="px-2 py-2 font-mono text-xs">{component.caseNumber}</td>
      <td className="px-2 py-2 text-muted-foreground">{component.customerName}</td>
      <td className="px-2 py-2 font-mono text-xs">{component.authCode ?? '—'}</td>
      <td className="px-2 py-2 text-end tabular">
        {component.amount.toFixed(2)} {component.currency}
      </td>
      <td className="px-2 py-2">
        <Input
          value={arn}
          onChange={(e) => setArn(e.target.value)}
          placeholder={isDone ? 'Verified' : isReady ? 'Suggested' : 'Enter ARN'}
          disabled={isDone || disabled || submitting}
          className="h-8 max-w-[180px] font-mono text-xs"
        />
      </td>
      <td className="px-2 py-2 text-end">
        {isDone ? (
          <Badge variant="success" className="text-[10px]">
            <CheckCircle2 className="me-0.5 h-3 w-3" /> Refunded
          </Badge>
        ) : (
          <Button size="sm" onClick={handleVerify} disabled={disabled || submitting}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Verify
          </Button>
        )}
      </td>
    </tr>
  );
}
