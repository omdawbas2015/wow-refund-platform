import { prisma } from '@wow/db';
import {
  APPROVAL_BATCH_NUMBER_REGEX,
  KNET_BATCH_NUMBER_REGEX,
  AURA_BATCH_NUMBER_REGEX,
} from '@wow/validators';
import { parseApprovalReply } from './parse-reply';
import { parseArnReply } from './parse-arn';

export interface ProcessOutcome {
  intent:
    | 'APPROVAL_RESPONSE'
    | 'KNET_ARN_REPLY'
    | 'AURA_CONFIRMATION'
    | 'CUSTOMER_REPLY'
    | 'IGNORED';
  payload?: Record<string, unknown>;
  linkedBatchId?: string;
  linkedCaseId?: string;
  linkedComponentId?: string;
}

/**
 * Inspect an inbound email body and dispatch it to the right handler.
 *
 * The function is conservative: when classification is ambiguous it returns
 * `IGNORED` so a human can review the inbound row in the admin panel later.
 * Calls into prisma so the per-handler updates participate in the same DB.
 */
export async function processInboundReply(args: {
  fromEmail: string;
  subject: string;
  rawBody: string;
}): Promise<ProcessOutcome> {
  const { subject, rawBody } = args;

  const haystack = `${subject}\n${rawBody}`;
  const approvalMatch = haystack.match(APPROVAL_BATCH_NUMBER_REGEX);
  const knetMatch = haystack.match(KNET_BATCH_NUMBER_REGEX);
  const auraMatch = haystack.match(AURA_BATCH_NUMBER_REGEX);

  if (approvalMatch?.length) {
    return await applyApprovalReply(approvalMatch[0]!, rawBody);
  }
  if (knetMatch?.length) {
    return await applyKnetArnReply(knetMatch[0]!, rawBody);
  }
  if (auraMatch?.length) {
    return await applyAuraConfirmation(auraMatch[0]!, rawBody);
  }

  return { intent: 'IGNORED' };
}

async function applyApprovalReply(
  batchNumber: string,
  rawBody: string,
): Promise<ProcessOutcome> {
  const batch = await prisma.approvalBatch.findUnique({
    where: { batchNumber },
    include: { cases: { select: { id: true, caseNumber: true, status: true } } },
  });
  if (!batch) {
    return { intent: 'IGNORED', payload: { reason: 'unknown approval batch', batchNumber } };
  }
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    return { intent: 'IGNORED', payload: { reason: 'batch closed', batchNumber } };
  }

  const parsed = parseApprovalReply(rawBody);
  const decisions = new Map<string, 'APPROVED' | 'REJECTED'>();

  for (const entry of parsed.perCase) decisions.set(entry.caseNumber, entry.decision);

  // Blanket fallback only kicks in if the manager didn't list specific cases.
  if (decisions.size === 0 && parsed.blanket) {
    for (const c of batch.cases) {
      if (c.status === 'PENDING_APPROVAL') decisions.set(c.caseNumber, parsed.blanket);
    }
  }

  if (decisions.size === 0) {
    return { intent: 'IGNORED', payload: { reason: 'no decision keywords found' } };
  }

  await prisma.$transaction(async (tx) => {
    let approved = 0;
    let rejected = 0;
    for (const c of batch.cases) {
      const decision = decisions.get(c.caseNumber);
      if (!decision) continue;
      if (c.status !== 'PENDING_APPROVAL') continue;

      const guard = await tx.refundCase.updateMany({
        where: { id: c.id, status: 'PENDING_APPROVAL' },
        data:
          decision === 'APPROVED'
            ? { status: 'APPROVED', approvedAt: new Date() }
            : { status: 'REJECTED', rejectedReason: 'Manager rejected via email' },
      });
      if (guard.count === 0) continue;

      if (decision === 'APPROVED') approved++;
      else rejected++;

      await tx.activityLog.create({
        data: {
          caseId: c.id,
          actorLabel: 'Manager (email)',
          kind: decision === 'APPROVED' ? 'case.approved' : 'case.rejected',
          message:
            decision === 'APPROVED'
              ? `Approved via email reply to batch ${batchNumber}`
              : `Rejected via email reply to batch ${batchNumber}`,
        },
      });
    }

    const totalDecided =
      batch.approvedCases + approved + (batch.rejectedCases + rejected);
    const totalCases = batch.totalCases;
    const allDecided = totalDecided >= totalCases;

    await tx.approvalBatch.update({
      where: { id: batch.id },
      data: {
        approvedCases: { increment: approved },
        rejectedCases: { increment: rejected },
        status: allDecided ? 'COMPLETED' : 'PARTIALLY_DECIDED',
        responseReceivedAt: new Date(),
        responseRawBody: rawBody.slice(0, 8000),
        responseParsed: JSON.stringify(Array.from(decisions.entries())),
        completedAt: allDecided ? new Date() : null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorEmail: 'inbound@power-automate',
        action: 'approval_batch.decision_applied',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify({ approved, rejected, allDecided }),
      },
    });
  });

  return {
    intent: 'APPROVAL_RESPONSE',
    linkedBatchId: batch.id,
    payload: { decisions: Array.from(decisions.entries()) },
  };
}

