'use server';

import { randomBytes } from 'crypto';
import { prisma } from '@wow/db';
import {
  createApprovalBatchSchema,
  sendApprovalBatchSchema,
  decideApprovalBatchSchema,
  cancelApprovalBatchSchema,
  type CreateApprovalBatchInput,
  type DecideApprovalBatchInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { nextApprovalBatchNumber } from '@/lib/batches/batch-number';
import { assertCaseTransition } from '@/lib/cases/state-machine';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

async function writeAudit(args: {
  actorId: string;
  actorEmail: string;
  action: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      action: args.action,
      entityType: 'BATCH',
      entityId: args.entityId,
      ...(args.before !== undefined ? { beforeData: JSON.stringify(args.before) } : {}),
      ...(args.after !== undefined ? { afterData: JSON.stringify(args.after) } : {}),
    },
  });
}

function ensureManagerOrAdmin(role: string | null | undefined) {
  if (role !== 'ADMIN' && role !== 'COUNTRY_MANAGER' && role !== 'OPS_LEAD') {
    throw new Error('FORBIDDEN');
  }
}

/**
 * Create a DRAFT approval batch from a set of PENDING_APPROVAL cases in one country.
 * Cases are atomically attached to the batch (approvalBatchId) so they cannot be
 * double-batched.
 */
