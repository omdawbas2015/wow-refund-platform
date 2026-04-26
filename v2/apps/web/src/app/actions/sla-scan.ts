'use server';

import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { runSlaBreachSweep, type SlaSweepResult } from '@/lib/cases/sla-sweep';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

/**
 * Sweep open cases against active SLA rules. For each newly breached case
 * (no SLA_BREACHED notification in the last 24h for that case), insert a
 * notification for the assignee — or, if unassigned, fan out to all admins.
 *
 * Admin / OPS_LEAD-gated and audit-logged; safe to invoke repeatedly thanks
 * to the 24h dedupe window. The actual sweep is delegated to
 * `runSlaBreachSweep` so the cron route can reuse the same logic.
 */
export async function scanSlaBreachesAction(): Promise<ActionResult<SlaSweepResult>> {
  try {
    const session = await auth();
    if (!session?.user) return { ok: false, error: 'UNAUTHENTICATED' };
    const role = session.user.role;
    if (role !== 'ADMIN' && role !== 'OPS_LEAD') {
      return { ok: false, error: 'FORBIDDEN' };
    }
    const data = await runSlaBreachSweep(
      { id: session.user.id, email: session.user.email, label: role },
      'admin',
    );
    revalidatePath('/reports/sla');
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
