'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import { createApprovalBatchAction } from '@/app/actions/approval-batches';

interface CountryOpt {
  id: string;
  code: string;
  name: string;
  managerEmail: string | null;
}
interface PendingCase {
  id: string;
  caseNumber: string;
  countryId: string;
  customerName: string;
  orderNumber: string;
  orderCurrency: string;
  totalRefundAmount: number;
  brandName: string;
  createdAt: string;
}

export function ApprovalBatchPicker(props: { countries: CountryOpt[]; cases: PendingCase[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [countryId, setCountryId] = useState<string>(props.countries[0]?.id ?? '');
  const [recipientEmails, setRecipientEmails] = useState('');
  const [selected, setSelected] = useState<Record<string, true>>({});

  const country = useMemo(() => props.countries.find((c) => c.id === countryId), [props.countries, countryId]);

  const filtered = useMemo(
    () => props.cases.filter((c) => c.countryId === countryId),
    [props.cases, countryId],
  );

  const selectedIds = Object.keys(selected);
  const total = filtered
    .filter((c) => selected[c.id])
    .reduce((s, c) => s + c.totalRefundAmount, 0);
  const currency = filtered.find((c) => selected[c.id])?.orderCurrency ?? '';

  function toggle(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }

  function selectAll() {
    setSelected(Object.fromEntries(filtered.map((c) => [c.id, true as const])));
  }

  function clear() {
    setSelected({});
  }

  function submit() {
    if (!countryId) {
      toast.error('Pick a country');
      return;
    }
    if (selectedIds.length === 0) {
      toast.error('Select at least one case');
      return;
    }
    startTransition(async () => {
      const result = await createApprovalBatchAction({
        countryId,
        caseIds: selectedIds,
        recipientEmails: recipientEmails || undefined,
      });
      if (result.ok) {
        toast.success(`Batch ${result.data.batchNumber} created`);
        router.push(`/operations/approvals/${result.data.batchId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Country" id="countryId" required>
          <Select value={countryId} onValueChange={setCountryId}>
            <SelectTrigger id="countryId">
              <SelectValue placeholder="Choose country" />
            </SelectTrigger>
            <SelectContent>
              {props.countries.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} · {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField
          label="Recipients (override)"
          id="recipientEmails"
          hint={country?.managerEmail ? `Default: ${country.managerEmail}` : 'No country manager email set'}
        >
          <Input
            id="recipientEmails"
            placeholder="manager@example.com, deputy@example.com"
            value={recipientEmails}
            onChange={(e) => setRecipientEmails(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {filtered.length} case(s) for {country?.code ?? '—'} · {selectedIds.length} selected ·
          total {currency ? formatCurrency(total, currency, 'en-US', 2) : `${total.toFixed(2)}`}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={selectAll} disabled={filtered.length === 0}>
            Select all
          </Button>
          <Button size="sm" variant="ghost" onClick={clear} disabled={selectedIds.length === 0}>
            Clear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
              <th></th>
              <th>Case</th>
              <th>Brand</th>
              <th>Customer</th>
              <th>Order</th>
              <th className="text-end">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No pending cases for this country.
                </td>
              </tr>
            ) : (
              filtered.map((c) => (
                <tr key={c.id} className={selected[c.id] ? 'bg-primary/5' : ''}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected[c.id]}
                      onChange={() => toggle(c.id)}
                      aria-label={`Select ${c.caseNumber}`}
                    />
                  </td>
                  <td className="px-3 py-2 font-medium">{c.caseNumber}</td>
                  <td className="px-3 py-2">{c.brandName}</td>
                  <td className="px-3 py-2">{c.customerName}</td>
                  <td className="px-3 py-2 tabular">{c.orderNumber}</td>
                  <td className="px-3 py-2 text-end tabular">
                    {formatCurrency(c.totalRefundAmount, c.orderCurrency, 'en-US', 2)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending || selectedIds.length === 0}>
          {pending ? 'Creating…' : `Create batch (${selectedIds.length})`}
        </Button>
      </div>
    </div>
  );
}
