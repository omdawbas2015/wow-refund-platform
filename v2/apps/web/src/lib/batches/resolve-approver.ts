/**
 * Resolve which `User` should be recorded as the approver for a case approval
 * that came in through a non-UI path (manager email reply, magic-link click).
 *
 * Both flows previously set `approvedAt` but never `approvedById`, which left
 * the case detail "Approved by" sidebar permanently rendering "—" and broke
 * the audit trail. Centralizing the lookup here keeps the matching rules
 * consistent and easy to extend (e.g. deputy fallback, case-insensitive
 * compare) without each caller reimplementing them.
 *
 * The helper accepts a Prisma transaction client so callers can use it from
 * inside `prisma.$transaction(...)` without spawning a separate connection.
 */

import type { Prisma } from '@wow/db';

type Tx = Prisma.TransactionClient;

/** Normalize a user-supplied email for case-insensitive matching. */
function normalize(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Look up the User id whose primary email matches `email`. Soft-deleted users
 * are excluded so we never resurface a removed account in the audit trail.
 * Returns `null` when no match is found — callers should treat that as
 * "approver email belongs to someone outside the User table" and leave
 * `approvedById` null rather than guessing.
 */
export async function resolveApproverByEmail(
  tx: Tx,
  email: string | null | undefined,
): Promise<string | null> {
  const normalized = normalize(email);
  if (!normalized) return null;
  const user = await tx.user.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { id: true },
  });
  return user?.id ?? null;
}

/**
 * Resolve an approver from a batch's `recipientEmails` field (a single
 * comma-separated string of one-or-more authorized approvers). Returns the
 * first matched non-deleted User id; if none of the listed emails resolve to
 * a User, returns null.
 *
 * Used by the magic-link path where we don't know exactly which recipient
 * clicked the link, but we do know the click came from someone in the
 * authorized recipient list. Recording any one of them is strictly better
 * than recording nothing.
 */
export async function resolveApproverFromRecipients(
  tx: Tx,
  recipientEmails: string | null | undefined,
): Promise<string | null> {
  if (!recipientEmails) return null;
  const emails = recipientEmails
    .split(/[,;]/)
    .map((e) => normalize(e))
    .filter((e): e is string => !!e);
  if (emails.length === 0) return null;
  const user = await tx.user.findFirst({
    where: { email: { in: emails }, deletedAt: null },
    select: { id: true },
  });
  return user?.id ?? null;
}
