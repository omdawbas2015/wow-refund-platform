'use server';

import { prisma } from '@wow/db';
import {
  createCaseSchema,
  addNoteSchema,
  updateCaseStatusSchema,
  canTransition,
  type CaseStatusValue,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]>; duplicate?: { caseNumber: string; id: string } };

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

const APPROVE_ROLES = new Set(['ADMIN', 'MANAGER']);

function canApprove(role: string | null | undefined): boolean {
  return !!role && APPROVE_ROLES.has(role);
}

async function generateCaseNumber(countryCode: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `REF-${countryCode}-${year}-`;
  const last = await prisma.refundCase.findFirst({
    where: { caseNumber: { startsWith: prefix } },
    orderBy: { caseNumber: 'desc' },
    select: { caseNumber: true },
  });
  const lastSeq = last ? Number(last.caseNumber.slice(prefix.length)) : 0;
  const next = (lastSeq + 1).toString().padStart(6, '0');
  return `${prefix}${next}`;
}

/**
 * Create a refund case from the new-case wizard.
 * Performs duplicate detection on (orderNumber, brandId) unless `duplicateAcknowledged`.
 */
export async function createCaseAction(
  input: unknown,
): Promise<ActionResult<{ id: string; caseNumber: string }>> {
  try {
    const user = await requireSession();
    const parsed = createCaseSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        error: 'Please review the form.',
        fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      };
    }
    const data = parsed.data;

    // Duplicate detection
    if (!data.duplicateAcknowledged) {
      const duplicate = await prisma.refundCase.findFirst({
        where: {
          orderNumber: data.orderNumber,
          brandId: data.brandId,
          deletedAt: null,
        },
        select: { id: true, caseNumber: true },
        orderBy: { createdAt: 'desc' },
      });
      if (duplicate) {
        return {
          ok: false,
          error: 'A case already exists for this order.',
          duplicate: { id: duplicate.id, caseNumber: duplicate.caseNumber },
        };
      }
    }

    const country = await prisma.country.findUnique({
      where: { id: data.countryId },
      include: { registry: true },
    });
    if (!country) return { ok: false, error: 'Invalid country.' };

    // Verify brand is active for this country
    const brandCountry = await prisma.brandCountry.findFirst({
      where: { brandId: data.brandId, countryId: data.countryId, isActive: true },
    });
    if (!brandCountry) {
      // Non-blocking — some brands may operate across countries without a per-country row;
      // just warn via audit later. Allow creation to proceed.
    }

    const paymentMethods = await prisma.paymentMethod.findMany({
      where: { id: { in: data.components.map((c) => c.paymentMethodId) } },
    });
    if (paymentMethods.length !== new Set(data.components.map((c) => c.paymentMethodId)).size) {
      return { ok: false, error: 'One or more payment methods are invalid.' };
    }

    // Enforce KNET auth code requirement
    for (const c of data.components) {
      const pm = paymentMethods.find((p) => p.id === c.paymentMethodId);
      if (!pm) continue;
      if (pm.requiresAuthCode && !c.authCode?.trim()) {
        return {
          ok: false,
          error: `Auth code is required for ${pm.label}.`,
        };
      }
    }

    const totalRefundAmount = data.components.reduce((sum, c) => sum + c.amount, 0);
    if (totalRefundAmount > data.orderAmount + 0.001) {
      return { ok: false, error: 'Total refund exceeds order amount.' };
    }

    const caseNumber = await generateCaseNumber(country.registry.code);
    const isPartial = Math.abs(totalRefundAmount - data.orderAmount) > 0.001;

    const created = await prisma.$transaction(async (tx) => {
      const newCase = await tx.refundCase.create({
        data: {
          caseNumber,
          countryId: data.countryId,
          branchId: data.branchId || null,
          brandId: data.brandId,
          customerName: data.customerName,
          customerEmail: data.customerEmail,
          customerPhone: data.customerPhone,
          customerNotes: data.customerNotes || null,
          orderNumber: data.orderNumber,
          orderDate: data.orderDate,
          orderAmount: data.orderAmount,
          orderCurrency: data.orderCurrency,
          totalRefundAmount,
          isPartial,
          auraPoints: data.auraPoints ?? null,
          auraStatus: data.auraPoints ? 'PENDING' : 'NONE',
          status: 'DRAFT',
          rootCauseId: data.rootCauseId || null,
          rootCauseNotes: data.rootCauseNotes || null,
          createdById: user.id,
          components: {
            create: data.components.map((c) => ({
              paymentMethodId: c.paymentMethodId,
              amount: c.amount,
              currency: data.orderCurrency,
              authCode: c.authCode || null,
              last4: c.last4 || null,
              status: 'PENDING',
            })),
          },
        },
      });

      await tx.activityLog.create({
        data: {
          caseId: newCase.id,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'case.created',
          message: `Case ${caseNumber} created`,
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: 'case.created',
          entityType: 'CASE',
          entityId: newCase.id,
          afterData: JSON.stringify({ caseNumber, totalRefundAmount }),
        },
      });

      return newCase;
    });

    revalidatePath('/cases');
    return { ok: true, data: { id: created.id, caseNumber: created.caseNumber } };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Transition a case from one status to another.
 * State-machine enforced via @wow/validators.canTransition.
 */
