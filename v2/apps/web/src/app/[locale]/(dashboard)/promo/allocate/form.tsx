'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { allocatePromoAction } from '@/app/actions/promo';

interface ConfigOption {
  id: string;
  label: string;
  available: number;
  type: 'CUSTOMER_COMPENSATION' | 'SERVICE_RECOVERY';
}

export function AllocateForm({ configs }: { configs: ConfigOption[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [configId, setConfigId] = useState(configs[0]?.id ?? '');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [caseId, setCaseId] = useState('');
  const [reason, setReason] = useState('');
  const [allocated, setAllocated] = useState<{ code: string } | null>(null);

  const selected = configs.find((c) => c.id === configId);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!configId) return;
    if (selected && selected.available <= 0) {
      toast.error('Selected pool has no available codes');
      return;
    }
    startTransition(async () => {
      const result = await allocatePromoAction({
        configId,
        customerEmail,
        customerName,
        ...(caseId.trim() ? { caseId: caseId.trim() } : {}),
        reason,
      });
      if (result.ok) {
        toast.success(`Allocated ${result.data.code}`);
        setAllocated({ code: result.data.code });
        setCustomerEmail('');
        setCustomerName('');
        setCaseId('');
        setReason('');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  if (configs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active configs. Create one first via &ldquo;New config&rdquo; on the promo hub.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Pool">
        <select
          value={configId}
          onChange={(e) => setConfigId(e.target.value)}
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          required
        >
          {configs.map((c) => (
            <option key={c.id} value={c.id} disabled={c.available <= 0}>
              {c.label} ({c.available} available)
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Customer email">
          <input
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
            required
          />
        </Field>
        <Field label="Customer name (optional)">
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
          />
        </Field>
      </div>

      <Field label="Case ID (optional)">
        <input
          type="text"
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          placeholder="case ID to attach this allocation to"
          className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
        />
      </Field>

      <Field label="Reason / notes (optional)">
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-border bg-background p-2 text-sm"
        />
      </Field>

      {selected && selected.type === 'CUSTOMER_COMPENSATION' ? (
        <p className="text-xs text-muted-foreground">
          The code will be emailed to the customer using the
          <code className="mx-1">CUSTOMER_PROMO_COMPENSATION</code>
          template.
        </p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending || (selected ? selected.available <= 0 : false)}>
          {pending ? 'Allocating…' : 'Allocate code'}
        </Button>
      </div>

      {allocated ? (
        <div className="rounded-md border border-success/30 bg-success/10 p-3 text-sm">
          Allocated code: <span className="font-mono font-medium">{allocated.code}</span>
        </div>
      ) : null}
    </form>
  );
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
      {props.label}
      {props.children}
    </label>
  );
}
