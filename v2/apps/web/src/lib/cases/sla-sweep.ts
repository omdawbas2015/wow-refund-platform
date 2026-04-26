import { prisma, type CaseStatus } from '@wow/db';
import { pickSlaRule, classifyByHours, hoursBetween } from './sla-rules';

const TERMINAL: CaseStatus[] = ['REFUNDED', 'REJECTED', 'CANCELLED'];

export interface SlaSweepResult {
  scanned: number;
  breached: number;
  notificationsCreated: number;
  skipped: number;
}

export interface SlaSweepActor {
  id: string | null;
  email: string;
  /** Free-form label for the audit log; e.g. "cron" when there is no user. */
  label?: string;
}

/**
 * Pure SLA breach sweep. Used by the admin server action AND the cron API
 * route. Always inserts an audit log entry tagged with the supplied actor.
 *
 * - Walks every open (non-terminal) refund case.
 * - Resolves the most-specific active rule via `pickSlaRule`.
 * - For each `breached` case, dedupes against an SLA_BREACHED notification
 *   created in the last 24h for the same case.
 * - Recipients: assignee if set, otherwise all ACTIVE admin users.
 *
 * The audit log entry's `actorId` is null for cron invocations; use the
 * `metadata.source` field to distinguish.
 */
export async function runSlaBreachSweep(
  actor: SlaSweepActor,
  source: 'admin' | 'cron' = 'admin',
): Promise<SlaSweepResult> {
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
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'sla.breach_scan.run',
      entityType: 'SLA',
      metadata: JSON.stringify({
        source,
        actorLabel: actor.label ?? source,
        scanned,
        breached,
        notificationsCreated,
        skipped,
      }),
    },
  });

  return { scanned, breached, notificationsCreated, skipped };
}
