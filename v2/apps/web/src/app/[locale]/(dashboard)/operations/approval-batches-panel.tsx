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
import { Send, Mail, X } from 'lucide-react';
import {
  createApprovalBatchAction,
  cancelApprovalBatchAction,
} from '@/app/actions/batches';

interface CountryRow {
  id: string;
  code: string;
  name: string;
  flag: string;
  managerEmail: string | null;
  pendingCount: number;
  pendingTotal: number;
  currency: string;
}

interface BatchCase {
  id: string;
  caseNumber: string;
  customerName: string;
  status: string;
  amount: number;
  currency: string;
}

interface LiveBatch {
  id: string;
  batchNumber: string;
  countryName: string;
  countryFlag: string;
  status: string;
  sentAt: string | null;
  recipientEmails: string;
  totalCases: number;
  approvedCases: number;
  rejectedCases: number;
  cases: BatchCase[];
}

export function ApprovalBatchesPanel({
  countries,
  liveBatches,
}: {
  countries: CountryRow[];
  liveBatches: LiveBatch[];
}) {
  const [pending, startTransition] = useTransition();

  function handleSend(country: CountryRow) {
    if (country.pendingCount === 0) {
      toast.info(`No pending cases for ${country.name}.`);
      return;
    }
    if (!country.managerEmail) {
      toast.error(`No manager email configured for ${country.name}. Set it in Admin → Countries.`);
      return;
    }
    startTransition(async () => {
      const result = await createApprovalBatchAction({ countryId: country.id });
      if (result.ok && 'data' in result && result.data) {
        toast.success(
          `Approval batch ${result.data.batchNumber} sent — ${result.data.cases} case${
            result.data.cases === 1 ? '' : 's'
          }.`,
        );
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function handleCancel(batch: LiveBatch) {
    if (!confirm(`Cancel batch ${batch.batchNumber}? Linked cases return to the queue.`)) return;
    startTransition(async () => {
      const result = await cancelApprovalBatchAction({
        batchId: batch.id,
        reason: 'Cancelled from operations desk',
      });
      if (result.ok) toast.success(`Batch ${batch.batchNumber} cancelled.`);
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Send daily approval batch</CardTitle>
          <CardDescription>
            Roll up every PENDING_APPROVAL case for a country into a batch and email
            the manager. Replies are auto-parsed via the Power Automate webhook.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {countries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active countries configured.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th className="px-3 py-2 text-start font-medium">Country</th>
                    <th className="px-3 py-2 text-start font-medium">Manager email</th>
                    <th className="px-3 py-2 text-end font-medium">Pending</th>
                    <th className="px-3 py-2 text-end font-medium">Total refund</th>
                    <th className="px-3 py-2 text-end font-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {countries.map((c) => (
                    <tr key={c.id} className="border-b border-border/60 last:border-b-0">
                      <td className="px-3 py-2.5">
                        <span className="me-1.5 text-base leading-none">{c.flag || '🌐'}</span>
                        <span className="font-medium text-heading">{c.name}</span>
                        <span className="ms-1 text-xs text-muted-foreground">({c.code})</span>
                      </td>
                      <td className="px-3 py-2.5 text-muted-foreground">
                        {c.managerEmail ?? <span className="italic text-warning">not set</span>}
                      </td>
                      <td className="px-3 py-2.5 text-end tabular">{c.pendingCount}</td>
                      <td className="px-3 py-2.5 text-end tabular">
                        {c.pendingCount === 0 ? '—' : `${c.pendingTotal.toFixed(2)} ${c.currency}`}
                      </td>
                      <td className="px-3 py-2.5 text-end">
                        <Button
                          size="sm"
                          variant={c.pendingCount > 0 ? 'default' : 'outline'}
                          disabled={pending || c.pendingCount === 0 || !c.managerEmail}
                          onClick={() => handleSend(c)}
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send batch
                        </Button>
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
          <CardTitle>Live approval batches</CardTitle>
          <CardDescription>
            Batches that have been emailed and are awaiting (or partially have) a decision.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {liveBatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live batches.</p>
          ) : (
            liveBatches.map((b) => (
              <div key={b.id} className="rounded-lg border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-medium text-heading">
                      <span className="text-base leading-none">{b.countryFlag || '🌐'}</span>
                      <span>{b.countryName}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {b.batchNumber}
                      </Badge>
                      <Badge
                        variant={b.status === 'PARTIALLY_DECIDED' ? 'warning' : 'secondary'}
                        className="text-[10px]"
                      >
                        {b.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <Mail className="me-1 inline h-3 w-3" />
                      {b.recipientEmails}
                      {b.sentAt ? <> · sent {new Date(b.sentAt).toLocaleString()}</> : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground">
                      {b.approvedCases}/{b.rejectedCases}/{b.totalCases}
                      <span className="ms-1 text-[10px] uppercase">approved/rejected/total</span>
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancel(b)}
                      disabled={pending}
                    >
                      <X className="h-3.5 w-3.5" />
                      Cancel
                    </Button>
                  </div>
                </div>

                <ul className="mt-3 space-y-1 text-xs">
                  {b.cases.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between gap-2 rounded-md bg-surface-subtle/60 px-2 py-1"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono">{c.caseNumber}</span>
                        <span className="text-muted-foreground">{c.customerName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="tabular text-muted-foreground">
                          {c.amount.toFixed(2)} {c.currency}
                        </span>
                        <Badge
                          variant={
                            c.status === 'APPROVED'
                              ? 'success'
                              : c.status === 'REJECTED'
                                ? 'destructive'
                                : 'outline'
                          }
                          className="text-[10px]"
                        >
                          {c.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
