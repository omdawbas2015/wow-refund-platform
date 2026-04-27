'use server';

import { prisma } from '@wow/db';
import {
  createAuraBatchSchema,
  sendAuraBatchSchema,
  completeAuraBatchSchema,
  cancelAuraBatchSchema,
  type CreateAuraBatchInput,
  type SendAuraBatchInput,
  type CompleteAuraBatchInput,
  type CancelAuraBatchInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { nextAuraBatchNumber } from '@/lib/batches/batch-number';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

function ensureOpsOrAdmin(role: string | null | undefined) {
  if (role !== 'ADMIN' && role !== 'OPS_LEAD') throw new Error('FORBIDDEN');
}

async function audit(args: {
  actorId: string;
  actorEmail: string;
  action: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  metadata?: unknown;
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
      ...(args.metadata !== undefined ? { metadata: JSON.stringify(args.metadata) } : {}),
    },
  });
}

interface CaseSnapshotItem {
  caseId: string;
  caseNumber: string;
  customerName: string;
  customerEmail: string;
  auraPoints: number;
  brandSlug: string;
  countryCode: string;
}

/**
 * Create a DRAFT Aura batch from cases that have aura sidecar PENDING.
 *
 * Aura batches don't have FK linkage from RefundCase / RefundComponent. We
 * snapshot the eligible cases at create time into `caseSnapshot` so the batch
 * record is auditable even after cases later change state. We do NOT mark the
 * underlying cases as "in batch" because a case can legitimately be re-listed
 * if Aura asks us to resend.
 */
