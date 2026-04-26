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

// ── Payment Methods CRUD ──

export async function createPaymentMethodAction(data: {
  key: string;
  label: string;
  labelAr?: string;
  iconSlug?: string;
  color?: string;
  requiresAuthCode: boolean;
  executionType: string;
  batchPath?: string;
  sortOrder?: number;
}): Promise<ActionResult & { data?: { id: string } }> {
  try {
    await requireAdmin();
    const key = data.key.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '');
    if (!key) return { ok: false, error: 'Key is required' };
    if (!data.label.trim()) return { ok: false, error: 'Label is required' };

    const existing = await prisma.paymentMethod.findUnique({ where: { key } });
    if (existing) return { ok: false, error: `Payment method "${key}" already exists` };

    const pm = await prisma.paymentMethod.create({
      data: {
        key,
        label: data.label.trim(),
        labelAr: data.labelAr?.trim() || null,
        iconSlug: data.iconSlug?.trim() || null,
        color: data.color?.trim() || null,
        requiresAuthCode: data.requiresAuthCode,
        executionType: data.executionType || 'MANUAL',
        sortOrder: data.sortOrder ?? 0,
      },
    });

    revalidatePath('/admin/payment-methods');
    return { ok: true, data: { id: pm.id } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function updatePaymentMethodAction(data: {
  id: string;
  label?: string;
  labelAr?: string;
  iconSlug?: string;
  color?: string;
  requiresAuthCode?: boolean;
  executionType?: string;
  batchPath?: string;
  sortOrder?: number;
  isActive?: boolean;
}): Promise<ActionResult> {
  try {
    await requireAdmin();
    const pm = await prisma.paymentMethod.findUnique({ where: { id: data.id } });
    if (!pm) return { ok: false, error: 'Payment method not found' };

    await prisma.paymentMethod.update({
      where: { id: data.id },
      data: {
        ...(data.label !== undefined && { label: data.label.trim() }),
        ...(data.labelAr !== undefined && { labelAr: data.labelAr.trim() || null }),
        ...(data.iconSlug !== undefined && { iconSlug: data.iconSlug.trim() || null }),
        ...(data.color !== undefined && { color: data.color.trim() || null }),
        ...(data.requiresAuthCode !== undefined && { requiresAuthCode: data.requiresAuthCode }),
        ...(data.executionType !== undefined && { executionType: data.executionType }),
        ...(data.sortOrder !== undefined && { sortOrder: data.sortOrder }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    revalidatePath('/admin/payment-methods');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function deletePaymentMethodAction(data: { id: string }): Promise<ActionResult> {
  try {
    await requireAdmin();
    const pm = await prisma.paymentMethod.findUnique({
      where: { id: data.id },
      include: { _count: { select: { components: true } } },
    });
    if (!pm) return { ok: false, error: 'Payment method not found' };
    if (pm._count.components > 0) {
      // Soft-deactivate instead of deleting if in use
      await prisma.paymentMethod.update({
        where: { id: data.id },
        data: { isActive: false },
      });
    } else {
      await prisma.paymentMethod.delete({ where: { id: data.id } });
    }
    revalidatePath('/admin/payment-methods');
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
