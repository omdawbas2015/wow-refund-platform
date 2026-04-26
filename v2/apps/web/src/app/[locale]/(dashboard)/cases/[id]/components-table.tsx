'use client';

import { useState, useTransition } from 'react';
import type { CaseStatus, ComponentStatus } from '@wow/db';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { markComponentRefundedAction } from '@/app/actions/cases';
import { isComponentTerminal } from '@/lib/cases/state-machine';

type Variant = 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline';

interface ComponentRow {
  id: string;
  paymentMethodKey: string;
  paymentMethodLabel: string;
  requiresAuthCode: boolean;
  amount: number;
  currency: string;
  status: ComponentStatus;
  statusLabel: string;
  statusVariant: Variant;
  authCode: string | null;
  last4: string | null;
  arn: string | null;
  refundedAt: string | null;
  refundedBy: string | null;
}

export function ComponentsTable(props: {
  caseStatus: CaseStatus;
  components: ComponentRow[];
  localeFmt: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [arnInput, setArnInput] = useState('');
  const [notify, setNotify] = useState(true);

  const canMark =
    props.caseStatus === 'APPROVED' ||
    props.caseStatus === 'IN_EXECUTION' ||
    props.caseStatus === 'PARTIALLY_REFUNDED';

  function submit(componentId: string) {
    if (!arnInput.trim()) {
      toast.error('ARN is required');
      return;
    }
    const fd = new FormData();
    fd.set('componentId', componentId);
    fd.set('arn', arnInput.trim());
    fd.set('notifyCustomer', notify ? 'true' : 'false');
    startTransition(async () => {
      const result = await markComponentRefundedAction(fd);
      if (result.ok) {
        toast.success('Component marked as refunded');
        setEditingId(null);
        setArnInput('');
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle text-muted-foreground">
          <tr className="[&>th]:px-4 [&>th]:py-2.5 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
            <th>Method</th>
            <th className="text-end">Amount</th>
            <th>Auth / Last 4</th>
            <th>ARN</th>
            <th>Status</th>
            <th>Refunded</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {props.components.map((c) => (
            <tr key={c.id} className="align-top">
              <td className="px-4 py-2.5">{c.paymentMethodLabel}</td>
              <td className="px-4 py-2.5 text-end tabular">
                {formatCurrency(c.amount, c.currency, props.localeFmt, 2)}
              </td>
              <td className="px-4 py-2.5 text-xs tabular">
                {c.authCode ? <div>AUTH: {c.authCode}</div> : null}
                {c.last4 ? <div className="text-muted-foreground">**** {c.last4}</div> : null}
                {!c.authCode && !c.last4 ? <span className="text-muted-foreground">—</span> : null}
              </td>
              <td className="px-4 py-2.5 text-xs tabular">
                {c.arn ?? <span className="text-muted-foreground">—</span>}
              </td>
              <td className="px-4 py-2.5">
                <Badge variant={c.statusVariant}>{c.statusLabel}</Badge>
              </td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">
                {c.refundedAt ?? '—'}
                {c.refundedBy ? <div>by {c.refundedBy}</div> : null}
              </td>
              <td className="px-4 py-2.5">
                {!isComponentTerminal(c.status) && canMark ? (
                  editingId === c.id ? (
                    <div className="flex flex-col gap-1.5">
                      <Input
                        value={arnInput}
                        onChange={(e) => setArnInput(e.target.value)}
                        placeholder="ARN / reference"
                        className="h-8 text-xs"
                      />
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={notify}
                          onChange={(e) => setNotify(e.target.checked)}
                        />
                        Email customer
                      </label>
                      <div className="flex justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingId(null);
                            setArnInput('');
                          }}
                          disabled={pending}
                        >
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => submit(c.id)} disabled={pending}>
                          <Check className="h-3.5 w-3.5" />
                          Confirm
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingId(c.id);
                        setArnInput(c.arn ?? '');
                      }}
                    >
                      Mark refunded
                    </Button>
                  )
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