export async function createApprovalBatchAction(
  input: CreateApprovalBatchInput,
): Promise<ActionResult<{ batchId: string; batchNumber: string }>> {
  try {
    const me = await requireUser();
    ensureManagerOrAdmin(me.role);

    const parsed = createApprovalBatchSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { countryId, scheduledFor, recipientEmails } = parsed.data;
    const caseIds = parsed.data.caseIds ?? [];
    if (caseIds.length === 0) {
      return { ok: false, error: 'Select at least one case' };
    }

    // Validate all cases are PENDING_APPROVAL, in this country, and not already in a batch
    const cases = await prisma.refundCase.findMany({
      where: {
        id: { in: caseIds },
        countryId,
        status: 'PENDING_APPROVAL',
        deletedAt: null,
        approvalBatchId: null,
      },
      select: { id: true, caseNumber: true, totalRefundAmount: true },
    });
    if (cases.length !== caseIds.length) {
      return {
        ok: false,
        error: `Some cases are not eligible (status, country, or already batched). Eligible: ${cases.length}/${caseIds.length}`,
      };
    }

    const country = await prisma.country.findUnique({
      where: { id: countryId },
      select: { managerEmail: true },
    });
    const recipients =
      (recipientEmails && recipientEmails.trim()) || country?.managerEmail || '';
    if (!recipients) {
      return {
        ok: false,
        error: 'No recipient email — set country.managerEmail or provide one',
      };
    }

    const batchNumber = await nextApprovalBatchNumber(countryId);
    const magicLinkToken = randomBytes(24).toString('hex');

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.approvalBatch.create({
        data: {
          batchNumber,
          countryId,
          status: 'DRAFT',
          createdById: me.id,
          scheduledFor: scheduledFor ?? new Date(),
          recipientEmails: recipients,
          magicLinkToken,
          totalCases: cases.length,
        },
        select: { id: true, batchNumber: true },
      });
      await tx.refundCase.updateMany({
        where: { id: { in: caseIds } },
        data: { approvalBatchId: created.id },
      });
      return created;
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.approval.created',
      entityId: batch.id,
      after: { batchNumber: batch.batchNumber, countryId, total: cases.length },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/approvals/${batch.id}`);
    return { ok: true, data: { batchId: batch.id, batchNumber: batch.batchNumber } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Render the manager's approval table and dispatch the email via Power Automate
 * (or dev-stub). Marks the batch as SENT.
 */
export async function sendApprovalBatchAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureManagerOrAdmin(me.role);
    const parsed = sendApprovalBatchSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const batch = await prisma.approvalBatch.findUnique({
      where: { id: parsed.data.batchId },
      include: {
        country: { select: { registryCode: true, registry: { select: { nameEn: true } } } },
        cases: {
          where: { deletedAt: null },
          select: {
            caseNumber: true,
            customerName: true,
            orderNumber: true,
            totalRefundAmount: true,
            orderCurrency: true,
          },
        },
      },
    });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status !== 'DRAFT') {
      return { ok: false, error: `Batch is ${batch.status}, cannot send again` };
    }

    const totalAmount = batch.cases.reduce((s, c) => s + c.totalRefundAmount, 0);
    const currency = batch.cases[0]?.orderCurrency ?? '';
    const casesTable = batch.cases
      .map(
        (c) =>
          `- ${c.caseNumber}  ·  ${c.customerName}  ·  Order ${c.orderNumber}  ·  ${c.totalRefundAmount.toFixed(2)} ${c.orderCurrency}`,
      )
      .join('\n');

    const today = new Date().toISOString().slice(0, 10);
    const result = await dispatchEmail({
      templateKey: 'APPROVAL_BATCH_MANAGER',
      locale: 'en',
      to: batch.recipientEmails,
      variables: {
        managerName: 'Manager',
        country: batch.country.registry.nameEn,
        date: today,
        count: batch.cases.length,
        casesTable,
        totalAmount: `${totalAmount.toFixed(2)} ${currency}`,
        approvalUrl: `/operations/approvals/${batch.id}?t=${batch.magicLinkToken ?? ''}`,
      },
      context: { type: 'BATCH', id: batch.id },
    });

    // Power Automate (and the dev stub) report delivery failures via
    // { delivered: false, error } rather than throwing. If we ignored that
    // we'd flip the batch to SENT — and downstream the manager workflow
    // would never run — even though the manager never got the email.
    // Audit-log the failed dispatch so it shows up in /admin/cron-status
    // and the email log, then bail without mutating the batch.
    if (!result.delivered) {
      await writeAudit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'batch.approval.send_failed',
        entityId: batch.id,
        after: { recipients: batch.recipientEmails, error: result.error ?? 'unknown' },
      });
      return {
        ok: false,
        error: `Email dispatch failed: ${result.error ?? 'unknown error'}. Batch left as DRAFT — retry once the mail webhook is healthy.`,
      };
    }

    await prisma.approvalBatch.update({
      where: { id: batch.id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        ...(result.runId ? { powerAutomateRunId: result.runId } : {}),
      },
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.approval.sent',
      entityId: batch.id,
      after: { recipients: batch.recipientEmails, runId: result.runId, delivered: result.delivered },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/approvals/${batch.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Manager (or admin acting on their behalf) submits decisions for the batch's cases.
 * Each decision approves or rejects the underlying case via the case state machine.
 */
export async function decideApprovalBatchAction(
  input: DecideApprovalBatchInput,
): Promise<ActionResult<{ approved: number; rejected: number; total: number }>> {
  try {
    const me = await requireUser();
    ensureManagerOrAdmin(me.role);
    const parsed = decideApprovalBatchSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { batchId, decisions } = parsed.data;

    const batch = await prisma.approvalBatch.findUnique({
      where: { id: batchId },
      include: { cases: { select: { id: true, status: true, caseNumber: true } } },
    });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
      return { ok: false, error: `Batch is ${batch.status}` };
    }

    const caseById = new Map(batch.cases.map((c) => [c.id, c]));

    let approved = 0;
    let rejected = 0;
    const now = new Date();

    await prisma.$transaction(async (tx) => {
      for (const d of decisions) {
        const c = caseById.get(d.caseId);
        if (!c) continue;
        if (c.status !== 'PENDING_APPROVAL') continue; // skip already-decided

        if (d.decision === 'APPROVE') {
          assertCaseTransition('PENDING_APPROVAL', 'APPROVED');
          await tx.refundCase.update({
            where: { id: c.id },
            data: { status: 'APPROVED', approvedById: me.id, approvedAt: now },
          });
          approved += 1;
        } else {
          assertCaseTransition('PENDING_APPROVAL', 'REJECTED');
          await tx.refundCase.update({
            where: { id: c.id },
            data: {
              status: 'REJECTED',
              rejectedReason: d.reason || 'Rejected by manager',
            },
          });
          rejected += 1;
        }

        await tx.auditLog.create({
          data: {
            actorId: me.id,
            actorEmail: me.email,
            action: d.decision === 'APPROVE' ? 'case.approved' : 'case.rejected',
            entityType: 'CASE',
            entityId: c.id,
            beforeData: JSON.stringify({ status: 'PENDING_APPROVAL' }),
            afterData: JSON.stringify({
              status: d.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
              batchId,
              reason: d.reason ?? null,
            }),
          },
        });
      }

      // Count remaining undecided cases AFTER this round so a batch
      // completed across multiple partial submissions correctly transitions
      // to COMPLETED. Comparing decisions made in this single invocation
      // against the batch total miscounts when an earlier round already
      // decided some cases.
      const remainingPending = await tx.refundCase.count({
        where: { approvalBatchId: batch.id, status: 'PENDING_APPROVAL' },
      });
      const allDecided = remainingPending === 0;
      await tx.approvalBatch.update({
        where: { id: batch.id },
        data: {
          approvedCases: { increment: approved },
          rejectedCases: { increment: rejected },
          status: allDecided ? 'COMPLETED' : 'PARTIALLY_DECIDED',
          completedAt: allDecided ? now : null,
          responseReceivedAt: now,
        },
      });
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.approval.decided',
      entityId: batchId,
      after: { approved, rejected, total: decisions.length },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/approvals/${batchId}`);
    return { ok: true, data: { approved, rejected, total: decisions.length } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelApprovalBatchAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureManagerOrAdmin(me.role);
    const parsed = cancelApprovalBatchSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const { batchId, reason } = parsed.data;

    const batch = await prisma.approvalBatch.findUnique({ where: { id: batchId } });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
      return { ok: false, error: `Batch is ${batch.status}` };
    }

    await prisma.$transaction(async (tx) => {
      // Detach cases (back to plain PENDING_APPROVAL)
      await tx.refundCase.updateMany({
        where: { approvalBatchId: batchId },
        data: { approvalBatchId: null },
      });
      await tx.approvalBatch.update({
        where: { id: batchId },
        data: { status: 'CANCELLED' },
      });
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.approval.cancelled',
      entityId: batchId,
      after: { reason },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/approvals/${batchId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
