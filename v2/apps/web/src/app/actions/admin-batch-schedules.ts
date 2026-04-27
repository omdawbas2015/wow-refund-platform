'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { validateCron } from '@/lib/scheduled-reports/cron';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

const baseSchema = z.object({
  type: z.enum(['APPROVAL', 'KNET', 'AURA']),
  countryId: z.string().min(1).optional().or(z.literal('')),
  cronExpr: z
    .string()
    .trim()
    .min(5)
    .refine((v) => validateCron(v) === null, {
      message: 'Invalid cron expression (use 5 fields, e.g. "0 17 * * *")',
    }),
  timezone: z.string().trim().min(1).max(40).default('Asia/Kuwait'),
  isActive: z.boolean().default(true),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({ id: z.string().min(1) });

function normalizeCountryId(value: string | undefined, type: 'APPROVAL' | 'KNET' | 'AURA') {
  if (type === 'APPROVAL') return value && value.length > 0 ? value : null;
  // KNET / AURA are global; ignore countryId.
  return null;
}

export async function createBatchScheduleAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = createSchema.parse(input);
    const created = await prisma.batchSchedule.create({
      data: {
        type: data.type,
        countryId: normalizeCountryId(data.countryId, data.type),
        cronExpr: data.cronExpr,
        timezone: data.timezone,
        isActive: data.isActive,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'batch_schedule.created',
        entityType: 'BATCH_SCHEDULE',
        entityId: created.id,
        metadata: JSON.stringify({ type: data.type, cronExpr: data.cronExpr }),
      },
    });
    revalidatePath('/admin/batch-schedules');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateBatchScheduleAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = updateSchema.parse(input);
    const before = await prisma.batchSchedule.findUnique({ where: { id: data.id } });
    if (!before) return { ok: false, error: 'Schedule not found' };
    await prisma.batchSchedule.update({
      where: { id: data.id },
      data: {
        type: data.type,
        countryId: normalizeCountryId(data.countryId, data.type),
        cronExpr: data.cronExpr,
        timezone: data.timezone,
        isActive: data.isActive,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'batch_schedule.updated',
        entityType: 'BATCH_SCHEDULE',
        entityId: data.id,
        beforeData: JSON.stringify(before),
        afterData: JSON.stringify(data),
      },
    });
    revalidatePath('/admin/batch-schedules');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleBatchScheduleAction(
  input: { id: string; isActive: boolean },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const { id, isActive } = z
      .object({ id: z.string().min(1), isActive: z.boolean() })
      .parse(input);
    await prisma.batchSchedule.update({ where: { id }, data: { isActive } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: isActive ? 'batch_schedule.activated' : 'batch_schedule.paused',
        entityType: 'BATCH_SCHEDULE',
        entityId: id,
      },
    });
    revalidatePath('/admin/batch-schedules');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteBatchScheduleAction(
  input: { id: string },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const id = z.string().min(1).parse(input.id);
    const before = await prisma.batchSchedule.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Schedule not found' };
    await prisma.batchSchedule.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'batch_schedule.deleted',
        entityType: 'BATCH_SCHEDULE',
        entityId: id,
        beforeData: JSON.stringify(before),
      },
    });
    revalidatePath('/admin/batch-schedules');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
