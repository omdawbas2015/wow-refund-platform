'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { RefreshCw } from 'lucide-react';
import { resendEmailLogAction } from '@/app/actions/emails';

export function ResendEmailButton({ logId }: { logId: string }) {
  const [pending, start] = useTransition();

  const handleClick = () => {
    if (pending) return;
    start(async () => {
      const result = await resendEmailLogAction({ logId });
      if (!result.ok) {
        toast.error(result.error ?? 'Could not resend email');
        return;
      }
      if (result.data.delivered) {
        toast.success('Email resent');
      } else {
        toast.warning('Email queued but provider reported failure — see new row');
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-heading transition-colors hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
      aria-label="Resend email"
    >
      <RefreshCw className={`h-3.5 w-3.5 ${pending ? 'animate-spin' : ''}`} />
      {pending ? 'Resending…' : 'Resend'}
    </button>
  );
}
