'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { validateCron } from '@/lib/scheduled-reports/cron';
import { runScheduledReport } from '@/lib/scheduled-reports/run';

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

const recipientsValidator = z
  .string()
  .trim()
  .min(3, 'At least one recipient is required')
  .refine(
    (val) => {
      const parts = val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      if (parts.length === 0) return false;
      return parts.every((p) => /^[^@\s,]+@[^@\s,]+\.[^@\s,]+$/.test(p));
    },
    'Recipients must be a comma-separated list of email addresses',
  );

const filtersJsonValidator = z
  .string()
  .trim()
  .refine(
    (val) => {
      if (!val) return true;
      try {
        const parsed = JSON.parse(val);
        return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed);
      } catch {
        return false;
      }
    },
    'Filters must be a JSON object (e.g. {"countryId":"abc","fromDays":7})',
  );

const baseSchema = z.object({
  name: z.string().trim().min(2, 'Name is too short').max(120),
  cronExpr: z
    .string()
    .trim()
    .min(5, 'Provide a 5-field cron expression')
    .refine((v) => validateCron(v) === null, {
      message: 'Invalid cron expression (use 5 fields, e.g. "0 8 * * 1-5")',
    }),
  timezone: z.string().trim().min(1).max(40).default('Asia/Kuwait'),
  scope: z.enum(['DASHBOARD', 'CASES', 'PROMOS']),
  filters: filtersJsonValidator.default('{}'),
  recipients: recipientsValidator,
  format: z.enum(['XLSX', 'PDF']).default('XLSX'),
  isActive: z.boolean().default(true),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({
  id: z.string().min(1),
});

export async function createScheduledReportAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const data = createSchema.parse(input);
    const created = await prisma.scheduledReport.create({
      data: {
        name: data.name,
        ownerId: me.id,
        cronExpr: data.cronExpr,
        timezone: data.timezone,
        scope: data.scope,
        filters: data.filters || '{}',
        recipients: data.recipients,
        format: data.format,
        isActive: data.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'scheduled_report.created',
        entityType: 'SCHEDULED_REPORT',
        entityId: created.id,
        metadata: JSON.stringify({ name: data.name, scope: data.scope, cronExpr: data.cronExpr }),
      },
    });

    revalidatePath('/admin/scheduled-reports');
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateScheduledReportAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = updateSchema.parse(input);
    const before = await prisma.scheduledReport.findUnique({ where: { id: data.id } });
    if (!before) return { ok: false, error: 'Report not found' };

    await prisma.scheduledReport.update({
      where: { id: data.id },
      data: {
        name: data.name,
        cronExpr: data.cronExpr,
        timezone: data.timezone,
        scope: data.scope,
        filters: data.filters || '{}',
        recipients: data.recipients,
        format: data.format,
        isActive: data.isActive,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'scheduled_report.updated',
        entityType: 'SCHEDULED_REPORT',
        entityId: data.id,
        beforeData: JSON.stringify(before),
        afterData: JSON.stringify(data),
      },
    });

    revalidatePath('/admin/scheduled-reports');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteScheduledReportAction(
  input: { id: string },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const id = z.string().min(1).parse(input.id);
    const before = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Report not found' };

    await prisma.scheduledReport.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'scheduled_report.deleted',
        entityType: 'SCHEDULED_REPORT',
        entityId: id,
        beforeData: JSON.stringify(before),
      },
    });
    revalidatePath('/admin/scheduled-reports');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleScheduledReportAction(
  input: { id: string; isActive: boolean },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = z
      .object({ id: z.string().min(1), isActive: z.boolean() })
      .parse(input);
    await prisma.scheduledReport.update({
      where: { id: parsed.id },
      data: { isActive: parsed.isActive },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: parsed.isActive ? 'scheduled_report.activated' : 'scheduled_report.paused',
        entityType: 'SCHEDULED_REPORT',
        entityId: parsed.id,
      },
    });
    revalidatePath('/admin/scheduled-reports');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function runScheduledReportNowAction(
  input: { id: string },
): Promise<ActionResult<{ rows: number; delivered: number; failed: number }>> {
  try {
    await requireAdmin();
    const id = z.string().min(1).parse(input.id);
    const report = await prisma.scheduledReport.findUnique({ where: { id } });
    if (!report) return { ok: false, error: 'Report not found' };

    const result = await runScheduledReport({
      id: report.id,
      name: report.name,
      scope: report.scope,
      filters: report.filters,
      recipients: report.recipients,
      format: report.format,
    });

    if (!result.ok) {
      return { ok: false, error: result.error ?? 'Run failed' };
    }

    revalidatePath('/admin/scheduled-reports');
    return {
      ok: true,
      data: {
        rows: result.rowsSummarised,
        delivered: result.recipientsDelivered,
        failed: result.recipientsFailed,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
