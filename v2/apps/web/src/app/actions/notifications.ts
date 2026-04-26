'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  contextType: string | null;
  contextId: string | null;
  readAt: Date | null;
  createdAt: Date;
}

interface NotificationsPayload {
  items: NotificationItem[];
  unreadCount: number;
}

/**
 * Fetch the most recent 20 notifications for the current user, plus the
 * total unread count. Used by the bell dropdown — kept small/cheap so it can
 * be polled.
 */
export async function fetchMyNotifications(): Promise<NotificationsPayload> {
  const session = await auth();
  if (!session?.user) return { items: [], unreadCount: 0 };

  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    }),
  ]);
  return { items, unreadCount };
}

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Mark a single notification as read. No-op if it's already read or belongs
 * to a different user (we silently ignore mismatches).
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mark all unread notifications for the current user as read.
 */
export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
