'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { resendEmailLogAction } from '@/app/actions/emails';

export function ResendButton({ logId, reason }: { logId: string; reason: string | null }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (pending) return;
    if (
      !confirm(
        `Resend this failed email?\n\nOriginal failure:\n${reason ?? '(no reason recorded)'}`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const result = await resendEmailLogAction({ logId });
      if (result.ok) {
        if (result.data.delivered) {
          toast.success('Email re-sent.');
        } else {
          toast.warning('Retry attempted, but delivery still failed. See new log entry.');
        }
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="inline-flex h-7 items-center rounded-md border border-border px-2 text-xs hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
      title={reason ?? undefined}
    >
      {pending ? 'Resending…' : 'Resend'}
    </button>
  );
}
