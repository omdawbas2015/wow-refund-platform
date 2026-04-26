'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { isFeatureEnabled } from '@/lib/feature-flags';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

export async function acknowledgeFraudSignalAction(
  input: { id: string },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const existing = await prisma.fraudSignal.findUnique({ where: { id: input.id } });
    if (!existing) return { ok: false, error: 'Signal not found' };
    if (existing.acknowledgedAt) return { ok: true };

    await prisma.fraudSignal.update({
      where: { id: input.id },
      data: { acknowledgedAt: new Date(), acknowledgedBy: me.id },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.fraud_signal.acknowledged',
        entityType: 'FRAUD_SIGNAL',
        entityId: input.id,
      },
    });
    revalidatePath('/admin/fraud-signals');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Manual fraud-detection sweep. Runs a small set of heuristic rules and
 * inserts FraudSignal rows for any new findings (deduped by subject + kind
 * within a 24h window so back-to-back scans don't spam the dashboard).
 *
 * Rules (intentionally conservative — we'd rather miss than spam):
 *   1. CUSTOMER_MULTIPLE_REFUNDS — same customer email with 4+ refunded cases
 *      in the last 30 days (severity WARNING; HIGH at 8+).
 *   2. AGENT_HIGH_VOLUME — single creator with 50+ refunded cases in the last
 *      7 days (severity WARNING).
 */
export async function scanForFraudAction(): Promise<
  ActionResult<{ created: number; rules: { rule: string; matches: number }[] }>
> {
  try {
    const me = await requireAdmin();
    const enabled = await isFeatureEnabled('feature.fraud_signals', false);
    if (!enabled) {
      return { ok: false, error: 'Fraud signals feature flag is disabled.' };
    }

    const now = new Date();
    const dedupeCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Helper: only insert if no recent identical signal exists.
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
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.fraud_scan.run',
        entityType: 'FRAUD_SIGNAL',
        metadata: JSON.stringify({ created: total, rules: ruleStats }),
      },
    });
    revalidatePath('/admin/fraud-signals');
    return { ok: true, data: { created: total, rules: ruleStats } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
