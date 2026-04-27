'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Mail, RefreshCw } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { bulkResendFailedEmailsAction } from '@/app/actions/emails';

export function BulkResendFailedButton({
  failedCount,
  q,
}: {
  failedCount: number;
  q: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  if (failedCount === 0) {
    return (
      <span className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
        No failed emails
      </span>
    );
  }

  const run = () => {
    start(async () => {
      const result = await bulkResendFailedEmailsAction({ q });
      if (!result.ok) {
        toast.error(result.error ?? 'Bulk resend failed');
        return;
      }
      const { total, delivered, failed } = result;
      if (failed === 0) {
        toast.success(`Resent ${delivered}/${total} failed email${total === 1 ? '' : 's'}`);
      } else if (delivered > 0) {
        toast.warning(
          `Resent ${delivered}/${total} — ${failed} still failed`,
          { description: 'Check the new rows in the log for details.' },
        );
      } else {
        toast.error(`All ${total} retries failed — check provider configuration`);
      }
      setOpen(false);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2.5 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
      >
        <Mail className="h-3.5 w-3.5" />
        Resend all FAILED ({failedCount})
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend {failedCount} failed email{failedCount === 1 ? '' : 's'}?</DialogTitle>
            <DialogDescription>
              Each retry creates a new EmailLog row so the original failure stays as evidence.
              The current search filter is applied. Capped at 200 rows per run.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" type="button" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={run} disabled={pending}>
              <RefreshCw className={`me-1.5 h-4 w-4 ${pending ? 'animate-spin' : ''}`} />
              {pending ? 'Resending…' : `Resend ${failedCount}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
