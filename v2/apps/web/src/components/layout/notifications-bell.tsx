'use client';

import { useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { Bell, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/format';
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from '@/app/actions/cases';

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export function NotificationsBell({ locale }: { locale: string }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isPending, startTransition] = useTransition();

  async function load() {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(data.unread ?? 0);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    void load();
    const interval = setInterval(() => void load(), 30_000);
    return () => clearInterval(interval);
  }, []);

  function markRead(id: string) {
    startTransition(async () => {
      await markNotificationReadAction(id);
      await load();
    });
  }

  function markAllRead() {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      await load();
    });
  }

  return (
    <div className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 inline-flex min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-medium leading-none text-destructive-foreground">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute end-0 z-50 mt-2 w-[360px] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <h3 className="text-sm font-medium">Notifications</h3>
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAllRead}
                  disabled={isPending}
                  className="h-7 text-xs"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark all read
                </Button>
              )}
            </div>
            <div className="max-h-[420px] overflow-y-auto">
              {items.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  You&apos;re all caught up.
                </div>
              ) : (
                <ul>
                  {items.map((n) => {
                    const unreadItem = !n.readAt;
                    const link = n.href ? (n.href.startsWith('http') ? n.href : `/${locale}${n.href}`) : null;
                    const Inner = (
                      <div
                        className={cn(
                          'flex gap-3 border-b border-border px-3 py-2.5 last:border-0 transition-colors',
                          unreadItem ? 'bg-primary/5' : 'bg-surface',
                          link && 'hover:bg-surface-subtle/60',
                        )}
                      >
                        <div
                          className={cn(
                            'mt-1 h-2 w-2 flex-shrink-0 rounded-full',
                            unreadItem ? 'bg-primary' : 'bg-transparent',
                          )}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-sm font-medium text-foreground line-clamp-1">
                              {n.title}
                            </span>
                            <span className="flex-shrink-0 text-[10px] text-muted-foreground">
                              {relativeTime(n.createdAt)}
                            </span>
                          </div>
                          {n.body && (
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {n.body}
                            </p>
                          )}
                        </div>
                        {unreadItem && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markRead(n.id);
                            }}
                            className="flex-shrink-0 self-start text-muted-foreground hover:text-foreground"
                            aria-label="Mark as read"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    );
                    return (
                      <li key={n.id}>
                        {link ? (
                          <Link
                            href={link}
                            onClick={() => {
                              if (unreadItem) markRead(n.id);
                              setOpen(false);
                            }}
                          >
                            {Inner}
                          </Link>
                        ) : (
                          Inner
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
