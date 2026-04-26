'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertBrandAction } from '@/app/actions/admin';

interface Row {
  id: string | null;
  name: string;
  nameAr: string | null;
  slug: string;
  logoUrl: string | null;
  isActive: boolean;
  sortOrder: number;
}

export function BrandsEditor(props: { brands: Row[] }) {
  const [rows, setRows] = useState<Row[]>(props.brands);
  const [draft, setDraft] = useState<Row | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function patch(id: string | null, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
  }

  function save(row: Row) {
    startTransition(async () => {
      const result = await upsertBrandAction({
        brandId: row.id ?? undefined,
        name: row.name,
        nameAr: row.nameAr ?? '',
        slug: row.slug,
        logoUrl: row.logoUrl ?? '',
        isActive: row.isActive,
        sortOrder: row.sortOrder,
      });
      if (result.ok) {
        toast.success('Saved');
        if (!row.id) {
          // Newly created — append to local state so it stays visible after
          // router.refresh() (which does NOT re-seed useState).
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
    setDraft({
      id: null,
      name: '',
      nameAr: '',
      slug: '',
      logoUrl: '',
      isActive: true,
      sortOrder: rows.length,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={newRow} size="sm" disabled={!!draft}>
          New brand
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
              <th>Name</th>
              <th>Name (AR)</th>
              <th>Slug</th>
              <th>Logo URL</th>
              <th>Sort</th>
              <th>Active</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {draft ? (
              <DraftRow draft={draft} setDraft={setDraft} onSave={save} pending={pending} />
            ) : null}
            {rows.map((b) => (
              <tr key={b.id}>
                <td className="px-3 py-2">
                  <Input value={b.name} onChange={(e) => patch(b.id, { name: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={b.nameAr ?? ''}
                    onChange={(e) => patch(b.id, { nameAr: e.target.value })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input value={b.slug} onChange={(e) => patch(b.id, { slug: e.target.value })} />
                </td>
                <td className="px-3 py-2">
                  <Input
                    value={b.logoUrl ?? ''}
                    onChange={(e) => patch(b.id, { logoUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    className="w-20"
                    value={b.sortOrder}
                    onChange={(e) => patch(b.id, { sortOrder: Number(e.target.value) || 0 })}
                  />
                </td>
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={b.isActive}
                    onChange={(e) => patch(b.id, { isActive: e.target.checked })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Button size="sm" onClick={() => save(b)} disabled={pending}>
                    Save
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DraftRow(props: {
  draft: Row;
  setDraft: (r: Row | null) => void;
  onSave: (r: Row) => void;
  pending: boolean;
}) {
  const { draft, setDraft, onSave, pending } = props;
  return (
    <tr className="bg-primary/5">
      <td className="px-3 py-2">
        <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <Input
          value={draft.nameAr ?? ''}
          onChange={(e) => setDraft({ ...draft, nameAr: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <Input value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} />
      </td>
      <td className="px-3 py-2">
        <Input
          value={draft.logoUrl ?? ''}
          onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          className="w-20"
          value={draft.sortOrder}
          onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) || 0 })}
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="checkbox"
          checked={draft.isActive}
          onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
        />
      </td>
      <td className="space-x-1 px-3 py-2 whitespace-nowrap">
        <Button size="sm" onClick={() => onSave(draft)} disabled={pending}>
          Create
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={pending}>
          Cancel
        </Button>
      </td>
    </tr>
  );
}
