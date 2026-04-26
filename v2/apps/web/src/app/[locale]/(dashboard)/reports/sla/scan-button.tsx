'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { scanSlaBreachesAction } from '@/app/actions/sla-scan';

export function ScanSlaBreachesButton() {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      const result = await scanSlaBreachesAction();
      if (result.ok) {
        const { breached, notificationsCreated, skipped } = result.data;
        if (notificationsCreated === 0) {
          toast.success(
            `Sweep complete. ${breached} breach${breached === 1 ? '' : 'es'}, no new notifications (${skipped} deduped).`,
          );
        } else {
          toast.success(
            `Sweep complete. ${notificationsCreated} notification${notificationsCreated === 1 ? '' : 's'} sent across ${breached} breached case${breached === 1 ? '' : 's'}.`,
          );
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
      className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Scanning…' : 'Notify breached cases'}
    </button>
  );
}
