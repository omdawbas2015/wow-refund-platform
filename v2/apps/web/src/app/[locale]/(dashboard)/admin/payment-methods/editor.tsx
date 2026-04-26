'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { upsertPaymentMethodAction } from '@/app/actions/admin';

interface Row {
  id: string | null;
  key: string;
  label: string;
  labelAr: string | null;
  iconSlug: string | null;
  iconUrl: string | null;
  color: string | null;
  requiresAuthCode: boolean;
  executionType: 'MANUAL' | 'BATCH';
  isActive: boolean;
  sortOrder: number;
}

const EMPTY: Row = {
  id: null,
  key: '',
  label: '',
  labelAr: '',
  iconSlug: '',
  iconUrl: '',
  color: '',
  requiresAuthCode: false,
  executionType: 'MANUAL',
  isActive: true,
  sortOrder: 0,
};

export function PaymentMethodsEditor(props: { methods: Row[] }) {
  const [rows, setRows] = useState<Row[]>(props.methods);
  const [draft, setDraft] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function patch(id: string | null, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(row: Row) {
    startTransition(async () => {
      const result = await upsertPaymentMethodAction({
        paymentMethodId: row.id ?? undefined,
        key: row.key,
        label: row.label,
        labelAr: row.labelAr ?? '',
        iconSlug: row.iconSlug ?? '',
        iconUrl: row.iconUrl ?? '',
        color: row.color ?? '',
        requiresAuthCode: row.requiresAuthCode,
        executionType: row.executionType,
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      });
      if (result.ok) {
        toast.success('Saved');
        if (!row.id) {
          const newRow: Row = { ...row, id: result.data.id };
          setRows((prev) => [...prev, newRow]);
          setDraft(null);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function newRow() {
    setDraft({ ...EMPTY, sortOrder: rows.length });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={newRow} size="sm" disabled={!!draft}>
          New method
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
              <th>Key</th>
              <th>Label</th>
              <th>Label (AR)</th>
              <th>Auth?</th>
              <th>Execution</th>
              <th>Sort</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {draft ? (
              <RowEditor
                row={draft}
                onPatch={(next) => setDraft({ ...draft, ...next })}
                onCancel={() => setDraft(null)}
                onSave={save}
                pending={pending}
                draft
              />
            ) : null}
            {rows.map((r) => (
              <RowEditor
                key={r.id}
                row={r}
                onPatch={(next) => patch(r.id, next)}
                onSave={save}
                pending={pending}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RowEditor(props: {
  row: Row;
  onPatch: (next: Partial<Row>) => void;
  onCancel?: () => void;
  onSave: (r: Row) => void;
  pending: boolean;
  draft?: boolean;
}) {
  const { row, onPatch, onCancel, onSave, pending, draft } = props;
  const setRow = onPatch;
  return (
    <tr className={draft ? 'bg-primary/5' : ''}>
      <td className="px-3 py-2">
        <Input value={row.key} onChange={(e) => setRow({ key: e.target.value })} className="w-32" />
      </td>
      <td className="px-3 py-2">
        <Input value={row.label} onChange={(e) => setRow({ label: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <Input value={row.labelAr ?? ''} onChange={(e) => setRow({ labelAr: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={row.requiresAuthCode}
          onChange={(e) => setRow({ requiresAuthCode: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2">
        <Select
          value={row.executionType}
          onValueChange={(v) => setRow({ executionType: v as 'MANUAL' | 'BATCH' })}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="MANUAL">Manual</SelectItem>
            <SelectItem value="BATCH">Batch</SelectItem>
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          className="w-20"
          value={row.sortOrder}
          onChange={(e) => setRow({ sortOrder: Number(e.target.value) || 0 })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={row.isActive}
          onChange={(e) => setRow({ isActive: e.target.checked })}
        />
      </td>
      <td className="space-x-1 px-3 py-2 whitespace-nowrap">
        <Button size="sm" onClick={() => onSave(row)} disabled={pending}>
          {draft ? 'Create' : 'Save'}
        </Button>
        {draft && onCancel ? (
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={pending}>
            Cancel
          </Button>
        ) : null}
      </td>
    </tr>
  );
}