export async function updateCaseStatusAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const parsed = updateCaseStatusSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const { caseId, target, reason } = parsed.data;

    if (target === 'REJECTED') {
      // Rejection is driven by the manager email flow, not by UI actions.
      return {
        ok: false,
        error: 'Rejections are performed by the approver via email, not in the UI.',
      };
    }

    if (target === 'APPROVED' && !canApprove(user.role)) {
      return {
        ok: false,
        error: 'You do not have permission to approve cases.',
      };
    }

    // Read, validate, and write inside a single transaction, with an
    // optimistic-concurrency guard on `updateMany` so two concurrent
    // transitions from the same source status can't both succeed.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.refundCase.findUnique({ where: { id: caseId } });
      if (!existing) return { ok: false as const, error: 'Case not found' };
      if (existing.deletedAt) return { ok: false as const, error: 'Case is archived' };
      if (!canTransition(existing.status as CaseStatusValue, target)) {
        return {
          ok: false as const,
          error: `Cannot move case from ${existing.status} to ${target}.`,
        };
      }

      const patch: Record<string, unknown> = { status: target };
      if (target === 'CANCELLED') patch['cancelledReason'] = reason ?? null;
      if (target === 'APPROVED') {
        patch['approvedById'] = user.id;
        patch['approvedAt'] = new Date();
      }

      const guarded = await tx.refundCase.updateMany({
        where: { id: caseId, status: existing.status, deletedAt: null },
        data: patch,
      });
      if (guarded.count === 0) {
        return {
          ok: false as const,
          error: 'Case was modified by another user. Please refresh and retry.',
        };
      }

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: `case.${target.toLowerCase()}`,
          message: `Case moved to ${target}${reason ? ` — ${reason}` : ''}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: `case.${target.toLowerCase()}`,
          entityType: 'CASE',
          entityId: caseId,
          beforeData: JSON.stringify({ status: existing.status }),
          afterData: JSON.stringify({ status: target, reason }),
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Add a note to a case. Parses @mentions from the body and creates Notifications
 * for each mentioned user.
 */
export async function addCaseNoteAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const parsed = addNoteSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Please write a note.' };

    const { caseId, body, mentionedUserIds } = parsed.data;

    const existing = await prisma.refundCase.findUnique({
      where: { id: caseId },
      select: { id: true, caseNumber: true },
    });
    if (!existing) return { ok: false, error: 'Case not found' };

    const uniqueMentions = Array.from(
      new Set(mentionedUserIds.filter((id) => id && id !== user.id)),
    );

    // Validate mentioned users exist and are active
    const validMentions = uniqueMentions.length
      ? await prisma.user.findMany({
          where: { id: { in: uniqueMentions }, status: 'ACTIVE', deletedAt: null },
          select: { id: true, name: true },
        })
      : [];

    await prisma.$transaction(async (tx) => {
      const note = await tx.caseNote.create({
        data: {
          caseId,
          authorId: user.id,
          body,
          mentions: {
            create: validMentions.map((m) => ({ userId: m.id })),
          },
        },
      });

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'note.added',
          message: 'added a note',
        },
      });

      for (const m of validMentions) {
        await tx.notification.create({
          data: {
            userId: m.id,
            type: 'CASE_NOTE_MENTION',
            title: `${user.name} mentioned you on ${existing.caseNumber}`,
            body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
            href: `/cases/${caseId}#note-${note.id}`,
            contextType: 'CASE',
            contextId: caseId,
          },
        });
      }
    });

    revalidatePath(`/cases/${caseId}`);
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Mark a notification as read. Used by the bell dropdown.
 */
export async function markNotificationReadAction(
  notificationId: string,
): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { readAt: new Date() },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Soft-delete a case with a reason. The case remains visible in the list
 * with a "Deleted" badge but can no longer be transitioned.
 */
export async function deleteCaseAction(input: {
  caseId: string;
  reason: string;
}): Promise<ActionResult> {
  try {
    const user = await requireSession();
    const caseId = String(input.caseId ?? '');
    const reason = String(input.reason ?? '').trim();
    if (!caseId) return { ok: false, error: 'Missing case id.' };
    if (reason.length < 3) {
      return { ok: false, error: 'Please provide a deletion reason (min 3 chars).' };
    }

    const existing = await prisma.refundCase.findUnique({ where: { id: caseId } });
    if (!existing) return { ok: false, error: 'Case not found' };
    if (existing.deletedAt) return { ok: false, error: 'Case is already deleted.' };
    if (existing.status === 'REFUNDED' || existing.status === 'PARTIALLY_REFUNDED') {
      return { ok: false, error: 'Refunded cases cannot be deleted.' };
    }

    await prisma.$transaction(async (tx) => {
      await tx.refundCase.update({
        where: { id: caseId },
        data: { deletedAt: new Date() },
      });
      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'case.deleted',
          message: `deleted the case — ${reason}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: 'case.deleted',
          entityType: 'CASE',
          entityId: caseId,
          beforeData: JSON.stringify({ deletedAt: null, status: existing.status }),
          afterData: JSON.stringify({ deletedAt: new Date().toISOString(), reason }),
        },
      });
    });

    revalidatePath(`/cases/${caseId}`);
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function markAllNotificationsReadAction(): Promise<ActionResult> {
  try {
    const user = await requireSession();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath('/', 'layout');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Wrapper used by server-rendered forms that expect a redirect on success.
 * Reads FormData-serialized input.
 */
export async function createCaseFormAction(formData: FormData) {
  const raw: Record<string, unknown> = Object.fromEntries(formData.entries());
  // components[] is serialized as JSON to keep the form simple
  const rawComponents = formData.get('components');
  if (typeof rawComponents === 'string') {
    try {
      raw['components'] = JSON.parse(rawComponents);
    } catch {
      // leave untouched — validator will reject
    }
  }
  const result = await createCaseAction(raw);
  if (!result.ok) {
    return result;
  }
  redirect(`/cases/${result.data!.id}`);
}
