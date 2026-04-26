'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/actions/notifications';

export function InboxActions({ hasUnread }: { hasUnread: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function markAll() {
    if (pending || !hasUnread) return;
    startTransition(async () => {
      const result = await markAllNotificationsReadAction();
      if (result.ok) {
        toast.success('All marked as read.');
        router.refresh();
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={markAll}
      disabled={pending || !hasUnread}
      className="h-9 rounded-md border border-border px-3 text-sm hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? 'Marking…' : 'Mark all read'}
    </button>
  );
}

export function RowActions({ id, read }: { id: string; read: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function markRead() {
    if (pending || read) return;
    startTransition(async () => {
      const result = await markNotificationReadAction(id);
      if (result.ok) router.refresh();
      else toast.error(result.error);
    });
  }

  if (read) {
    return <span className="text-xs text-muted-foreground">Read</span>;
  }
  return (
    <button
      type="button"
      onClick={markRead}
      disabled={pending}
      className="text-xs text-primary hover:underline disabled:opacity-50"
    >
      Mark read
    </button>
  );
}
