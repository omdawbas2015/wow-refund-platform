'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Link } from '@/i18n/routing';
import {
  fetchMyNotifications,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/actions/notifications';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  contextType: string | null;
  contextId: string | null;
  readAt: Date | string | null;
  createdAt: Date | string;
}

const POLL_INTERVAL_MS = 60_000;

function formatRelative(value: Date | string): string {
  const ts = typeof value === 'string' ? new Date(value).getTime() : value.getTime();
  const seconds = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86_400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86_400)}d`;
}

export function NotificationBell() {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const payload = await fetchMyNotifications();
      setItems(payload.items as NotificationItem[]);
      setUnread(payload.unreadCount);
    } finally {
      setLoading(false);
    }
  }

  // Initial load + polling. Polling is paused while the dropdown is open so
  // a user reading the list isn't interrupted by re-renders.
  useEffect(() => {
    void refresh();
    if (open) return;
    const id = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [open]);

  function onItemClick(n: NotificationItem) {
    if (!n.readAt) {
      startTransition(async () => {
        await markNotificationReadAction(n.id);
      });
      // Optimistic update so the dot disappears immediately.
      setItems((prev) =>
        prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date() } : it)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
    }
    setOpen(false);
    if (n.href) router.push(n.href);
  }

  function onMarkAll() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      setItems((prev) =>
        prev.map((it) => (it.readAt ? it : { ...it, readAt: new Date() })),
      );
      setUnread(0);
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span
            aria-hidden
            className="absolute end-1 top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <>
          {/* Click-away */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            role="dialog"
            aria-label="Notifications"
            className="absolute end-0 z-50 mt-2 w-[360px] rounded-lg border border-border bg-surface shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <div className="text-sm font-medium">Notifications</div>
              <button
                type="button"
                onClick={onMarkAll}
                disabled={unread === 0}
                className={cn(
                  'inline-flex items-center gap-1 text-xs',
                  unread === 0
                    ? 'cursor-not-allowed text-muted-foreground'
                    : 'text-primary hover:underline',
                )}
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all read
              </button>
            </div>

            <ul className="max-h-[420px] overflow-y-auto">
              {loading && items.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  Loading…
                </li>
              ) : items.length === 0 ? (
                <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                  No notifications yet.
                </li>
              ) : (
                items.map((n) => {
                  const isUnread = !n.readAt;
                  return (
                    <li
                      key={n.id}
                      className={cn(
                        'border-b border-border last:border-b-0',
                        isUnread ? 'bg-primary/[0.04]' : '',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => onItemClick(n)}
                        className="flex w-full gap-2 px-3 py-2.5 text-start hover:bg-surface-subtle"
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                            isUnread ? 'bg-primary' : 'bg-transparent',
                          )}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium leading-snug text-foreground">
                            {n.title}
                          </span>
                          {n.body ? (
                            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                              {n.body}
                            </span>
                          ) : null}
                          <span className="mt-1 block text-[10px] uppercase text-muted-foreground">
                            {n.type.replaceAll('_', ' ')} · {formatRelative(n.createdAt)} ago
                          </span>
                        </span>
                        {isUnread ? null : (
                          <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    </li>
                  );
                })
              )}
            </ul>

            <div className="border-t border-border bg-surface-subtle/50 px-3 py-2 text-center">
              <Link
                href="/notifications"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline"
              >
                View all notifications →
              </Link>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
