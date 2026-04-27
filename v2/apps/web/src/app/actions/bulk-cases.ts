'use server';

import { prisma } from '@wow/db';
import { canTransition, type CaseStatusValue } from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type BulkResult = {
  ok: boolean;
  succeeded: string[];
  failed: { id: string; error: string }[];
  error?: string;
};

const MAX_BULK = 200;
const BULK_ROLES = new Set(['ADMIN', 'MANAGER', 'AGENT']);

async function requireBulkUser() {
  const session = await auth();
  const user = session?.user;
  if (!user) throw new Error('UNAUTHENTICATED');
  if (!BULK_ROLES.has(user.role ?? '')) throw new Error('FORBIDDEN');
  return user;
}

const bulkInputSchema = z.object({
  caseIds: z
    .array(z.string().min(1))
    .min(1, 'Select at least one case')
    .max(MAX_BULK, `Cannot process more than ${MAX_BULK} cases at once`),
});

const bulkCancelSchema = bulkInputSchema.extend({
  reason: z.string().trim().min(3, 'Provide a reason (min 3 chars)').max(2000),
});

const bulkReassignSchema = bulkInputSchema.extend({
  assignedToId: z.string().min(1, 'Pick an assignee'),
});

/**
 * Bulk-submit DRAFT cases to PENDING_APPROVAL. Skips cases that are not in
 * DRAFT, are deleted, or fail their per-row optimistic-concurrency guard.
 */
export async function bulkSubmitDraftsAction(input: unknown): Promise<BulkResult> {
  try {
    const user = await requireBulkUser();
    const parsed = bulkInputSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        succeeded: [],
        failed: [],
        error: parsed.error.errors[0]?.message ?? 'Invalid input',
      };
    }

    const { caseIds } = parsed.data;
    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    // Process per-row so a single conflict does not abort the batch.
    for (const caseId of caseIds) {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.refundCase.findUnique({ where: { id: caseId } });
        if (!existing) return { ok: false as const, error: 'Not found' };
        if (existing.deletedAt) return { ok: false as const, error: 'Archived' };
        if (existing.status !== 'DRAFT') {
          return { ok: false as const, error: `Not a draft (${existing.status})` };
        }
        if (!canTransition(existing.status as CaseStatusValue, 'PENDING_APPROVAL')) {
          return { ok: false as const, error: 'Transition not allowed' };
        }

        const guarded = await tx.refundCase.updateMany({
          where: { id: caseId, status: 'DRAFT', deletedAt: null },
          data: { status: 'PENDING_APPROVAL' },
        });
        if (guarded.count === 0) {
          return { ok: false as const, error: 'Modified concurrently' };
        }

        await tx.activityLog.create({
          data: {
            caseId,
            actorId: user.id,
            actorLabel: user.name,
            kind: 'case.pending_approval',
            message: 'Case submitted for approval (bulk)',
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorEmail: user.email,
            action: 'case.bulk_submit',
            entityType: 'CASE',
            entityId: caseId,
            beforeData: JSON.stringify({ status: 'DRAFT' }),
            afterData: JSON.stringify({ status: 'PENDING_APPROVAL' }),
          },
        });

        return { ok: true as const };
      });

      if (result.ok) succeeded.push(caseId);
      else failed.push({ id: caseId, error: result.error });
    }

    revalidatePath('/cases');
    revalidatePath('/operations/bulk-cases');
    return { ok: true, succeeded, failed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, succeeded: [], failed: [], error: msg };
  }
}

/**
 * Bulk-cancel cases. Skips cases already in a terminal state (REFUNDED,
 * REJECTED, CANCELLED) or deleted. Records the reason on each row.
 */
