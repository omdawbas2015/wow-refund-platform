'use server';

import { prisma } from '@wow/db';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const decisionSchema = z.object({
  token: z.string().trim().min(10),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().trim().max(500).optional(),
});

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Magic-link decision endpoint used by the public `/[locale]/approve/[token]`
 * page. Applies a blanket decision to every PENDING_APPROVAL case on the batch
 * and closes the batch.
 */
export async function decideMagicLinkBatchAction(input: unknown): Promise<ActionResult> {
  const parsed = decisionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'Invalid input.' };
  const { token, decision, reason } = parsed.data;

  const batch = await prisma.approvalBatch.findUnique({
    where: { magicLinkToken: token },
    include: { cases: { select: { id: true, status: true } } },
  });
  if (!batch) return { ok: false, error: 'This approval link is invalid or expired.' };
  if (batch.status === 'COMPLETED' || batch.status === 'CANCELLED') {
    return { ok: false, error: `Batch is already ${batch.status.toLowerCase()}.` };
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    let approved = 0;
    let rejected = 0;
    for (const c of batch.cases) {
      if (c.status !== 'PENDING_APPROVAL') continue;
      const guard = await tx.refundCase.updateMany({
        where: { id: c.id, status: 'PENDING_APPROVAL' },
        data:
          decision === 'APPROVED'
            ? { status: 'APPROVED', approvedAt: now }
            : { status: 'REJECTED', rejectedReason: reason ?? 'Rejected via magic link' },
      });
      if (guard.count === 0) continue;
      if (decision === 'APPROVED') approved++;
      else rejected++;

      await tx.activityLog.create({
        data: {
          caseId: c.id,
          actorLabel: 'Manager (magic link)',
          kind: decision === 'APPROVED' ? 'case.approved' : 'case.rejected',
          message:
            decision === 'APPROVED'
              ? `Approved via magic-link batch ${batch.batchNumber}`
              : `Rejected via magic-link batch ${batch.batchNumber}${reason ? ` — ${reason}` : ''}`,
        },
      });
    }

    await tx.approvalBatch.update({
      where: { id: batch.id },
      data: {
        status: 'COMPLETED',
        approvedCases: { increment: approved },
        rejectedCases: { increment: rejected },
        responseReceivedAt: now,
        responseRawBody: `Magic-link decision: ${decision}${reason ? ` — ${reason}` : ''}`,
        responseParsed: JSON.stringify({ source: 'magic-link', decision, reason: reason ?? null }),
        completedAt: now,
        // Burn the token so the link can't be reused.
        magicLinkToken: null,
      },
    });

    await tx.auditLog.create({
      data: {
        actorEmail: 'magic-link@wow',
        action:
          decision === 'APPROVED'
            ? 'approval_batch.magic_link_approved'
            : 'approval_batch.magic_link_rejected',
        entityType: 'BATCH',
        entityId: batch.id,
        afterData: JSON.stringify({ approved, rejected, reason: reason ?? null }),
      },
    });
  });

  revalidatePath('/operations');
  return { ok: true };
}
