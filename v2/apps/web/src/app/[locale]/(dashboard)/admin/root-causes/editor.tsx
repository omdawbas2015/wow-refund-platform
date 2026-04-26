'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertRootCauseAction } from '@/app/actions/admin';

interface Row {
  id: string | null;
  key: string;
  label: string;
  labelAr: string | null;
  category: string | null;
  requiresEvidence: boolean;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY: Row = {
  id: null,
  key: '',
  label: '',
  labelAr: '',
  category: '',
  requiresEvidence: false,
  isActive: true,
  sortOrder: 0,
};

export function RootCausesEditor(props: { rootCauses: Row[] }) {
  const [rows, setRows] = useState<Row[]>(props.rootCauses);
  const [draft, setDraft] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function patch(id: string | null, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(row: Row) {
    startTransition(async () => {
      const result = await upsertRootCauseAction({
        rootCauseId: row.id ?? undefined,
        key: row.key,
        label: row.label,
        labelAr: row.labelAr ?? '',
        category: row.category ?? '',
        requiresEvidence: row.requiresEvidence,
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

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setDraft({ ...EMPTY, sortOrder: rows.length })} size="sm" disabled={!!draft}>
          New cause
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
              <th>Key</th>
              <th>Label</th>
              <th>Label (AR)</th>
              <th>Category</th>
              <th>Evidence?</th>
              <th>Sort</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {draft ? (
              <Editor
                row={draft}
                onPatch={(p) => setDraft({ ...draft, ...p })}
                onCancel={() => setDraft(null)}
                onSave={save}
                pending={pending}
                draft
              />
            ) : null}
            {rows.map((r) => (
              <Editor
                key={r.id}
                row={r}
                onPatch={(p) => patch(r.id, p)}
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

function Editor(props: {
  row: Row;
  onPatch: (p: Partial<Row>) => void;
  onSave: (r: Row) => void;
  onCancel?: () => void;
  pending: boolean;
  draft?: boolean;
}) {
  const { row, onPatch, onSave, onCancel, pending, draft } = props;
  return (
    <tr className={draft ? 'bg-primary/5' : ''}>
      <td className="px-3 py-2">
        <Input className="w-40" value={row.key} onChange={(e) => onPatch({ key: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <Input value={row.label} onChange={(e) => onPatch({ label: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <Input value={row.labelAr ?? ''} onChange={(e) => onPatch({ labelAr: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <Input value={row.category ?? ''} onChange={(e) => onPatch({ category: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={row.requiresEvidence}
          onChange={(e) => onPatch({ requiresEvidence: e.target.checked })}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          className="w-20"
          value={row.sortOrder}
          onChange={(e) => onPatch({ sortOrder: Number(e.target.value) || 0 })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={row.isActive}
          onChange={(e) => onPatch({ isActive: e.target.checked })}
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