export async function createAuraBatchAction(
  input: CreateAuraBatchInput,
): Promise<ActionResult<{ batchId: string; batchNumber: string }>> {
  try {
    const me = await requireUser();
    ensureOpsOrAdmin(me.role);
    const parsed = createAuraBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { scheduledFor, recipientEmails } = parsed.data;
    const caseIds = parsed.data.caseIds ?? [];
    if (caseIds.length === 0) {
      return { ok: false, error: 'Select at least one case' };
    }

    const cases = await prisma.refundCase.findMany({
      where: {
        id: { in: caseIds },
        deletedAt: null,
        auraStatus: 'PENDING',
        auraPoints: { gt: 0 },
        status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
      },
      select: {
        id: true,
        caseNumber: true,
        customerName: true,
        customerEmail: true,
        auraPoints: true,
        brand: { select: { slug: true } },
        country: { select: { registryCode: true } },
      },
    });
    if (cases.length !== caseIds.length) {
      return {
        ok: false,
        error: `Some cases are not eligible for an Aura batch. Eligible: ${cases.length}/${caseIds.length}`,
      };
    }

    const snapshot: CaseSnapshotItem[] = cases.map((c) => ({
      caseId: c.id,
      caseNumber: c.caseNumber,
      customerName: c.customerName,
      customerEmail: c.customerEmail,
      auraPoints: c.auraPoints ?? 0,
      brandSlug: c.brand.slug,
      countryCode: c.country.registryCode,
    }));

    const recipients =
      (recipientEmails && recipientEmails.trim()) ||
      process.env['AURA_TEAM_EMAIL'] ||
      'aura@wow.local';

    const batchNumber = await nextAuraBatchNumber();
    const created = await prisma.auraBatch.create({
      data: {
        batchNumber,
        status: 'DRAFT',
        scheduledFor: scheduledFor ?? new Date(),
        recipientEmails: recipients,
        totalCases: cases.length,
        caseSnapshot: JSON.stringify(snapshot),
      },
    });

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'aura_batch.created',
      entityId: created.id,
      after: { batchNumber, totalCases: cases.length, scheduledFor, recipients },
      metadata: { caseIds: cases.map((c) => c.id) },
    });

    revalidatePath('/operations');
    return { ok: true, data: { batchId: created.id, batchNumber } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Mark the batch as SENT and dispatch the Aura team email. The email body
 * includes the snapshot table; the Aura team replies with confirmations and
 * we close the batch via `completeAuraBatchAction`.
 */
export async function sendAuraBatchAction(
  input: SendAuraBatchInput,
): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureOpsOrAdmin(me.role);
    const parsed = sendAuraBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

    const batch = await prisma.auraBatch.findUnique({ where: { id: parsed.data.batchId } });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status !== 'DRAFT') {
      return { ok: false, error: `Batch is ${batch.status}, only DRAFT batches can be sent` };
    }

    const snapshot: CaseSnapshotItem[] = batch.caseSnapshot
      ? (JSON.parse(batch.caseSnapshot) as CaseSnapshotItem[])
      : [];

    const tableLines = [
      'Case Number | Customer | Brand | Country | Aura Points',
      '------------|----------|-------|---------|------------',
      ...snapshot.map(
        (s) =>
          `${s.caseNumber} | ${s.customerName} | ${s.brandSlug} | ${s.countryCode} | ${s.auraPoints}`,
      ),
    ];
    const subject = `Aura batch ${batch.batchNumber} — ${snapshot.length} cases`;
    const body = [
      'Hi Aura team,',
      '',
      `Please process the following ${snapshot.length} Aura point refunds (batch ${batch.batchNumber}).`,
      '',
      ...tableLines,
      '',
      'Reply with the order-by-order confirmation when done.',
      '',
      'Thanks.',
    ].join('\n');

    // dispatchEmail returns `{ delivered: false, error }` on production webhook
    // failure rather than throwing, so we must inspect the return value.
    try {
      const result = await dispatchEmail({
        templateKey: 'AURA_BATCH_SENT',
        locale: 'en',
        to: batch.recipientEmails,
        variables: {},
        override: { subject, body },
        context: { type: 'BATCH', id: batch.id },
      });
      if (!result.delivered) {
        return {
          ok: false,
          error: `Email dispatch failed: ${result.error ?? 'Unknown dispatch error'}`,
        };
      }
    } catch (emailErr) {
      const reason = emailErr instanceof Error ? emailErr.message : String(emailErr);
      return { ok: false, error: `Email dispatch failed: ${reason}` };
    }

    await prisma.auraBatch.update({
      where: { id: batch.id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    // Email is dispatched and the batch row is already flipped to SENT — both
    // are irreversible. A transient audit failure must NOT surface as `ok:
    // false`, since the user would retry and re-trigger the email.
    try {
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'aura_batch.sent',
        entityId: batch.id,
        before: { status: batch.status },
        after: { status: 'SENT' },
      });
    } catch (auditErr) {
      console.error(
        '[aura-batch] audit write failed after successful send',
        auditErr,
      );
    }

    revalidatePath('/operations');
    revalidatePath(`/operations/aura/${batch.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Close the batch and flip every snapshotted case's Aura sidecar to COMPLETED.
 * Stores the optional raw response from the Aura team for audit/forensics.
 */
export async function completeAuraBatchAction(
  input: CompleteAuraBatchInput,
): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureOpsOrAdmin(me.role);
    const parsed = completeAuraBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

    const batch = await prisma.auraBatch.findUnique({ where: { id: parsed.data.batchId } });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status !== 'SENT' && batch.status !== 'AWAITING') {
      return {
        ok: false,
        error: `Batch is ${batch.status}, only SENT/AWAITING batches can be completed`,
      };
    }

    const snapshot: CaseSnapshotItem[] = batch.caseSnapshot
      ? (JSON.parse(batch.caseSnapshot) as CaseSnapshotItem[])
      : [];
    const caseIds = snapshot.map((s) => s.caseId);

    const now = new Date();
    await prisma.$transaction([
      prisma.refundCase.updateMany({
        where: { id: { in: caseIds }, auraStatus: 'PENDING' },
        data: {
          auraStatus: 'COMPLETED',
          auraProcessedAt: now,
          auraProcessedById: me.id,
        },
      }),
      prisma.auraBatch.update({
        where: { id: batch.id },
        data: {
          status: 'COMPLETED',
          completedAt: now,
          completedCases: snapshot.length,
          ...(parsed.data.responseRawBody
            ? {
                responseReceivedAt: now,
                responseRawBody: parsed.data.responseRawBody,
              }
            : {}),
        },
      }),
    ]);

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'aura_batch.completed',
      entityId: batch.id,
      before: { status: batch.status },
      after: { status: 'COMPLETED', completedCases: snapshot.length },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/aura/${batch.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function cancelAuraBatchAction(
  input: CancelAuraBatchInput,
): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureOpsOrAdmin(me.role);
    const parsed = cancelAuraBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };

    const batch = await prisma.auraBatch.findUnique({ where: { id: parsed.data.batchId } });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
      return { ok: false, error: `Batch is already ${batch.status}` };
    }

    await prisma.auraBatch.update({
      where: { id: batch.id },
      data: { status: 'CANCELLED' },
    });

    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'aura_batch.cancelled',
      entityId: batch.id,
      before: { status: batch.status },
      after: { status: 'CANCELLED' },
      metadata: { reason: parsed.data.reason },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/aura/${batch.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
