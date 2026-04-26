'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { updateCountryAction } from '@/app/actions/admin';

interface Row {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  managerEmail: string | null;
  cutoffTime: string;
  sortOrder: number;
}

export function CountriesEditor(props: { countries: Row[] }) {
  const [rows, setRows] = useState<Row[]>(props.countries);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function patch(id: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function save(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    startTransition(async () => {
      const result = await updateCountryAction({
        countryId: row.id,
        isActive: row.isActive,
        managerEmail: row.managerEmail ?? '',
        cutoffTime: row.cutoffTime,
        sortOrder: row.sortOrder,
      });
      if (result.ok) {
        toast.success(`Saved ${row.code}`);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full text-sm">
        <thead className="bg-surface-subtle text-muted-foreground">
          <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
            <th>Code</th>
            <th>Name</th>
            <th>Manager email</th>
            <th>Cutoff</th>
            <th>Sort</th>
            <th>Active</th>
            <th></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => (
            <tr key={c.id}>
              <td className="px-3 py-2 font-medium tabular">{c.code}</td>
              <td className="px-3 py-2">{c.name}</td>
              <td className="px-3 py-2">
                <Input
                  value={c.managerEmail ?? ''}
                  onChange={(e) => patch(c.id, { managerEmail: e.target.value })}
                  placeholder="manager@example.com"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  className="w-24"
                  value={c.cutoffTime}
                  onChange={(e) => patch(c.id, { cutoffTime: e.target.value })}
                  placeholder="17:00"
                />
              </td>
              <td className="px-3 py-2">
                <Input
                  className="w-20"
                  type="number"
                  min={0}
                  value={c.sortOrder}
                  onChange={(e) => patch(c.id, { sortOrder: Number(e.target.value) || 0 })}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={c.isActive}
                  onChange={(e) => patch(c.id, { isActive: e.target.checked })}
                />
              </td>
              <td className="px-3 py-2">
                <Button size="sm" onClick={() => save(c.id)} disabled={pending}>
                  Save
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
