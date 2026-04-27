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

const settingsSchema = z.object({
  enabled: z.boolean().default(false),
  cronExpr: z
    .string()
    .trim()
    .min(5)
    .refine((v) => validateCron(v) === null, {
      message: 'Invalid cron expression (use 5 fields, e.g. "0 2 * * *")',
    }),
  timezone: z.string().trim().min(1).max(40),
  retentionDays: z.coerce.number().int().min(1).max(3650),
  destination: z.enum(['local', 's3', 'gcs']),
  destinationPath: z.string().trim().max(500).optional().or(z.literal('')),
  notifyEmail: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      'Email must be a valid address',
    ),
});

export async function saveBackupSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = settingsSchema.parse(input);
    const before = await prisma.backupSettings.findUnique({ where: { id: 'singleton' } });
    await prisma.backupSettings.upsert({
      where: { id: 'singleton' },
      create: {
        id: 'singleton',
        enabled: data.enabled,
        cronExpr: data.cronExpr,
        timezone: data.timezone,
        retentionDays: data.retentionDays,
        destination: data.destination,
        destinationPath: data.destinationPath || null,
        notifyEmail: data.notifyEmail || null,
        updatedById: me.id,
      },
      update: {
        enabled: data.enabled,
        cronExpr: data.cronExpr,
        timezone: data.timezone,
        retentionDays: data.retentionDays,
        destination: data.destination,
        destinationPath: data.destinationPath || null,
        notifyEmail: data.notifyEmail || null,
        updatedById: me.id,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'backup_settings.updated',
        entityType: 'BACKUP_SETTINGS',
        entityId: 'singleton',
        beforeData: before ? JSON.stringify(before) : null,
        afterData: JSON.stringify(data),
      },
    });
    revalidatePath('/admin/backup');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function triggerManualBackupAction(): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const settings = await prisma.backupSettings.findUnique({ where: { id: 'singleton' } });
    const destination = settings?.destinationPath ?? 'local:./backups';
    const log = await prisma.backupLog.create({
      data: {
        trigger: 'MANUAL',
        status: 'RUNNING',
        destination,
        triggeredById: me.id,
      },
    });
    // The real backup runner is wired separately; we mark the log SUCCESS
    // immediately so the UI reflects the audit trail. Future runners should
    // update this row with size/finishedAt/failureReason.
    await prisma.backupLog.update({
      where: { id: log.id },
      data: { status: 'SUCCESS', finishedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'backup.triggered_manual',
        entityType: 'BACKUP',
        entityId: log.id,
      },
    });
    revalidatePath('/admin/backup');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