async function applyKnetArnReply(
  batchNumber: string,
  rawBody: string,
): Promise<ProcessOutcome> {
  const batch = await prisma.knetBatch.findUnique({
    where: { batchNumber },
    include: { components: { include: { case: { select: { caseNumber: true } } } } },
  });
  if (!batch) {
    return { intent: 'IGNORED', payload: { reason: 'unknown knet batch', batchNumber } };
  }
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    return { intent: 'IGNORED', payload: { reason: 'batch closed', batchNumber } };
  }

  const arnEntries = parseArnReply(rawBody);
  if (arnEntries.length === 0) {
    return { intent: 'IGNORED', payload: { reason: 'no ARN entries parsed' } };
  }

  // Index components by their case number so we can map suggestions back.
  const byCaseNumber = new Map<string, typeof batch.components[number]>();
  for (const c of batch.components) byCaseNumber.set(c.case.caseNumber, c);

  const applied: Array<{ caseNumber: string; arn: string; componentId: string }> = [];
  await prisma.$transaction(async (tx) => {
    for (const entry of arnEntries) {
      const component = byCaseNumber.get(entry.caseNumber);
      if (!component) continue;
      if (component.status === 'REFUNDED') continue;
      const guard = await tx.refundComponent.updateMany({
        where: { id: component.id, arn: null, status: 'AWAITING_ARN' },
        data: {
          arn: entry.arn,
          arnSuggestedAt: new Date(),
          status: 'ARN_RECEIVED',
        },
      });
      if (guard.count === 0) continue;
      applied.push({
        caseNumber: entry.caseNumber,
        arn: entry.arn,
        componentId: component.id,
      });

      await tx.activityLog.create({
        data: {
          caseId: component.caseId,
          actorLabel: 'Finance (email)',
          kind: 'component.arn_suggested',
          message: `Power Automate parsed ARN ${entry.arn} for ${entry.caseNumber}`,
        },
      });

      // (Per-user notifications for the ops desk are deferred until Phase 6
      // adds team-level fan-out; the activity log + operations page surface
      // the new ARN suggestion in the meantime.)
    }

    await tx.knetBatch.update({
      where: { id: batch.id },
      data: {
        arnsReceived: { increment: applied.length },
        responseReceivedAt: new Date(),
        responseRawBody: rawBody.slice(0, 8000),
        responseParsedArns: JSON.stringify(applied),
        status: applied.length >= batch.totalComponents ? 'ARNS_RECEIVED' : 'AWAITING_ARNS',
      },
    });
    await tx.auditLog.create({
      data: {
        actorEmail: 'inbound@power-automate',
        action: 'knet_batch.arns_suggested',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify(applied),
      },
    });
  });

  return {
    intent: 'KNET_ARN_REPLY',
    linkedBatchId: batch.id,
    payload: { applied },
  };
}

async function applyAuraConfirmation(
  batchNumber: string,
  rawBody: string,
): Promise<ProcessOutcome> {
  const batch = await prisma.auraBatch.findUnique({ where: { batchNumber } });
  if (!batch) return { intent: 'IGNORED', payload: { reason: 'unknown aura batch', batchNumber } };

  // Aura confirmation is much simpler: we trust per-case decisions parsed from
  // the body, defaulting to COMPLETED when keywords are positive.
  const parsed = parseApprovalReply(rawBody);
  const decisions = new Map<string, 'COMPLETED' | 'FAILED'>();
  for (const entry of parsed.perCase) {
    decisions.set(entry.caseNumber, entry.decision === 'APPROVED' ? 'COMPLETED' : 'FAILED');
  }

  if (decisions.size === 0) {
    return { intent: 'IGNORED', payload: { reason: 'no aura decisions parsed' } };
  }

  let completed = 0;
  await prisma.$transaction(async (tx) => {
    for (const [caseNumber, status] of decisions) {
      const guard = await tx.refundCase.updateMany({
        where: { caseNumber, auraStatus: 'PENDING' },
        data: {
          auraStatus: status,
          auraProcessedAt: new Date(),
        },
      });
      if (guard.count === 0) continue;
      if (status === 'COMPLETED') completed++;

      const updatedCase = await tx.refundCase.findUnique({
        where: { caseNumber },
        select: { id: true },
      });
      if (updatedCase) {
        await tx.activityLog.create({
          data: {
            caseId: updatedCase.id,
            actorLabel: 'Aura team (email)',
            kind: status === 'COMPLETED' ? 'aura.completed' : 'aura.failed',
            message:
              status === 'COMPLETED'
                ? `Aura points refunded (batch ${batchNumber})`
                : `Aura refund failed (batch ${batchNumber})`,
          },
        });
      }
    }

    await tx.auraBatch.update({
      where: { id: batch.id },
      data: {
        completedCases: { increment: completed },
        responseReceivedAt: new Date(),
        responseRawBody: rawBody.slice(0, 8000),
        responseParsed: JSON.stringify(Array.from(decisions.entries())),
        status: completed >= batch.totalCases ? 'COMPLETED' : 'AWAITING',
        completedAt: completed >= batch.totalCases ? new Date() : null,
      },
    });
    await tx.auditLog.create({
      data: {
        actorEmail: 'inbound@power-automate',
        action: 'aura_batch.confirmation_applied',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify(Array.from(decisions.entries())),
      },
    });
  });

  return {
    intent: 'AURA_CONFIRMATION',
    linkedBatchId: batch.id,
    payload: { decisions: Array.from(decisions.entries()) },
  };
}
