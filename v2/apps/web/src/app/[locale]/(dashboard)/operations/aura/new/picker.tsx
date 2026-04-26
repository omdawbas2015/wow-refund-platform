'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/ui/form-field';
import { createAuraBatchAction } from '@/app/actions/aura-batches';

interface CaseRow {
  id: string;
  caseNumber: string;
  customerName: string;
  customerEmail: string;
  orderNumber: string;
  auraPoints: number;
  brandName: string;
  countryCode: string;
}

export function AuraBatchPicker(props: { cases: CaseRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [recipientEmails, setRecipientEmails] = useState('');
  const [scheduledFor, setScheduledFor] = useState(() => new Date().toISOString().slice(0, 10));
  const [selected, setSelected] = useState<Record<string, true>>({});

  const selectedIds = Object.keys(selected);
  const totalPoints = useMemo(
    () => props.cases.filter((c) => selected[c.id]).reduce((s, c) => s + c.auraPoints, 0),
    [props.cases, selected],
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      return next;
    });
  }
  function selectAll() {
    setSelected(Object.fromEntries(props.cases.map((c) => [c.id, true as const])));
  }
  function clear() {
    setSelected({});
  }

  function submit() {
    if (selectedIds.length === 0) {
      toast.error('Select at least one case');
      return;
    }
    startTransition(async () => {
      const result = await createAuraBatchAction({
        caseIds: selectedIds,
        scheduledFor: new Date(scheduledFor),
        recipientEmails: recipientEmails || undefined,
      });
      if (result.ok) {
        toast.success(`Batch ${result.data.batchNumber} created`);
        router.push(`/operations/aura/${result.data.batchId}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Scheduled for" id="scheduledFor" hint="Today by default">
          <Input
            id="scheduledFor"
            type="date"
            value={scheduledFor}
            onChange={(e) => setScheduledFor(e.target.value)}
          />
        </FormField>
        <FormField
          label="Recipients (override)"
          id="recipientEmails"
          hint="Comma-separated; defaults to AURA_TEAM_EMAIL env var"
        >
          <Input
            id="recipientEmails"
            placeholder="aura@example.com"
            value={recipientEmails}
            onChange={(e) => setRecipientEmails(e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {props.cases.length} eligible case(s) · {selectedIds.length} selected · {totalPoints} pts
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={selectAll} disabled={props.cases.length === 0}>
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
              <th>Country</th>
              <th>Case</th>
              <th>Customer</th>
              <th>Brand</th>
              <th>Order</th>
              <th className="text-end">Points</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {props.cases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No Aura-pending cases right now.
                </td>
              </tr>
            ) : (
              props.cases.map((c) => (
                <tr key={c.id} className={selected[c.id] ? 'bg-primary/5' : ''}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={!!selected[c.id]}
                      onChange={() => toggle(c.id)}
                      aria-label={`Select case ${c.caseNumber}`}
                    />
                  </td>
                  <td className="px-3 py-2 tabular">{c.countryCode}</td>
                  <td className="px-3 py-2 font-medium">{c.caseNumber}</td>
                  <td className="px-3 py-2">{c.customerName}</td>
                  <td className="px-3 py-2">{c.brandName}</td>
                  <td className="px-3 py-2 tabular">{c.orderNumber}</td>
                  <td className="px-3 py-2 text-end tabular">{c.auraPoints}</td>
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
