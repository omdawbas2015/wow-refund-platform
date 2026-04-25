'use server';

import { prisma, Prisma } from '@wow/db';
import {
  createApprovalBatchSchema,
  cancelApprovalBatchSchema,
  createKnetBatchSchema,
  verifyComponentArnSchema,
  createAuraBatchSchema,
  confirmAuraCaseSchema,
} from '@wow/validators';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { dispatchEmail } from '@/lib/email/dispatcher';
import {
  generateApprovalBatchNumber,
  generateKnetBatchNumber,
  generateAuraBatchNumber,
} from '@/lib/batches/numbers';
import { newMagicLinkToken, approvalMagicLinkUrl } from '@/lib/batches/magic-link';
import {
  renderCasesTable,
  renderKnetComponentsTable,
  renderAuraOrdersTable,
  formatMoney,
  type CaseRow,
  type KnetComponentRow,
  type AuraOrderRow,
} from '@/lib/batches/format';

type ActionResult<T = void> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

async function requireSession() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  return session.user;
}

const APPROVE_ROLES = new Set(['ADMIN', 'MANAGER']);
const OPS_ROLES = new Set(['ADMIN', 'OPERATIONS']);

function canSendApprovalBatch(role: string | null | undefined): boolean {
  return !!role && APPROVE_ROLES.has(role);
}

function canRunOpsBatch(role: string | null | undefined): boolean {
  return !!role && OPS_ROLES.has(role);
}

const KNET_KEY = 'knet';
const APP_BASE_URL = process.env['AUTH_URL'] ?? 'http://localhost:3000';

// ─────────────────────────────────────────────────────────────────────────
//  APPROVAL BATCHES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a fresh approval batch for a country and email the manager.
 *
 * - Pulls every PENDING_APPROVAL case in the country that isn't already linked
 *   to a live (non-terminal) approval batch.
 * - Generates a magic-link token that the manager can click as a fallback to
 *   the email-reply flow.
 * - Logs the dispatch to ActivityLog and AuditLog.
 */
