'use client';

import { useTransition, useState } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { setModuleToggleAction } from '@/app/actions/admin-modules';
import type { ModuleToggleStatus } from '@/lib/module-toggles';

export function ModuleToggleRow({ module }: { module: ModuleToggleStatus }) {
  const [pending, start] = useTransition();
  const [enabled, setEnabled] = useState(module.isEnabled);

  const flip = () => {
    const next = !enabled;
    start(async () => {
      const result = await setModuleToggleAction({
        key: module.key,
        isEnabled: next,
      });
      if (!result.ok) {
        toast.error(result.error ?? 'Toggle failed');
        return;
      }
      setEnabled(next);
      toast.success(`${module.label} ${next ? 'enabled' : 'disabled'}`);
    });
  };

  return (
    <li className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-heading">{module.label}</span>
          <code className="rounded bg-surface-subtle px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {module.key}
          </code>
          {module.isDefault ? (
            <Badge variant="outline" className="text-[10px]">
              default
            </Badge>
          ) : null}
        </div>
        {module.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground">{module.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={`Toggle ${module.label}`}
        onClick={flip}
        disabled={pending}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          enabled ? 'bg-primary' : 'bg-border'
        } ${pending ? 'opacity-60' : ''}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-background shadow-sm transition-transform ${
            enabled ? 'translate-x-4' : 'translate-x-0.5'
          }`}
        />
      </button>
    </li>
  );
}
