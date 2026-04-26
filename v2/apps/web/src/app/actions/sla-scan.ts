'use server';

import { prisma, type CaseStatus } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import {
  pickSlaRule,
  classifyByHours,
  hoursBetween,
} from '@/lib/cases/sla-rules';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

const TERMINAL: CaseStatus[] = ['REFUNDED', 'REJECTED', 'CANCELLED'];

/**
 * Sweep open cases against active SLA rules. For each newly breached case
 * (no SLA_BREACHED notification in the last 24h for that case), insert a
 * notification for the assignee — or, if unassigned, fan out to all admins.
 * Returns counts so the caller can display feedback.
 *
 * Admin-gated and audit-logged; safe to invoke repeatedly thanks to the 24h
 * dedupe window.
 */
export async function scanSlaBreachesAction(): Promise<
  ActionResult<{
    scanned: number;
    breached: number;
    notificationsCreated: number;
    skipped: number;
  }>
> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'OPS_LEAD') {
      return { ok: false, error: 'FORBIDDEN' };
    }

    const now = new Date();
    const dedupeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [rules, openCases, admins] = await Promise.all([
      prisma.slaRule.findMany({ where: { isActive: true } }),
      prisma.refundCase.findMany({
        where: { deletedAt: null, status: { notIn: TERMINAL } },
        select: {
          id: true,
          caseNumber: true,
          status: true,
          createdAt: true,
          countryId: true,
          brandId: true,
          rootCauseId: true,
          assignedToId: true,
          country: { select: { registryCode: true } },
        },
      }),
      prisma.user.findMany({
        where: { status: 'ACTIVE', role: { is: { key: 'ADMIN' } } },
        select: { id: true },
      }),
    ]);

    const scanned = openCases.length;
    let breached = 0;
    let notificationsCreated = 0;
    let skipped = 0;

    for (const c of openCases) {
      const resolved = pickSlaRule(rules, {
        countryId: c.countryId,
        brandId: c.brandId,
        rootCauseId: c.rootCauseId,
      });
      const elapsedHours = hoursBetween(c.createdAt, now);
      const tier = classifyByHours(elapsedHours, resolved);
      if (tier !== 'breached') continue;
      breached += 1;

      // Dedupe: skip if any SLA_BREACHED notification exists for this case
      // in the last 24h.
      const recent = await prisma.notification.findFirst({
        where: {
          type: 'SLA_BREACHED',
          contextType: 'CASE',
          contextId: c.id,
          createdAt: { gte: dedupeCutoff },
        },
        select: { id: true },
      });
      if (recent) {
        skipped += 1;
        continue;
      }

      const recipientIds = c.assignedToId ? [c.assignedToId] : admins.map((a) => a.id);
      if (recipientIds.length === 0) {
        skipped += 1;
        continue;
      }

      const overrunHours = Math.round(elapsedHours - resolved.thresholdHours);
      const title = `SLA breached · ${c.caseNumber}`;
      const body = `Case is ${overrunHours}h over the ${resolved.thresholdHours}h threshold${
        resolved.rule ? ` (rule: ${resolved.rule.name})` : ''
      }.`;

      await prisma.notification.createMany({
        data: recipientIds.map((userId) => ({
          userId,
          type: 'SLA_BREACHED' as const,
          title,
          body,
          href: `/cases/${c.id}`,
          contextType: 'CASE',
          contextId: c.id,
        })),
      });
      notificationsCreated += recipientIds.length;
    }

    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        actorEmail: session.user.email,
        action: 'sla.breach_scan.run',
        entityType: 'SLA',
        metadata: JSON.stringify({
          scanned,
          breached,
          notificationsCreated,
          skipped,
        }),
      },
    });

    revalidatePath('/reports/sla');
    return {
      ok: true,
      data: { scanned, breached, notificationsCreated, skipped },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