export async function bulkCancelAction(input: unknown): Promise<BulkResult> {
  try {
    const user = await requireBulkUser();
    const parsed = bulkCancelSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        succeeded: [],
        failed: [],
        error: parsed.error.errors[0]?.message ?? 'Invalid input',
      };
    }

    const { caseIds, reason } = parsed.data;
    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const caseId of caseIds) {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.refundCase.findUnique({ where: { id: caseId } });
        if (!existing) return { ok: false as const, error: 'Not found' };
        if (existing.deletedAt) return { ok: false as const, error: 'Archived' };
        if (!canTransition(existing.status as CaseStatusValue, 'CANCELLED')) {
          return {
            ok: false as const,
            error: `Cannot cancel from ${existing.status}`,
          };
        }

        const guarded = await tx.refundCase.updateMany({
          where: { id: caseId, status: existing.status, deletedAt: null },
          data: { status: 'CANCELLED', cancelledReason: reason },
        });
        if (guarded.count === 0) {
          return { ok: false as const, error: 'Modified concurrently' };
        }

        await tx.activityLog.create({
          data: {
            caseId,
            actorId: user.id,
            actorLabel: user.name,
            kind: 'case.cancelled',
            message: `Case cancelled (bulk) — ${reason}`,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorEmail: user.email,
            action: 'case.bulk_cancel',
            entityType: 'CASE',
            entityId: caseId,
            beforeData: JSON.stringify({ status: existing.status }),
            afterData: JSON.stringify({ status: 'CANCELLED', reason }),
          },
        });

        return { ok: true as const };
      });

      if (result.ok) succeeded.push(caseId);
      else failed.push({ id: caseId, error: result.error });
    }

    revalidatePath('/cases');
    revalidatePath('/operations/bulk-cases');
    return { ok: true, succeeded, failed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, succeeded: [], failed: [], error: msg };
  }
}

/**
 * Bulk-reassign cases to a different agent. Validates the new assignee is an
 * active user. Cannot reassign deleted / terminal cases.
 */
export async function bulkReassignCasesAction(input: unknown): Promise<BulkResult> {
  try {
    const user = await requireBulkUser();
    const parsed = bulkReassignSchema.safeParse(input);
    if (!parsed.success) {
      return {
        ok: false,
        succeeded: [],
        failed: [],
        error: parsed.error.errors[0]?.message ?? 'Invalid input',
      };
    }

    const { caseIds, assignedToId } = parsed.data;

    const assignee = await prisma.user.findUnique({
      where: { id: assignedToId },
      select: { id: true, name: true, status: true, deletedAt: true },
    });
    if (!assignee || assignee.deletedAt || assignee.status !== 'ACTIVE') {
      return {
        ok: false,
        succeeded: [],
        failed: [],
        error: 'Selected assignee is not an active user',
      };
    }

    const succeeded: string[] = [];
    const failed: { id: string; error: string }[] = [];
    const TERMINAL = new Set(['REFUNDED', 'REJECTED', 'CANCELLED']);

    for (const caseId of caseIds) {
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.refundCase.findUnique({ where: { id: caseId } });
        if (!existing) return { ok: false as const, error: 'Not found' };
        if (existing.deletedAt) return { ok: false as const, error: 'Archived' };
        if (TERMINAL.has(existing.status)) {
          return {
            ok: false as const,
            error: `Cannot reassign terminal case (${existing.status})`,
          };
        }
        if (existing.assignedToId === assignedToId) {
          return { ok: false as const, error: 'Already assigned to this user' };
        }

        const previous = existing.assignedToId;
        const guarded = await tx.refundCase.updateMany({
          where: { id: caseId, deletedAt: null, assignedToId: previous },
          data: { assignedToId },
        });
        if (guarded.count === 0) {
          return { ok: false as const, error: 'Modified concurrently' };
        }

        await tx.activityLog.create({
          data: {
            caseId,
            actorId: user.id,
            actorLabel: user.name,
            kind: 'case.reassigned',
            message: `Reassigned to ${assignee.name} (bulk)`,
          },
        });
        await tx.auditLog.create({
          data: {
            actorId: user.id,
            actorEmail: user.email,
            action: 'case.bulk_reassign',
            entityType: 'CASE',
            entityId: caseId,
            beforeData: JSON.stringify({ assignedToId: previous }),
            afterData: JSON.stringify({ assignedToId }),
          },
        });

        return { ok: true as const };
      });

      if (result.ok) succeeded.push(caseId);
      else failed.push({ id: caseId, error: result.error });
    }

    revalidatePath('/cases');
    revalidatePath('/operations/bulk-cases');
    return { ok: true, succeeded, failed };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, succeeded: [], failed: [], error: msg };
  }
}
