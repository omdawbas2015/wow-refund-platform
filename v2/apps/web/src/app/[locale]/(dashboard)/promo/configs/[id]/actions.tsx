'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { uploadPromoCodesAction, togglePromoConfigAction } from '@/app/actions/promo';
import { parsePromoCodesText } from '@wow/validators';

export function ConfigActions(props: {
  configId: string;
  isActive: boolean;
  locale: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [codesRaw, setCodesRaw] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  function upload() {
    if (!codesRaw.trim()) {
      toast.error('Paste at least one code');
      return;
    }
    const codes = parsePromoCodesText(codesRaw);
    if (codes.length === 0) {
      toast.error('No valid codes found');
      return;
    }
    startTransition(async () => {
      const result = await uploadPromoCodesAction({
        poolId: props.configId,
        codes,
        ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
      });
      if (result.ok && result.data) {
        const inserted = result.data.inserted ?? 0;
        const skipped = result.data.skipped ?? 0;
        toast.success(`Uploaded ${inserted} codes (${skipped} skipped)`);
        setCodesRaw('');
        setExpiresAt('');
        router.refresh();
      } else if (!result.ok) {
        toast.error(result.error);
      }
    });
  }

  function toggle() {
    startTransition(async () => {
      const result = await togglePromoConfigAction({
        configId: props.configId,
        isActive: !props.isActive,
      });
      if (result.ok) {
        toast.success(props.isActive ? 'Deactivated' : 'Activated');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase text-muted-foreground">
          Upload codes (one per line; blank lines and duplicates ignored)
        </label>
        <textarea
          value={codesRaw}
          onChange={(e) => setCodesRaw(e.target.value)}
          rows={6}
          placeholder="WOW-2026-001&#10;WOW-2026-002&#10;…"
          className="w-full rounded-md border border-border bg-background p-2 font-mono text-xs"
        />
        <div className="mt-2 flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs uppercase text-muted-foreground">
            Expires at
            <input
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="h-9 rounded-md border border-border bg-background px-2 text-sm"
            />
          </label>
          <Button onClick={upload} disabled={pending}>
            {pending ? 'Uploading…' : 'Upload'}
          </Button>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <Button onClick={toggle} variant="outline" disabled={pending}>
          {props.isActive ? 'Deactivate config' : 'Activate config'}
        </Button>
      </div>
    </div>
  );
}
