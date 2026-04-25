'use server';

import { prisma } from '@wow/db';
import { approveUserSchema, rejectUserSchema } from '@wow/validators';
import { auth } from '@/auth';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { revalidatePath } from 'next/cache';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

export async function approveUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = approveUserSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const { userId, roleId, primaryCountryId } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: 'User not found' };
    if (user.status !== 'PENDING') return { ok: false, error: 'User is not pending' };

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        roleId,
        primaryCountryId: primaryCountryId ?? null,
        approvedById: admin.id,
        approvedAt: new Date(),
        mustChangePassword: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'user.approved',
        entityType: 'USER',
        entityId: userId,
        afterData: JSON.stringify({ status: 'ACTIVE', roleId, primaryCountryId }),
      },
    });

    // Notify the user — email them with a link to /forgot-password so they set a password
    await dispatchEmail({
      templateKey: 'AUTH_SIGNUP_APPROVED',
      locale: user.preferredLocale as 'en' | 'ar',
      to: user.email,
      variables: {
        name: user.name,
        loginUrl: `${process.env['AUTH_URL'] ?? 'http://localhost:3000'}/forgot-password?email=${encodeURIComponent(user.email)}`,
      },
      context: { type: 'AUTH', id: user.id },
    });

    revalidatePath('/admin/pending-approvals');
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function rejectUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = rejectUserSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const { userId, reason } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: 'User not found' };

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ARCHIVED',
        rejectedReason: reason,
        deletedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'user.rejected',
        entityType: 'USER',
        entityId: userId,
        afterData: JSON.stringify({ reason }),
      },
    });

    revalidatePath('/admin/pending-approvals');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