export async function createApprovalBatchAction(
  input: unknown,
): Promise<ActionResult<{ batchId: string; batchNumber: string; cases: number }>> {
  try {
    const user = await requireSession();
    if (!canSendApprovalBatch(user.role)) {
      return { ok: false, error: 'You do not have permission to send approval batches.' };
    }

    const parsed = createApprovalBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input.' };
    const { countryId, recipientEmail, caseIds } = parsed.data;

    const country = await prisma.country.findUnique({
      where: { id: countryId },
      include: { registry: true },
    });
    if (!country) return { ok: false, error: 'Country not found.' };
    if (!country.isActive) return { ok: false, error: 'Country is not active.' };

    const managerEmail = recipientEmail ?? country.managerEmail;
    if (!managerEmail) {
      return {
        ok: false,
        error: `No manager email is configured for ${country.registry.nameEn}. Set one in Admin → Countries first.`,
      };
    }

    const now = new Date();
    const liveBatchStatuses = ['DRAFT', 'SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'] as const;

    const caseWhere: Prisma.RefundCaseWhereInput = {
      countryId,
      status: 'PENDING_APPROVAL',
      deletedAt: null,
      OR: [
        { approvalBatchId: null },
        {
          approvalBatch: {
            status: { notIn: ['DRAFT', 'SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'] },
          },
        },
      ],
    };
    if (caseIds && caseIds.length > 0) caseWhere.id = { in: caseIds };

    const candidates = await prisma.refundCase.findMany({
      where: caseWhere,
      include: {
        brand: { select: { name: true } },
        components: {
          include: { paymentMethod: { select: { label: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (candidates.length === 0) {
      return { ok: false, error: 'No pending cases to batch for this country.' };
    }

    const MAX_RETRIES = 5;
    let outcome: { batchId: string; batchNumber: string } | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        outcome = await prisma.$transaction(async (tx) => {
          const batchNumber = await generateApprovalBatchNumber(
            tx,
            country.registry.code,
          );
          const magicLinkToken = newMagicLinkToken();

          const batch = await tx.approvalBatch.create({
            data: {
              batchNumber,
              countryId,
              status: 'SENT',
              createdById: user.id,
              scheduledFor: now,
              sentAt: now,
              recipientEmails: managerEmail,
              magicLinkToken,
              totalCases: candidates.length,
            },
          });

          // Concurrency guard — only attach cases that are still pending and
          // not already on a live batch. This keeps two simultaneous batches
          // from grabbing the same case.
          const attached = await tx.refundCase.updateMany({
            where: {
              id: { in: candidates.map((c) => c.id) },
              status: 'PENDING_APPROVAL',
              deletedAt: null,
              OR: [
                { approvalBatchId: null },
                {
                  approvalBatch: {
                    status: {
                      notIn: ['DRAFT', 'SENT', 'AWAITING_RESPONSE', 'PARTIALLY_DECIDED'],
                    },
                  },
                },
              ],
            },
            data: { approvalBatchId: batch.id },
          });

          if (attached.count !== candidates.length) {
            // Someone else grabbed at least one case — bail out and retry.
            throw new Prisma.PrismaClientKnownRequestError(
              'BATCH_RACE',
              { code: 'P2034', clientVersion: '6' },
            );
          }

          for (const c of candidates) {
            await tx.activityLog.create({
              data: {
                caseId: c.id,
                actorId: user.id,
                actorLabel: user.name,
                kind: 'batch.attached',
                message: `Attached to approval batch ${batchNumber}`,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              actorEmail: user.email,
              action: 'approval_batch.sent',
              entityType: 'BATCH',
              entityId: batch.id,
              afterData: JSON.stringify({
                batchNumber,
                countryCode: country.registry.code,
                cases: candidates.length,
              }),
            },
          });

          return { batchId: batch.id, batchNumber };
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === 'P2002' || err.code === 'P2034')
        ) {
          if (attempt === MAX_RETRIES - 1) {
            return {
              ok: false,
              error: 'Could not allocate the batch atomically. Please retry.',
            };
          }
          continue;
        }
        throw err;
      }
    }
    if (!outcome) return { ok: false, error: 'Batch creation failed.' };

    const rows: CaseRow[] = candidates.map((c) => ({
      caseNumber: c.caseNumber,
      customerName: c.customerName,
      orderNumber: c.orderNumber,
      brandName: c.brand.name,
      paymentLabel: c.components[0]?.paymentMethod.label ?? '—',
      refundAmount: c.totalRefundAmount,
      currency: c.orderCurrency,
    }));
    const totalRefund = candidates.reduce((sum, c) => sum + c.totalRefundAmount, 0);
    const dateLabel = now.toISOString().slice(0, 10);

    // Refresh the magic-link token reference now that the row exists.
    const persisted = await prisma.approvalBatch.findUnique({
      where: { id: outcome.batchId },
      select: { magicLinkToken: true },
    });
    const approvalUrl = persisted?.magicLinkToken
      ? approvalMagicLinkUrl(persisted.magicLinkToken, APP_BASE_URL)
      : APP_BASE_URL;

    await dispatchEmail({
      templateKey: 'APPROVAL_BATCH_MANAGER',
      locale: 'en',
      to: managerEmail,
      variables: {
        managerName: country.registry.nameEn,
        country: country.registry.nameEn,
        date: dateLabel,
        count: candidates.length,
        casesTable: renderCasesTable(rows),
        totalAmount: formatMoney(totalRefund, candidates[0]?.orderCurrency ?? 'USD'),
        approvalUrl,
      },
      context: { type: 'BATCH', id: outcome.batchId },
    });

    revalidatePath('/operations');
    revalidatePath('/cases');
    return {
      ok: true,
      data: { batchId: outcome.batchId, batchNumber: outcome.batchNumber, cases: candidates.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function cancelApprovalBatchAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (!canSendApprovalBatch(user.role)) {
      return { ok: false, error: 'Not authorised to cancel approval batches.' };
    }

    const parsed = cancelApprovalBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input.' };
    const { batchId, reason } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.approvalBatch.findUnique({ where: { id: batchId } });
      if (!batch) return { ok: false as const, error: 'Batch not found.' };
      if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
        return { ok: false as const, error: `Batch is already ${batch.status}.` };
      }

      await tx.approvalBatch.update({
        where: { id: batchId },
        data: { status: 'CANCELLED', completedAt: new Date() },
      });

      await tx.refundCase.updateMany({
        where: { approvalBatchId: batchId, status: 'PENDING_APPROVAL' },
        data: { approvalBatchId: null },
      });

      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: 'approval_batch.cancelled',
          entityType: 'BATCH',
          entityId: batchId,
          metadata: JSON.stringify({ reason: reason ?? null }),
        },
      });

      return { ok: true as const };
    });

    revalidatePath('/operations');
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  KNET BATCHES
// ─────────────────────────────────────────────────────────────────────────

/**
 * Build a global KNET batch from approved KNET components that don't yet have
 * an ARN. Each component on the batch transitions to AWAITING_ARN.
 */
export async function createKnetBatchAction(
  input: unknown,
): Promise<ActionResult<{ batchId: string; batchNumber: string; components: number }>> {
  try {
    const user = await requireSession();
    if (!canRunOpsBatch(user.role)) {
      return { ok: false, error: 'You do not have permission to send KNET batches.' };
    }

    const parsed = createKnetBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input.' };
    const { recipientEmail, componentIds } = parsed.data;

    const knetMethod = await prisma.paymentMethod.findFirst({
      where: { key: KNET_KEY, isActive: true },
    });
    if (!knetMethod) return { ok: false, error: 'KNET payment method is not configured.' };

    const componentWhere: Prisma.RefundComponentWhereInput = {
      paymentMethodId: knetMethod.id,
      status: { in: ['PENDING', 'AWAITING_BATCH'] },
      arn: null,
      batchId: null,
      case: {
        deletedAt: null,
        status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED'] },
      },
    };
    if (componentIds && componentIds.length > 0) componentWhere.id = { in: componentIds };

    const candidates = await prisma.refundComponent.findMany({
      where: componentWhere,
      include: {
        case: {
          include: { brand: { select: { name: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    if (candidates.length === 0) {
      return { ok: false, error: 'No KNET components are awaiting a batch.' };
    }

    const recipient = recipientEmail ?? process.env['KNET_FINANCE_EMAIL'] ?? 'finance@wow.local';
    const now = new Date();

    const MAX_RETRIES = 5;
    let outcome: { batchId: string; batchNumber: string } | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        outcome = await prisma.$transaction(async (tx) => {
          const batchNumber = await generateKnetBatchNumber(tx);

          const batch = await tx.knetBatch.create({
            data: {
              batchNumber,
              status: 'SENT',
              scheduledFor: now,
              sentAt: now,
              recipientEmails: recipient,
              totalComponents: candidates.length,
            },
          });

          const attached = await tx.refundComponent.updateMany({
            where: {
              id: { in: candidates.map((c) => c.id) },
              batchId: null,
              arn: null,
              status: { in: ['PENDING', 'AWAITING_BATCH'] },
            },
            data: { batchId: batch.id, status: 'AWAITING_ARN' },
          });
          if (attached.count !== candidates.length) {
            throw new Prisma.PrismaClientKnownRequestError(
              'BATCH_RACE',
              { code: 'P2034', clientVersion: '6' },
            );
          }

          await tx.refundCase.updateMany({
            where: { id: { in: candidates.map((c) => c.caseId) }, status: 'APPROVED' },
            data: { status: 'IN_EXECUTION' },
          });

          for (const c of candidates) {
            await tx.activityLog.create({
              data: {
                caseId: c.caseId,
                actorId: user.id,
                actorLabel: user.name,
                kind: 'batch.knet.attached',
                message: `Component attached to KNET batch ${batchNumber}`,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              actorEmail: user.email,
              action: 'knet_batch.sent',
              entityType: 'BATCH',
              entityId: batch.id,
              afterData: JSON.stringify({ batchNumber, components: candidates.length }),
            },
          });

          return { batchId: batch.id, batchNumber };
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === 'P2002' || err.code === 'P2034')
        ) {
          if (attempt === MAX_RETRIES - 1) {
            return { ok: false, error: 'KNET batch could not be allocated atomically.' };
          }
          continue;
        }
        throw err;
      }
    }
    if (!outcome) return { ok: false, error: 'KNET batch creation failed.' };

    const rows: KnetComponentRow[] = candidates.map((c) => ({
      caseNumber: c.case.caseNumber,
      authCode: c.authCode,
      amount: c.amount,
      currency: c.currency,
      customerName: c.case.customerName,
    }));
    const total = candidates.reduce((sum, c) => sum + c.amount, 0);

    await dispatchEmail({
      templateKey: 'KNET_BATCH_FINANCE',
      locale: 'en',
      to: recipient,
      variables: {
        date: now.toISOString().slice(0, 10),
        count: candidates.length,
        componentsTable: renderKnetComponentsTable(rows),
        totalAmount: formatMoney(total, candidates[0]?.currency ?? 'KWD'),
        expectedFormat: 'REF-XX-YYYY-NNNNNN: <ARN>',
      },
      context: { type: 'BATCH', id: outcome.batchId },
    });

    revalidatePath('/operations');
    revalidatePath('/cases');
    return {
      ok: true,
      data: { batchId: outcome.batchId, batchNumber: outcome.batchNumber, components: candidates.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

/**
 * Agent verifies the ARN suggested by Power Automate (or enters one manually).
 * Marks the component refunded and rolls the parent case up to
 * REFUNDED / PARTIALLY_REFUNDED depending on sibling-component state.
 */
export async function verifyComponentArnAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (!canRunOpsBatch(user.role)) {
      return { ok: false, error: 'Not authorised to verify ARNs.' };
    }

    const parsed = verifyComponentArnSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input.' };
    const { componentId, arn } = parsed.data;
    const trimmedArn = arn.trim().toUpperCase();

    const result = await prisma.$transaction(async (tx) => {
      const component = await tx.refundComponent.findUnique({
        where: { id: componentId },
        include: { case: true },
      });
      if (!component) return { ok: false as const, error: 'Component not found.' };
      if (component.status === 'REFUNDED') {
        return { ok: false as const, error: 'Component is already refunded.' };
      }
      if (component.case.deletedAt) {
        return { ok: false as const, error: 'Case is archived.' };
      }

      const now = new Date();
      const guarded = await tx.refundComponent.updateMany({
        where: { id: componentId, status: component.status },
        data: {
          arn: trimmedArn,
          arnVerifiedAt: now,
          status: 'REFUNDED',
          refundedById: user.id,
          refundedAt: now,
        },
      });
      if (guarded.count === 0) {
        return {
          ok: false as const,
          error: 'Component was modified by someone else; please refresh.',
        };
      }

      // Roll the case status up.
      const siblings = await tx.refundComponent.findMany({
        where: { caseId: component.caseId },
        select: { status: true },
      });
      const allDone = siblings.every((s) => s.status === 'REFUNDED');
      const anyDone = siblings.some((s) => s.status === 'REFUNDED');
      const anyFailed = siblings.some((s) => s.status === 'FAILED');

      let nextCaseStatus = component.case.status;
      if (allDone && !anyFailed) nextCaseStatus = 'REFUNDED';
      else if (anyDone) nextCaseStatus = 'PARTIALLY_REFUNDED';

      if (nextCaseStatus !== component.case.status) {
        await tx.refundCase.updateMany({
          where: { id: component.caseId, status: component.case.status },
          data: { status: nextCaseStatus },
        });
      }

      await tx.activityLog.create({
        data: {
          caseId: component.caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: 'component.arn_verified',
          message: `ARN ${trimmedArn} verified for ${component.case.caseNumber}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: 'component.arn_verified',
          entityType: 'CASE',
          entityId: component.caseId,
          afterData: JSON.stringify({ componentId, arn: trimmedArn, caseStatus: nextCaseStatus }),
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    revalidatePath('/operations');
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

// ─────────────────────────────────────────────────────────────────────────
//  AURA BATCHES
// ─────────────────────────────────────────────────────────────────────────

export async function createAuraBatchAction(
  input: unknown,
): Promise<ActionResult<{ batchId: string; batchNumber: string; cases: number }>> {
  try {
    const user = await requireSession();
    if (!canRunOpsBatch(user.role)) {
      return { ok: false, error: 'You do not have permission to send Aura batches.' };
    }

    const parsed = createAuraBatchSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input.' };
    const { recipientEmail, caseIds } = parsed.data;

    const caseWhere: Prisma.RefundCaseWhereInput = {
      auraStatus: 'PENDING',
      auraPoints: { gt: 0 },
      deletedAt: null,
      status: { in: ['APPROVED', 'IN_EXECUTION', 'PARTIALLY_REFUNDED', 'REFUNDED'] },
    };
    if (caseIds && caseIds.length > 0) caseWhere.id = { in: caseIds };

    const candidates = await prisma.refundCase.findMany({
      where: caseWhere,
      orderBy: { createdAt: 'asc' },
    });
    if (candidates.length === 0) {
      return { ok: false, error: 'No Aura cases are pending a batch.' };
    }

    const recipient = recipientEmail ?? process.env['AURA_TEAM_EMAIL'] ?? 'aura@wow.local';
    const now = new Date();

    const MAX_RETRIES = 5;
    let outcome: { batchId: string; batchNumber: string } | null = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        outcome = await prisma.$transaction(async (tx) => {
          const batchNumber = await generateAuraBatchNumber(tx);
          const batch = await tx.auraBatch.create({
            data: {
              batchNumber,
              status: 'SENT',
              scheduledFor: now,
              sentAt: now,
              recipientEmails: recipient,
              totalCases: candidates.length,
            },
          });

          // Claim every candidate case atomically. The PENDING guard ensures
          // a concurrent batch creation can't double-claim the same case —
          // if another batch took some of these cases between findMany and
          // here, the count check below trips a P2034 retry.
          const claimed = await tx.refundCase.updateMany({
            where: {
              id: { in: candidates.map((c) => c.id) },
              auraStatus: 'PENDING',
              auraBatchId: null,
            },
            data: {
              auraStatus: 'IN_BATCH',
              auraBatchId: batch.id,
            },
          });
          if (claimed.count !== candidates.length) {
            // Force a transaction abort + retry. We use P2034 so the outer
            // retry loop sees a serialization-style error.
            throw new Prisma.PrismaClientKnownRequestError(
              'Aura batch races: candidate set changed during claim',
              { code: 'P2034', clientVersion: '6.x' },
            );
          }

          for (const c of candidates) {
            await tx.activityLog.create({
              data: {
                caseId: c.id,
                actorId: user.id,
                actorLabel: user.name,
                kind: 'batch.aura.attached',
                message: `Aura points attached to batch ${batchNumber}`,
              },
            });
          }

          await tx.auditLog.create({
            data: {
              actorId: user.id,
              actorEmail: user.email,
              action: 'aura_batch.sent',
              entityType: 'BATCH',
              entityId: batch.id,
              afterData: JSON.stringify({ batchNumber, cases: candidates.length }),
            },
          });

          return { batchId: batch.id, batchNumber };
        });
        break;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          (err.code === 'P2002' || err.code === 'P2034')
        ) {
          if (attempt === MAX_RETRIES - 1) {
            return { ok: false, error: 'Aura batch could not be allocated atomically.' };
          }
          continue;
        }
        throw err;
      }
    }
    if (!outcome) return { ok: false, error: 'Aura batch creation failed.' };

    const rows: AuraOrderRow[] = candidates.map((c) => ({
      caseNumber: c.caseNumber,
      orderNumber: c.orderNumber,
      customerName: c.customerName,
      customerEmail: c.customerEmail,
      points: c.auraPoints ?? 0,
    }));
    const totalPoints = candidates.reduce((sum, c) => sum + (c.auraPoints ?? 0), 0);

    await dispatchEmail({
      templateKey: 'AURA_BATCH_TEAM',
      locale: 'en',
      to: recipient,
      variables: {
        date: now.toISOString().slice(0, 10),
        count: candidates.length,
        ordersTable: renderAuraOrdersTable(rows),
        totalPoints,
      },
      context: { type: 'BATCH', id: outcome.batchId },
    });

    revalidatePath('/operations');
    revalidatePath('/cases');
    return {
      ok: true,
      data: { batchId: outcome.batchId, batchNumber: outcome.batchNumber, cases: candidates.length },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function confirmAuraCaseAction(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireSession();
    if (!canRunOpsBatch(user.role)) {
      return { ok: false, error: 'Not authorised to confirm Aura cases.' };
    }

    const parsed = confirmAuraCaseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input.' };
    const { caseId, status, failureReason } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const c = await tx.refundCase.findUnique({ where: { id: caseId } });
      if (!c) return { ok: false as const, error: 'Case not found.' };
      if (c.auraStatus !== 'PENDING' && c.auraStatus !== 'IN_BATCH') {
        return {
          ok: false as const,
          error: `Aura status is ${c.auraStatus}, can only confirm PENDING or IN_BATCH.`,
        };
      }

      const guarded = await tx.refundCase.updateMany({
        where: { id: caseId, auraStatus: { in: ['PENDING', 'IN_BATCH'] } },
        data: {
          auraStatus: status,
          auraProcessedAt: new Date(),
          auraProcessedById: user.id,
        },
      });
      if (guarded.count === 0) {
        return { ok: false as const, error: 'Aura status was changed by another user.' };
      }

      await tx.activityLog.create({
        data: {
          caseId,
          actorId: user.id,
          actorLabel: user.name,
          kind: status === 'COMPLETED' ? 'aura.completed' : 'aura.failed',
          message:
            status === 'COMPLETED'
              ? 'Aura points refunded'
              : `Aura refund failed${failureReason ? ` — ${failureReason}` : ''}`,
        },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          actorEmail: user.email,
          action: status === 'COMPLETED' ? 'aura.completed' : 'aura.failed',
          entityType: 'CASE',
          entityId: caseId,
          metadata: JSON.stringify({ failureReason: failureReason ?? null }),
        },
      });

      return { ok: true as const };
    });

    if (!result.ok) return result;

    revalidatePath('/operations');
    revalidatePath('/cases');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}
