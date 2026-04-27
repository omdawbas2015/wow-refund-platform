'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { revalidatePath } from 'next/cache';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

/**
 * Re-send an email that previously FAILED. Reuses the rendered subject + body
 * via the dispatcher's `override` channel, so we don't need the original
 * template variables (which aren't persisted on EmailLog). Persists a new
 * `EmailLog` row so the retry is tracked separately and the original failed
 * row stays as evidence.
 */
export async function resendEmailLogAction(
  input: { logId: string },
): Promise<ActionResult<{ logId: string; delivered: boolean }>> {
  try {
    const me = await requireAdmin();
    const original = await prisma.emailLog.findUnique({ where: { id: input.logId } });
    if (!original) return { ok: false, error: 'Email log not found' };
    if (original.status !== 'FAILED') {
      return { ok: false, error: `Only FAILED emails can be resent (status: ${original.status})` };
    }

    const result = await dispatchEmail({
      templateKey: original.templateKey,
      to: original.to,
      ...(original.cc ? { cc: original.cc } : {}),
      ...(original.bcc ? { bcc: original.bcc } : {}),
      variables: {},
      override: { subject: original.subject, body: original.body },
      ...(original.contextType
        ? {
            context: {
              type: original.contextType as 'CASE' | 'BATCH' | 'PROMO' | 'STORE' | 'OTP' | 'AUTH' | 'SYSTEM',
              ...(original.contextId ? { id: original.contextId } : {}),
            },
          }
        : {}),
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.email.resent',
        entityType: 'EMAIL_LOG',
        entityId: input.logId,
        metadata: JSON.stringify({
          newLogId: result.logId,
          delivered: result.delivered,
          ...(result.error ? { error: result.error } : {}),
        }),
      },
    });

    revalidatePath('/reports/emails');
    revalidatePath('/admin/email-log');
    return { ok: true, data: { logId: result.logId, delivered: result.delivered } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Resend every FAILED email matching the given filters. Walks the matching
 * rows one at a time so a transport failure on one message doesn't abort the
 * rest, returning per-row succeeded / failed counts. Capped at 200 rows per
 * call to keep server actions short-lived.
 */
const MAX_BULK_RESEND = 200;

export async function bulkResendFailedEmailsAction(
  input: { q?: string | null } = {},
): Promise<
  | { ok: true; total: number; delivered: number; failed: number }
  | { ok: false; error: string }
> {
  try {
    const me = await requireAdmin();
    const q = (input.q ?? '').trim();
    const where = {
      status: 'FAILED',
      ...(q ? { OR: [{ to: { contains: q } }, { subject: { contains: q } }] } : {}),
    };

    const failed = await prisma.emailLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: MAX_BULK_RESEND,
    });

    let delivered = 0;
    let failedCount = 0;

    for (const original of failed) {
      try {
        const result = await dispatchEmail({
          templateKey: original.templateKey,
          to: original.to,
          ...(original.cc ? { cc: original.cc } : {}),
          ...(original.bcc ? { bcc: original.bcc } : {}),
          variables: {},
          override: { subject: original.subject, body: original.body },
          ...(original.contextType
            ? {
                context: {
                  type: original.contextType as
                    | 'CASE'
                    | 'BATCH'
                    | 'PROMO'
                    | 'STORE'
                    | 'OTP'
                    | 'AUTH'
                    | 'SYSTEM',
                  ...(original.contextId ? { id: original.contextId } : {}),
                },
              }
            : {}),
        });

        if (result.delivered) delivered += 1;
        else failedCount += 1;

        await prisma.auditLog.create({
          data: {
            actorId: me.id,
            actorEmail: me.email,
            action: 'admin.email.bulk_resend',
            entityType: 'EMAIL_LOG',
            entityId: original.id,
            metadata: JSON.stringify({
              newLogId: result.logId,
              delivered: result.delivered,
              ...(result.error ? { error: result.error } : {}),
            }),
          },
        });
      } catch (err) {
        failedCount += 1;
        await prisma.auditLog.create({
          data: {
            actorId: me.id,
            actorEmail: me.email,
            action: 'admin.email.bulk_resend',
            entityType: 'EMAIL_LOG',
            entityId: original.id,
            metadata: JSON.stringify({
              delivered: false,
              error: err instanceof Error ? err.message : String(err),
            }),
          },
        });
      }
    }

    revalidatePath('/admin/email-log');
    revalidatePath('/reports/emails');
    return { ok: true, total: failed.length, delivered, failed: failedCount };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
