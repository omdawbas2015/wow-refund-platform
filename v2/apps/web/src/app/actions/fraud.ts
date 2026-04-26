'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { runFraudScan, type FraudScanResult } from '@/lib/fraud/fraud-scan';

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
 * Manual fraud-detection sweep. Delegates to runFraudScan so the cron
 * route and the admin button share identical detection rules + audit
 * shape. ADMIN-only.
 */
export async function scanForFraudAction(): Promise<
  ActionResult<FraudScanResult>
> {
  try {
    const me = await requireAdmin();
    const data = await runFraudScan(
      { id: me.id, email: me.email, label: 'admin' },
      'admin',
    );
    if (data.skipped === 'feature_disabled') {
      return { ok: false, error: 'Fraud signals feature flag is disabled.' };
    }
    revalidatePath('/admin/fraud-signals');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
