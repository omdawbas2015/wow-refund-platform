'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { toggleFeatureFlagAction } from '@/app/actions/admin';

interface Flag {
  key: string;
  enabled: boolean;
  description: string | null;
  updatedAt: string;
}

export function FeatureFlagsEditor(props: { flags: Flag[] }) {
  const [flags, setFlags] = useState<Flag[]>(props.flags);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();

  function toggle(flag: Flag, next: boolean) {
    if (pendingKey) return;
    setPendingKey(flag.key);
    setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: next } : f)));
    startTransition(async () => {
      const result = await toggleFeatureFlagAction({ key: flag.key, enabled: next });
      setPendingKey(null);
      if (result.ok) {
        toast.success(next ? 'Flag enabled' : 'Flag disabled');
        router.refresh();
      } else {
        // Roll back optimistic update.
        setFlags((prev) => prev.map((f) => (f.key === flag.key ? { ...f, enabled: !next } : f)));
        toast.error(result.error);
      }
    });
  }

  if (flags.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
        No feature flags registered yet. They are seeded from{' '}
        <code className="rounded bg-surface-subtle px-1 py-0.5 text-xs">packages/db/prisma/seed.ts</code>.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-md border border-border">
      {flags.map((flag) => (
        <li key={flag.key} className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-sm text-heading">{flag.key}</div>
            {flag.description ? (
              <div className="mt-0.5 text-xs text-muted-foreground">{flag.description}</div>
            ) : null}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={flag.enabled}
            aria-label={`Toggle ${flag.key}`}
            disabled={pendingKey === flag.key}
            onClick={() => toggle(flag, !flag.enabled)}
            className={
              'relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
              (flag.enabled ? 'bg-primary' : 'bg-border')
            }
          >
            <span
              className={
                'absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ' +
                (flag.enabled ? 'translate-x-4' : 'translate-x-0.5')
              }
            />
          </button>
        </li>
      ))}
    </ul>
  );
}
