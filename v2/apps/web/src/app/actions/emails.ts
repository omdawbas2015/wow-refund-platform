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
    return { ok: true, data: { logId: result.logId, delivered: result.delivered } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
