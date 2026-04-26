'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertSettingAction, deleteSettingAction } from '@/app/actions/admin';

interface Row {
  key: string;
  value: string;
  description: string | null;
  updatedAt: string;
  updatedBy: string | null;
  isNew?: boolean;
}

export function SettingsEditor(props: { settings: Row[] }) {
  const [rows, setRows] = useState<Row[]>(props.settings);
  const [draft, setDraft] = useState<Row | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function patch(key: string, p: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...p } : r)));
  }

  function save(row: Row) {
    if (!row.key.trim()) {
      toast.error('Key is required');
      return;
    }
    setPendingKey(row.key);
    startTransition(async () => {
      const result = await upsertSettingAction({
        key: row.key,
        value: row.value,
        description: row.description ?? '',
      });
      setPendingKey(null);
      if (result.ok) {
        toast.success('Saved');
        if (draft && draft.key === row.key) {
          setRows((prev) => [
            ...prev,
            { ...row, isNew: false, updatedAt: new Date().toISOString() },
          ]);
          setDraft(null);
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function remove(row: Row) {
    if (!confirm(`Delete setting "${row.key}"?`)) return;
    setPendingKey(row.key);
    startTransition(async () => {
      const result = await deleteSettingAction({ key: row.key });
      setPendingKey(null);
      if (result.ok) {
        toast.success('Deleted');
        setRows((prev) => prev.filter((r) => r.key !== row.key));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function newRow() {
    setDraft({
      key: '',
      value: '',
      description: '',
      updatedAt: new Date().toISOString(),
      updatedBy: null,
      isNew: true,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={newRow} size="sm" disabled={!!draft}>
          New setting
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr>
              <th className="px-3 py-2 text-start font-medium">Key</th>
              <th className="px-3 py-2 text-start font-medium">Value (JSON)</th>
              <th className="px-3 py-2 text-start font-medium">Description</th>
              <th className="px-3 py-2 text-end font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !draft ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-foreground">
                  No settings yet. Click <strong>New setting</strong> to add one.
                </td>
              </tr>
            ) : null}

            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border">
                <td className="px-3 py-2 align-top">
                  <code className="font-mono text-xs text-heading">{row.key}</code>
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={row.value}
                    onChange={(e) => patch(row.key, { value: e.target.value })}
                    className="font-mono text-xs"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={row.description ?? ''}
                    onChange={(e) => patch(row.key, { description: e.target.value })}
                    placeholder="(optional)"
                  />
                </td>
                <td className="px-3 py-2 text-end align-top">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => save(row)}
                      disabled={pendingKey === row.key}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => remove(row)}
                      disabled={pendingKey === row.key}
                    >
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}

            {draft ? (
              <tr className="border-t border-border bg-primary/5">
                <td className="px-3 py-2 align-top">
                  <Input
                    autoFocus
                    value={draft.key}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, key: e.target.value } : d))
                    }
                    placeholder="refund.daily_cutoff"
                    className="font-mono text-xs"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={draft.value}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, value: e.target.value } : d))
                    }
                    placeholder='"17:00"'
                    className="font-mono text-xs"
                  />
                </td>
                <td className="px-3 py-2 align-top">
                  <Input
                    value={draft.description ?? ''}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, description: e.target.value } : d))
                    }
                    placeholder="(optional)"
                  />
                </td>
                <td className="px-3 py-2 text-end align-top">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => save(draft)}
                      disabled={pendingKey === draft.key}
                    >
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
                      Cancel
                    </Button>
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
