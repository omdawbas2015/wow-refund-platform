import { prisma } from '@wow/db';
import { isFeatureEnabled } from '@/lib/feature-flags';

export interface FraudScanActor {
  id: string | null;
  email: string;
  label?: string;
}

export interface FraudScanResult {
  created: number;
  rules: { rule: string; matches: number }[];
  skipped?: 'feature_disabled';
}

/**
 * Heuristic fraud scan. Pure helper used by the admin server action AND
 * the cron route — keeps detection rules and audit shape in lock-step
 * across trigger paths.
 *
 * Rules:
 *   1. CUSTOMER_MULTIPLE_REFUNDS — same `customerEmail` with ≥4 refunded
 *      cases in the last 30 days (severity WARNING; HIGH at 8+).
 *   2. AGENT_HIGH_VOLUME — single creator with ≥50 refunded cases in the
 *      last 7 days (severity WARNING).
 *
 * Per-signal dedupe: 24h window, keyed on `(kind, subjectType, subjectId)`.
 *
 * If the `feature.fraud_signals` flag is disabled, the scan returns
 * `{ created: 0, rules: [], skipped: 'feature_disabled' }` without
 * touching any tables. The cron route can then no-op cleanly.
 */
export async function runFraudScan(
  actor: FraudScanActor,
  source: 'admin' | 'cron' = 'admin',
): Promise<FraudScanResult> {
  const enabled = await isFeatureEnabled('feature.fraud_signals', false);
  if (!enabled) {
    return { created: 0, rules: [], skipped: 'feature_disabled' };
  }

  const now = new Date();
  const dedupeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  async function emit(args: {
    kind: string;
    severity: 'INFO' | 'WARNING' | 'HIGH';
    subjectType: 'CUSTOMER' | 'AGENT' | 'CASE';
    subjectId: string;
    description: string;
    metadata: Record<string, unknown>;
  }) {
    const dup = await prisma.fraudSignal.findFirst({
      where: {
        kind: args.kind,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        createdAt: { gte: dedupeCutoff },
      },
    });
    if (dup) return false;
    await prisma.fraudSignal.create({
      data: {
        kind: args.kind,
        severity: args.severity,
        subjectType: args.subjectType,
        subjectId: args.subjectId,
        description: args.description,
        metadata: JSON.stringify(args.metadata),
      },
    });
    return true;
  }

  const ruleStats: { rule: string; matches: number }[] = [];

  // Rule 1: CUSTOMER_MULTIPLE_REFUNDS
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const customerRefunds = await prisma.refundCase.groupBy({
    by: ['customerEmail'],
    where: {
      status: 'REFUNDED',
      updatedAt: { gte: since30 },
      deletedAt: null,
    },
    _count: { _all: true },
    having: { customerEmail: { _count: { gte: 4 } } },
  });
  let rule1Created = 0;
  for (const row of customerRefunds) {
    const count = row._count._all;
    const inserted = await emit({
      kind: 'CUSTOMER_MULTIPLE_REFUNDS',
      severity: count >= 8 ? 'HIGH' : 'WARNING',
      subjectType: 'CUSTOMER',
      subjectId: row.customerEmail,
      description: `${count} refunded cases for ${row.customerEmail} in the last 30 days.`,
      metadata: { count, windowDays: 30 },
    });
    if (inserted) rule1Created += 1;
  }
  ruleStats.push({ rule: 'CUSTOMER_MULTIPLE_REFUNDS', matches: rule1Created });

  // Rule 2: AGENT_HIGH_VOLUME
  const since7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const agentRefunds = await prisma.refundCase.groupBy({
    by: ['createdById'],
    where: {
      status: 'REFUNDED',
      updatedAt: { gte: since7 },
      deletedAt: null,
    },
    _count: { _all: true },
    having: { createdById: { _count: { gte: 50 } } },
  });
  let rule2Created = 0;
  for (const row of agentRefunds) {
    const count = row._count._all;
    const inserted = await emit({
      kind: 'AGENT_HIGH_VOLUME',
      severity: 'WARNING',
      subjectType: 'AGENT',
      subjectId: row.createdById,
      description: `Agent created ${count} refunded cases in the last 7 days.`,
      metadata: { count, windowDays: 7 },
    });
    if (inserted) rule2Created += 1;
  }
  ruleStats.push({ rule: 'AGENT_HIGH_VOLUME', matches: rule2Created });

  const total = rule1Created + rule2Created;
  await prisma.auditLog.create({
    data: {
      actorId: actor.id,
      actorEmail: actor.email,
      action: 'admin.fraud_scan.run',
      entityType: 'FRAUD_SIGNAL',
      metadata: JSON.stringify({
        source,
        actorLabel: actor.label ?? source,
        created: total,
        rules: ruleStats,
      }),
    },
  });

  return { created: total, rules: ruleStats };
}
