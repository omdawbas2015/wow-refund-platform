'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, CheckCircle2, XCircle } from 'lucide-react';
import {
  createAuraBatchAction,
  confirmAuraCaseAction,
} from '@/app/actions/batches';

interface PendingCase {
  id: string;
  caseNumber: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  points: number;
}

interface LiveBatch {
  id: string;
  batchNumber: string;
  status: string;
  sentAt: string | null;
  totalCases: number;
  completedCases: number;
}

export function AuraBatchesPanel({
  pendingCases,
  liveBatches,
}: {
  pendingCases: PendingCase[];
  liveBatches: LiveBatch[];
}) {
  const [pending, startTransition] = useTransition();

  function handleCreateBatch() {
    startTransition(async () => {
      const result = await createAuraBatchAction({});
      if (result.ok && 'data' in result && result.data) {
        toast.success(
          `Aura batch ${result.data.batchNumber} sent — ${result.data.cases} case${
            result.data.cases === 1 ? '' : 's'
          }.`,
        );
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function handleConfirm(caseId: string, status: 'COMPLETED' | 'FAILED') {
    startTransition(async () => {
      const result = await confirmAuraCaseAction({
        caseId,
        status,
        ...(status === 'FAILED' ? { failureReason: 'Marked failed from operations desk' } : {}),
      });
      if (result.ok)
        toast.success(`Aura case marked ${status === 'COMPLETED' ? 'completed' : 'failed'}.`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Send Aura batch</CardTitle>
            <CardDescription>
              Group every approved case with pending Aura points, email the Aura team,
              and confirm them order-by-order from this panel or by email reply.
            </CardDescription>
          </div>
          <Button
            size="sm"
            disabled={pending || pendingCases.length === 0}
            onClick={handleCreateBatch}
          >
            <Send className="h-3.5 w-3.5" />
            Send batch ({pendingCases.length})
          </Button>
        </CardHeader>
        <CardContent>
          {pendingCases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No Aura cases are pending. New points refunds appear here automatically.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">Case</th>
                    <th className="px-3 py-2 text-start font-medium">Customer</th>
                    <th className="px-3 py-2 text-start font-medium">Order</th>
                    <th className="px-3 py-2 text-end font-medium">Points</th>
                    <th className="px-3 py-2 text-end font-medium">Manual confirm</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingCases.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-3 py-2 font-mono text-xs">{c.caseNumber}</td>
                      <td className="px-3 py-2">
                        <div className="text-sm">{c.customerName}</div>
                        <div className="text-xs text-muted-foreground">{c.customerEmail}</div>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{c.orderNumber}</td>
                      <td className="px-3 py-2 text-end tabular">{c.points}</td>
                      <td className="px-3 py-2 text-end">
                        <div className="inline-flex gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            onClick={() => handleConfirm(c.id, 'COMPLETED')}
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => handleConfirm(c.id, 'FAILED')}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                            Fail
                          </Button>
                        </div>
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
          <CardTitle>Live Aura batches</CardTitle>
          <CardDescription>Batches the Aura team is processing.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {liveBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live Aura batches.</p>
          ) : (
            liveBatches.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface p-3"
              >
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px]">
                    {b.batchNumber}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {b.status}
                  </Badge>
                  {b.sentAt ? (
                    <span className="text-xs text-muted-foreground">
                      sent {new Date(b.sentAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {b.completedCases}/{b.totalCases}
                  <span className="ms-1 uppercase">completed/total</span>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
