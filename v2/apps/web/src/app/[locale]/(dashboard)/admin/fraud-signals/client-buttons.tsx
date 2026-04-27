'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { acknowledgeFraudSignalAction, scanForFraudAction } from '@/app/actions/fraud';

export function ScanButton({ enabled }: { enabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      const result = await scanForFraudAction();
      if (result.ok) {
        if (result.data.created === 0) {
          toast.success('Sweep complete. No new signals.');
        } else {
          toast.success(`Sweep complete. ${result.data.created} new signal(s).`);
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
      disabled={pending || !enabled}
      title={enabled ? 'Run heuristic detectors now' : 'Enable feature.fraud_signals to scan'}
      className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Scanning…' : 'Run scan now'}
    </button>
  );
}

export function AcknowledgeButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function onClick() {
    if (pending) return;
    startTransition(async () => {
      const result = await acknowledgeFraudSignalAction({ id });
      if (result.ok) {
        toast.success('Acknowledged.');
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
    >
      {pending ? '…' : 'Acknowledge'}
    </button>
  );
}
