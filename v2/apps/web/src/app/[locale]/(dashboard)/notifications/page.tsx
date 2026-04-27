import { redirect } from 'next/navigation';
import { prisma, Prisma, type NotificationType } from '@wow/db';
import { auth } from '@/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from '@/i18n/routing';
import { formatDateTime } from '@/lib/utils';
import { InboxActions, RowActions } from './client';

interface PageProps {
  searchParams: Promise<{
    state?: string; // unread | all
    type?: string;
    page?: string;
  }>;
}

const PAGE_SIZE = 50;
const VALID_TYPES: NotificationType[] = [
  'CASE_ASSIGNED',
  'CASE_APPROVED',
  'CASE_REJECTED',
  'CASE_NOTE_MENTION',
  'ARN_RECEIVED',
  'AURA_CONFIRMED',
  'CUSTOMER_REPLY',
  'STORE_REPLY',
  'SLA_WARNING',
  'SLA_BREACHED',
  'FRAUD_SIGNAL',
  'USER_PENDING_APPROVAL',
  'SYSTEM',
];

const TYPE_TONE: Record<NotificationType, 'success' | 'secondary' | 'destructive' | 'outline'> = {
  CASE_ASSIGNED: 'secondary',
  CASE_APPROVED: 'success',
  CASE_REJECTED: 'destructive',
  CASE_NOTE_MENTION: 'secondary',
  ARN_RECEIVED: 'success',
  AURA_CONFIRMED: 'success',
  CUSTOMER_REPLY: 'secondary',
  STORE_REPLY: 'secondary',
  SLA_WARNING: 'secondary',
  SLA_BREACHED: 'destructive',
  FRAUD_SIGNAL: 'destructive',
  USER_PENDING_APPROVAL: 'outline',
  SYSTEM: 'outline',
};

export default async function NotificationsPage({ searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const sp = await searchParams;
  const stateParam = (sp.state ?? 'unread').trim();
  const state = stateParam === 'all' ? 'all' : 'unread';
  const typeParam = (sp.type ?? '').trim() as NotificationType;
  const type = VALID_TYPES.includes(typeParam) ? typeParam : null;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);

  const where: Prisma.NotificationWhereInput = {
    userId: session.user.id,
    ...(state === 'unread' ? { readAt: null } : {}),
    ...(type ? { type } : {}),
  };

  const [items, total, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
    }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { userId: session.user.id, readAt: null } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildHref(overrides: Partial<{ state: string; type: string; page: number }>) {
    const p = new URLSearchParams();
    const s = overrides.state ?? state;
    if (s !== 'unread') p.set('state', s);
    const t = overrides.type ?? type ?? '';
    if (t) p.set('type', t);
    const pg = overrides.page ?? page;
    if (pg !== 1) p.set('page', String(pg));
    const qs = p.toString();
    return qs ? `/notifications?${qs}` : '/notifications';
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display-md font-normal tracking-tight text-heading">Inbox</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unreadCount > 0
              ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}.`
              : 'No unread notifications.'}
          </p>
        </div>
        <InboxActions hasUnread={unreadCount > 0} />
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
        <Link
          href={buildHref({ state: 'unread', page: 1 })}
          className={`rounded-md border px-3 py-1.5 ${
            state === 'unread'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-surface-subtle'
          }`}
        >
          Unread
        </Link>
        <Link
          href={buildHref({ state: 'all', page: 1 })}
          className={`rounded-md border px-3 py-1.5 ${
            state === 'all'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-surface-subtle'
          }`}
        >
          All
        </Link>
        <span className="mx-2 h-5 w-px bg-border" />
        <form method="get" className="flex items-center gap-2">
          {state !== 'unread' ? <input type="hidden" name="state" value={state} /> : null}
          <select
            name="type"
            defaultValue={type ?? ''}
            className="h-8 rounded-md border border-border bg-background px-2 text-xs"
          >
            <option value="">Any type</option>
            {VALID_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-8 rounded-md border border-border px-3 text-xs hover:bg-surface-subtle"
          >
            Filter
          </button>
        </form>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            {total} notification{total === 1 ? '' : 's'} · page {page} of {pages}
          </CardTitle>
          <CardDescription>Most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {items.map((n) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 ${
                  n.readAt ? 'opacity-70' : ''
                }`}
              >
                <span
                  className={`mt-1 h-2 w-2 rounded-full ${
                    n.readAt ? 'bg-muted-foreground/30' : 'bg-primary'
                  }`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={TYPE_TONE[n.type]}>{n.type}</Badge>
                    <span className="font-medium text-heading">{n.title}</span>
                    <span className="ms-auto text-xs tabular text-muted-foreground">
                      {formatDateTime(n.createdAt, 'en-US')}
                    </span>
                  </div>
                  {n.body ? (
                    <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                  ) : null}
                  {n.href ? (
                    <Link
                      href={n.href}
                      className="mt-1 inline-block text-xs text-primary hover:underline"
                    >
                      Open →
                    </Link>
                  ) : null}
                </div>
                <RowActions id={n.id} read={n.readAt !== null} />
              </li>
            ))}
            {items.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-muted-foreground">
                {state === 'unread' ? 'Nothing new. You are all caught up.' : 'No notifications match.'}
              </li>
            ) : null}
          </ul>
        </CardContent>
      </Card>

      {pages > 1 ? (
        <div className="mt-4 flex items-center justify-end gap-2 text-sm">
          {page > 1 ? (
            <Link
              href={buildHref({ page: page - 1 })}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              ← Prev
            </Link>
          ) : null}
          <span className="text-muted-foreground">
            {page} / {pages}
          </span>
          {page < pages ? (
            <Link
              href={buildHref({ page: page + 1 })}
              className="rounded-md border border-border px-2 py-1 hover:bg-surface-subtle"
            >
              Next →
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
