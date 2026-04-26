'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  upsertSlaRuleAction,
  deleteSlaRuleAction,
  toggleSlaRuleActiveAction,
} from '@/app/actions/admin';

interface RuleRow {
  id: string;
  name: string;
  countryId: string | null;
  brandId: string | null;
  rootCauseId: string | null;
  thresholdHours: number;
  warningHours: number | null;
  escalateToRole: string | null;
  isActive: boolean;
}

interface DraftRow extends Omit<RuleRow, 'id'> {
  id: string | null; // null = unsaved
  dirty: boolean;
}

interface Option {
  id: string;
  name: string;
  code?: string;
}

const ROLE_OPTIONS = ['ADMIN', 'COUNTRY_MANAGER', 'OPERATIONS', 'FINANCE'];

function emptyDraft(): DraftRow {
  return {
    id: null,
    name: '',
    countryId: null,
    brandId: null,
    rootCauseId: null,
    thresholdHours: 48,
    warningHours: 24,
    escalateToRole: null,
    isActive: true,
    dirty: true,
  };
}

export function SlaRulesEditor({
  rules,
  countries,
  brands,
  rootCauses,
}: {
  rules: RuleRow[];
  countries: Option[];
  brands: Option[];
  rootCauses: Option[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draftRows, setDraftRows] = useState<DraftRow[]>([]);

  function addNew() {
    setDraftRows((prev) => [emptyDraft(), ...prev]);
  }

  function patchDraft(idx: number, patch: Partial<DraftRow>) {
    setDraftRows((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, ...patch, dirty: true } : d)),
    );
  }

  function removeDraft(idx: number) {
    setDraftRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function save(idx: number) {
    const draft = draftRows[idx];
    if (!draft) return;
    startTransition(async () => {
      const result = await upsertSlaRuleAction({
        ...(draft.id ? { id: draft.id } : {}),
        name: draft.name,
        countryId: draft.countryId ?? '',
        brandId: draft.brandId ?? '',
        rootCauseId: draft.rootCauseId ?? '',
        thresholdHours: draft.thresholdHours,
        ...(draft.warningHours !== null ? { warningHours: draft.warningHours } : {}),
        escalateToRole: draft.escalateToRole ?? '',
        isActive: draft.isActive,
      });
      if (result.ok) {
        toast.success(draft.id ? 'Rule updated.' : 'Rule created.');
        removeDraft(idx);
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function startEdit(rule: RuleRow) {
    if (draftRows.some((d) => d.id === rule.id)) return;
    setDraftRows((prev) => [{ ...rule, dirty: false }, ...prev]);
  }

  function destroy(rule: RuleRow) {
    if (!confirm(`Delete SLA rule "${rule.name}"?`)) return;
    startTransition(async () => {
      const result = await deleteSlaRuleAction({ id: rule.id });
      if (result.ok) {
        toast.success('Rule deleted.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  function toggleActive(rule: RuleRow) {
    startTransition(async () => {
      const result = await toggleSlaRuleActiveAction({
        id: rule.id,
        isActive: !rule.isActive,
      });
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={addNew}
        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        + New rule
      </button>

      {draftRows.map((draft, idx) => (
        <div
          key={`d-${idx}`}
          className="rounded-md border border-primary/30 bg-primary/5 p-4"
        >
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            <Field label="Name">
              <input
                value={draft.name}
                onChange={(e) => patchDraft(idx, { name: e.target.value })}
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
                placeholder="e.g. KW · default · 48h"
              />
            </Field>
            <Field label="Country (optional)">
              <Select
                value={draft.countryId ?? ''}
                onChange={(v) => patchDraft(idx, { countryId: v || null })}
                options={[{ id: '', name: 'Any' }, ...countries.map((c) => ({ id: c.id, name: c.code ? `${c.code} · ${c.name}` : c.name }))]}
              />
            </Field>
            <Field label="Brand (optional)">
              <Select
                value={draft.brandId ?? ''}
                onChange={(v) => patchDraft(idx, { brandId: v || null })}
                options={[{ id: '', name: 'Any' }, ...brands]}
              />
            </Field>
            <Field label="Root cause (optional)">
              <Select
                value={draft.rootCauseId ?? ''}
                onChange={(v) => patchDraft(idx, { rootCauseId: v || null })}
                options={[{ id: '', name: 'Any' }, ...rootCauses]}
              />
            </Field>
            <Field label="Threshold hours">
              <input
                type="number"
                min={1}
                value={draft.thresholdHours}
                onChange={(e) =>
                  patchDraft(idx, { thresholdHours: Number(e.target.value) || 0 })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm tabular"
              />
            </Field>
            <Field label="Warning hours (optional)">
              <input
                type="number"
                min={0}
                value={draft.warningHours ?? ''}
                onChange={(e) =>
                  patchDraft(idx, {
                    warningHours: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm tabular"
              />
            </Field>
            <Field label="Escalate to role (optional)">
              <Select
                value={draft.escalateToRole ?? ''}
                onChange={(v) => patchDraft(idx, { escalateToRole: v || null })}
                options={[{ id: '', name: '—' }, ...ROLE_OPTIONS.map((r) => ({ id: r, name: r }))]}
              />
            </Field>
            <Field label="Active">
              <label className="inline-flex h-9 items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={draft.isActive}
                  onChange={(e) => patchDraft(idx, { isActive: e.target.checked })}
                  className="h-4 w-4"
                />
                <span className="text-muted-foreground">Enabled</span>
              </label>
            </Field>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => removeDraft(idx)}
              disabled={pending}
              className="h-8 rounded-md border border-border px-3 text-xs hover:bg-surface-subtle disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => save(idx)}
              disabled={pending || !draft.name || draft.thresholdHours < 1}
              className="h-8 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {pending ? 'Saving…' : draft.id ? 'Save changes' : 'Create rule'}
            </button>
          </div>
        </div>
      ))}

      <div className="overflow-hidden rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle text-muted-foreground">
            <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-start [&>th]:text-xs [&>th]:font-medium [&>th]:uppercase">
              <th>Name</th>
              <th>Scope</th>
              <th>Threshold</th>
              <th>Warning</th>
              <th>Escalate</th>
              <th>Active</th>
              <th className="!text-end">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rules.map((r) => (
              <tr key={r.id} className="hover:bg-surface-subtle">
                <td className="px-3 py-2 font-medium text-heading">{r.name}</td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {[r.countryId && lookup(countries, r.countryId), r.brandId && lookup(brands, r.brandId), r.rootCauseId && lookup(rootCauses, r.rootCauseId)]
                    .filter(Boolean)
                    .join(' · ') || 'Any'}
                </td>
                <td className="px-3 py-2 tabular">{r.thresholdHours}h</td>
                <td className="px-3 py-2 tabular text-muted-foreground">
                  {r.warningHours !== null ? `${r.warningHours}h` : '—'}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {r.escalateToRole ?? '—'}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(r)}
                    disabled={pending}
                    className={`inline-flex h-6 w-11 items-center rounded-full border transition-colors ${
                      r.isActive
                        ? 'border-primary bg-primary/90 justify-end'
                        : 'border-border bg-surface-subtle justify-start'
                    }`}
                  >
                    <span className="m-0.5 h-4 w-4 rounded-full bg-background" />
                  </button>
                </td>
                <td className="px-3 py-2 text-end">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="mr-2 inline-flex h-7 items-center rounded-md border border-border px-2 text-xs hover:bg-surface-subtle"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => destroy(r)}
                    disabled={pending}
                    className="inline-flex h-7 items-center rounded-md border border-destructive/40 px-2 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-sm text-muted-foreground">
                  No SLA rules yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs uppercase text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border border-border bg-background px-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.id || '__any'} value={o.id}>
          {o.name}
        </option>
      ))}
    </select>
  );
}

function lookup(list: Option[], id: string): string | null {
  return list.find((o) => o.id === id)?.name ?? null;
}
