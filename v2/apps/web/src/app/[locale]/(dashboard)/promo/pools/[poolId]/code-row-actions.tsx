'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { deletePromoCodeAction, restorePromoCodeAction } from '@/app/actions/promo';

type Props = {
  codeId: string;
  status: string;
};

/**
 * Per-code action buttons shown to pool admins.
 * - Delete: only for AVAILABLE codes.
 * - Restore: only for ALLOCATED codes (flips back to AVAILABLE + drops alloc).
 * Every destructive action prompts a confirm() first so misclicks don't wipe
 * inventory.
 */
export function CodeRowActions({ codeId, status }: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function del() {
    if (!confirm('Delete this code permanently? This cannot be undone.')) return;
    setError(null);
    startTransition(async () => {
      const res = await deletePromoCodeAction(codeId);
      if (!res.ok) setError(res.error);
    });
  }

  function restore() {
    if (
      !confirm(
        'Restore this code back to AVAILABLE? The customer-facing allocation record will be deleted. An audit entry is kept.',
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await restorePromoCodeAction(codeId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex items-center gap-1">
      {pending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
      {error && <span className="text-xs text-destructive">{error}</span>}
      {status === 'AVAILABLE' && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
          onClick={del}
          disabled={pending}
          title="Delete code"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
      {status === 'ALLOCATED' && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs"
          onClick={restore}
          disabled={pending}
          title="Restore to available"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          <span className="ml-1">Restore</span>
        </Button>
      )}
    </div>
  );
}
