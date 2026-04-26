import { prisma } from '@wow/db';
import type { Prisma } from '@wow/db';

export type NotificationKind =
  | 'CASE_ASSIGNED'
  | 'CASE_APPROVED'
  | 'CASE_REJECTED'
  | 'CASE_NOTE_MENTION'
  | 'ARN_RECEIVED'
  | 'AURA_CONFIRMED'
  | 'CUSTOMER_REPLY'
  | 'STORE_REPLY'
  | 'SLA_WARNING'
  | 'SLA_BREACHED'
  | 'FRAUD_SIGNAL'
  | 'USER_PENDING_APPROVAL'
  | 'SYSTEM';

interface DispatchInput {
  userIds: string[];
  type: NotificationKind;
  title: string;
  body?: string;
  href?: string;
  contextType?: string;
  contextId?: string;
}

interface DispatchResult {
  /** Notifications actually written. */
  created: number;
  /** Users who were targeted but had this kind muted. */
  mutedSkipped: number;
  /** Users who were targeted but no longer exist / were filtered. */
  unknownSkipped: number;
}

/**
 * Dispatch a notification to one or more users, honoring each user's
 * `mutedNotificationKinds` preference. Centralizes the mute check so
 * callers (SLA sweep, fraud detector, mention notifier, …) can't forget
 * to apply it.
 *
 * The mute list is a comma-separated string on `User.mutedNotificationKinds`.
 * An empty / null value is treated as "nothing muted".
 */
export async function dispatchNotifications(
  input: DispatchInput,
): Promise<DispatchResult> {
  const userIds = Array.from(new Set(input.userIds));
  if (userIds.length === 0) {
    return { created: 0, mutedSkipped: 0, unknownSkipped: 0 };
  }

  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, mutedNotificationKinds: true },
  });
  const knownIds = new Set(users.map((u) => u.id));
  const unknownSkipped = userIds.length - knownIds.size;

  const allowedIds: string[] = [];
  let mutedSkipped = 0;
  for (const u of users) {
    const muted = parseMutedKinds(u.mutedNotificationKinds);
    if (muted.has(input.type)) {
      mutedSkipped += 1;
      continue;
    }
    allowedIds.push(u.id);
  }
  if (allowedIds.length === 0) {
    return { created: 0, mutedSkipped, unknownSkipped };
  }

  const data: Prisma.NotificationCreateManyInput[] = allowedIds.map((userId) => ({
    userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    href: input.href ?? null,
    contextType: input.contextType ?? null,
    contextId: input.contextId ?? null,
  }));
  await prisma.notification.createMany({ data });
  return { created: allowedIds.length, mutedSkipped, unknownSkipped };
}

export function parseMutedKinds(raw: string | null | undefined): Set<NotificationKind> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean) as NotificationKind[],
  );
}

export function serializeMutedKinds(kinds: Iterable<NotificationKind>): string {
  return Array.from(new Set(kinds)).filter(Boolean).join(',');
}

/** Notification kinds users can opt out of via /profile. */
export const MUTABLE_NOTIFICATION_KINDS: { kind: NotificationKind; label: string; description: string }[] = [
  { kind: 'SLA_WARNING', label: 'SLA at-risk warnings', description: 'Heads-up before a case breaches its SLA.' },
  { kind: 'SLA_BREACHED', label: 'SLA breached', description: 'The case has crossed its SLA threshold.' },
  { kind: 'FRAUD_SIGNAL', label: 'Fraud signals', description: 'Heuristic alerts from the fraud sweep.' },
  { kind: 'CUSTOMER_REPLY', label: 'Customer replies', description: 'Inbound customer email on one of your cases.' },
  { kind: 'STORE_REPLY', label: 'Store replies', description: 'Reply on a store-comms thread you are watching.' },
  { kind: 'ARN_RECEIVED', label: 'ARN received', description: 'A KNET component received its ARN.' },
  { kind: 'AURA_CONFIRMED', label: 'AURA confirmed', description: 'An AURA-channel refund was confirmed by finance.' },
];
