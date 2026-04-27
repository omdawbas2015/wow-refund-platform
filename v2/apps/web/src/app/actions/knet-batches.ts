'use server';

import { prisma } from '@wow/db';
import {
  createKnetBatchSchema,
  sendKnetBatchSchema,
  ingestKnetArnSchema,
  verifyKnetArnSchema,
  type CreateKnetBatchInput,
  type IngestKnetArnInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { nextKnetBatchNumber } from '@/lib/batches/batch-number';
import { rollupCaseStatus } from '@/lib/cases/status-rollup';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

function ensureFinanceOrAdmin(role: string | null | undefined) {
  if (role !== 'ADMIN' && role !== 'FINANCE_LEAD' && role !== 'OPS_LEAD') {
    throw new Error('FORBIDDEN');
  }
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

/**
 * Create a DRAFT KNET batch from KNET components on APPROVED/IN_EXECUTION cases.
 * Components are atomically attached to the batch (batchId) so they can't be
 * picked up by another batch.
 */
export async function createKnetBatchAction(
  input: CreateKnetBatchInput,
): Promise<ActionResult<{ batchId: string; batchNumber: string }>> {
  try {
    const me = await requireUser();
    ensureFinanceOrAdmin(me.role);
    const parsed = createKnetBatchSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { scheduledFor, recipientEmails } = parsed.data;
    const componentIds = parsed.data.componentIds ?? [];
    if (componentIds.length === 0) {
      return { ok: false, error: 'Select at least one component' };
    }

    const components = await prisma.refundComponent.findMany({
      where: {
        id: { in: componentIds },
        batchId: null,
        status: { in: ['PENDING', 'AWAITING_BATCH'] },
        paymentMethod: { key: 'KNET' },
        case: { status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] }, deletedAt: null },
      },
      select: { id: true },
    });
    if (components.length !== componentIds.length) {
      return {
        ok: false,
        error: `Some components are not eligible. Eligible: ${components.length}/${componentIds.length}`,
      };
    }

    const recipients =
      (recipientEmails && recipientEmails.trim()) ||
      process.env['FINANCE_TEAM_EMAIL'] ||
      'finance@wow.local';

    const batchNumber = await nextKnetBatchNumber();

    const batch = await prisma.$transaction(async (tx) => {
      const created = await tx.knetBatch.create({
        data: {
          batchNumber,
          status: 'DRAFT',
          scheduledFor: scheduledFor ?? new Date(),
          recipientEmails: recipients,
          totalComponents: components.length,
        },
        select: { id: true, batchNumber: true },
      });
      await tx.refundComponent.updateMany({
        where: { id: { in: componentIds } },
        data: { batchId: created.id, status: 'AWAITING_BATCH' },
      });
      return created;
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.knet.created',
      entityId: batch.id,
      after: { batchNumber: batch.batchNumber, total: components.length },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/knet/${batch.id}`);
    return { ok: true, data: { batchId: batch.id, batchNumber: batch.batchNumber } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function sendKnetBatchAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureFinanceOrAdmin(me.role);
    const parsed = sendKnetBatchSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const batch = await prisma.knetBatch.findUnique({
      where: { id: parsed.data.batchId },
      include: {
        components: {
          include: {
            case: { select: { caseNumber: true, customerName: true, orderNumber: true } },
          },
        },
      },
    });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status !== 'DRAFT') {
      return { ok: false, error: `Batch is ${batch.status}, cannot send again` };
    }

    const total = batch.components.reduce((s, c) => s + c.amount, 0);
    const currency = batch.components[0]?.currency ?? '';
    const componentsTable = batch.components
      .map(
        (c) =>
          `- ${c.case.caseNumber}  ·  AUTH ${c.authCode ?? '—'}  ·  ${c.amount.toFixed(3)} ${c.currency}  ·  ${c.case.customerName}`,
      )
      .join('\n');

    const today = new Date().toISOString().slice(0, 10);
    const result = await dispatchEmail({
      templateKey: 'KNET_BATCH_FINANCE',
      locale: 'en',
      to: batch.recipientEmails,
      variables: {
        date: today,
        count: batch.components.length,
        componentsTable,
        totalAmount: `${total.toFixed(3)} ${currency}`,
        expectedFormat: 'CASE_NUMBER  AUTH_CODE  ARN',
      },
      context: { type: 'BATCH', id: batch.id },
    });

    // dispatchEmail returns { delivered: false } for production webhook
    // failures (it does NOT throw). Without this guard we would flip the
    // batch to SENT and atomically transition every component to
    // AWAITING_ARN — the components would then sit there forever waiting
    // for ARNs from a finance email that was never sent. Audit-log the
    // failed dispatch and bail; the batch stays DRAFT and can be retried.
    if (!result.delivered) {
      await writeAudit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'batch.knet.send_failed',
        entityId: batch.id,
        after: { recipients: batch.recipientEmails, error: result.error ?? 'unknown' },
      });
      return {
        ok: false,
        error: `Email dispatch failed: ${result.error ?? 'unknown error'}. Batch left as DRAFT — retry once the mail webhook is healthy.`,
      };
    }

    await prisma.$transaction(async (tx) => {
      await tx.knetBatch.update({
        where: { id: batch.id },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          ...(result.runId ? { powerAutomateRunId: result.runId } : {}),
        },
      });
      await tx.refundComponent.updateMany({
        where: { batchId: batch.id },
        data: { status: 'AWAITING_ARN' },
      });
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.knet.sent',
      entityId: batch.id,
      after: { recipients: batch.recipientEmails, runId: result.runId, count: batch.components.length },
    });

    revalidatePath('/operations');
    revalidatePath(`/operations/knet/${batch.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Ingest the suggested ARNs from Power Automate (or manual entry).
 * Sets each component to ARN_RECEIVED with the suggested ARN; agent will
 * verify each one separately via verifyKnetArnAction.
 */
export async function ingestKnetArnsAction(
  input: IngestKnetArnInput,
): Promise<ActionResult<{ updated: number }>> {
  try {
    const me = await requireUser();
    ensureFinanceOrAdmin(me.role);
    const parsed = ingestKnetArnSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { batchId, arns } = parsed.data;

    const batch = await prisma.knetBatch.findUnique({
      where: { id: batchId },
      select: { id: true, status: true, totalComponents: true },
    });
    if (!batch) return { ok: false, error: 'Batch not found' };
    if (batch.status !== 'SENT' && batch.status !== 'AWAITING_ARNS' && batch.status !== 'ARNS_RECEIVED') {
      return { ok: false, error: `Batch is ${batch.status}, cannot ingest ARNs` };
    }

    const componentIds = arns.map((a) => a.componentId);
    const eligible = await prisma.refundComponent.findMany({
      where: { id: { in: componentIds }, batchId },
      select: { id: true },
    });
    const eligibleIds = new Set(eligible.map((c) => c.id));

    let updated = 0;
    const now = new Date();
    await prisma.$transaction(async (tx) => {
      for (const a of arns) {
        if (!eligibleIds.has(a.componentId)) continue;
        await tx.refundComponent.update({
          where: { id: a.componentId },
          data: {
            arn: a.arn,
            arnSuggestedAt: now,
            status: 'ARN_RECEIVED',
          },
        });
        updated += 1;
      }
      // Count remaining components that still need an ARN. Comparing only
      // this round's `updated` against `totalComponents` would leave the
      // batch stuck at AWAITING_ARNS forever when ARNs are ingested in
      // multiple partial calls (e.g. finance replies in tranches).
      //
      // Exclude FAILED components: verifyKnetArnAction sets `arn: null,
      // status: 'FAILED'` when an agent rejects an ARN, and those rows
      // are terminally decided — counting them here would block the
      // batch from ever reaching ARNS_RECEIVED. Mirrors the remaining-
      // count logic at the bottom of verifyKnetArnAction.
      const remaining = await tx.refundComponent.count({
        where: { batchId, arn: null, status: { notIn: ['FAILED'] } },
      });
      await tx.knetBatch.update({
        where: { id: batchId },
        data: {
          status: remaining === 0 ? 'ARNS_RECEIVED' : 'AWAITING_ARNS',
          arnsReceived: { increment: updated },
          responseReceivedAt: now,
        },
      });
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'batch.knet.arns_ingested',
      entityId: batchId,
      after: { updated, requested: arns.length },
    });

    revalidatePath(`/operations/knet/${batchId}`);
    return { ok: true, data: { updated } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Agent verifies a single component's suggested ARN.
 *  - approve=true → status REFUNDED, refundedAt/refundedById set, case rolls up
 *  - approve=false → status FAILED, ARN cleared
 *
 * Once all components in a batch are verified (REFUNDED|FAILED), the batch is
 * marked COMPLETED.
 */
export async function verifyKnetArnAction(formData: FormData): Promise<ActionResult> {
  try {
    const me = await requireUser();
    ensureFinanceOrAdmin(me.role);
    const parsed = verifyKnetArnSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const { componentId, approve } = parsed.data;

    const comp = await prisma.refundComponent.findUnique({
      where: { id: componentId },
      include: {
        case: { select: { id: true, status: true } },
        batch: { select: { id: true } },
      },
    });
    if (!comp) return { ok: false, error: 'Component not found' };
    if (comp.status !== 'ARN_RECEIVED') {
      return { ok: false, error: `Component is ${comp.status}, expected ARN_RECEIVED` };
    }
    if (!comp.case) return { ok: false, error: 'Component is not attached to a case' };

    const now = new Date();
    // Component update + case rollup + batch rollup must be atomic.
    // A crash between any of these auto-committed writes leaves the
    // batch's `verifiedComponents` counter or the case status
    // permanently stale (e.g. batch detail shows "3/5 verified"
    // forever, case sits in IN_EXECUTION while every component is
    // decided). One transaction keeps all four mutations in lockstep.
    const caseRef = comp.case;
    const batchRef = comp.batch;
    let nextCaseStatus = caseRef.status;
    await prisma.$transaction(async (tx) => {
      await tx.refundComponent.update({
        where: { id: comp.id },
        data: approve
          ? {
              status: 'REFUNDED',
              arnVerifiedAt: now,
              refundedById: me.id,
              refundedAt: now,
            }
          : {
              // Clear the rejected ARN so it can't be mistaken for a
              // valid refund reference downstream (export, audit,
              // customer email). Matches the JSDoc contract on this
              // action.
              status: 'FAILED',
              arn: null,
              failureReason: 'ARN rejected by agent',
            },
      });

      // Roll up case status
      const all = await tx.refundComponent.findMany({
        where: { caseId: caseRef.id },
        select: { status: true },
      });
      const rolled = rollupCaseStatus(caseRef.status, all.map((c) => c.status));
      if (rolled !== caseRef.status) {
        await tx.refundCase.update({ where: { id: caseRef.id }, data: { status: rolled } });
      }
      nextCaseStatus = rolled;

      // Roll up batch status
      if (batchRef) {
        const remaining = await tx.refundComponent.count({
          where: {
            batchId: batchRef.id,
            status: { notIn: ['REFUNDED', 'FAILED'] },
          },
        });
        // Both APPROVE → REFUNDED and REJECT → FAILED count as a
        // "decision"; the batch's `remaining` query treats both as
        // terminal, so we must also bump verifiedComponents in both
        // cases — otherwise the counter permanently undercounts and
        // the batch detail page shows e.g. "3/5 verified" even after
        // every component has been decided.
        await tx.knetBatch.update({
          where: { id: batchRef.id },
          data: {
            verifiedComponents: { increment: 1 },
            ...(remaining === 0
              ? { status: 'COMPLETED', completedAt: now }
              : {}),
          },
        });
      }
    });

    await writeAudit({
      actorId: me.id,
      actorEmail: me.email,
      action: approve ? 'component.arn_verified' : 'component.arn_rejected',
      entityId: comp.id,
      before: { status: comp.status, caseStatus: comp.case.status },
      after: { status: approve ? 'REFUNDED' : 'FAILED', caseStatus: nextCaseStatus },
    });

    revalidatePath(`/cases/${comp.case.id}`);
    if (comp.batch) revalidatePath(`/operations/knet/${comp.batch.id}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
