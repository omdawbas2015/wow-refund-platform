'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

const jsonObject = z.string().refine(
  (val) => {
    if (!val.trim()) return false;
    try {
      const parsed = JSON.parse(val);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  },
  'Must be valid JSON',
);

const baseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  scope: z.enum(['CASE', 'PROMO', 'BATCH']),
  conditions: jsonObject,
  actions: jsonObject,
  priority: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({ id: z.string().min(1) });

export async function createAutomationRuleAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = createSchema.parse(input);
    const created = await prisma.automationRule.create({
      data: {
        name: data.name,
        description: data.description || null,
        scope: data.scope,
        conditions: data.conditions,
        actions: data.actions,
        priority: data.priority,
        isActive: data.isActive,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'automation_rule.created',
        entityType: 'AUTOMATION_RULE',
        entityId: created.id,
        metadata: JSON.stringify({ name: data.name, scope: data.scope }),
      },
    });
    revalidatePath('/admin/automation-rules');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateAutomationRuleAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = updateSchema.parse(input);
    const before = await prisma.automationRule.findUnique({ where: { id: data.id } });
    if (!before) return { ok: false, error: 'Rule not found' };
    await prisma.automationRule.update({
      where: { id: data.id },
      data: {
        name: data.name,
        description: data.description || null,
        scope: data.scope,
        conditions: data.conditions,
        actions: data.actions,
        priority: data.priority,
        isActive: data.isActive,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'automation_rule.updated',
        entityType: 'AUTOMATION_RULE',
        entityId: data.id,
        beforeData: JSON.stringify(before),
        afterData: JSON.stringify(data),
      },
    });
    revalidatePath('/admin/automation-rules');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleAutomationRuleAction(
  input: { id: string; isActive: boolean },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const { id, isActive } = z
      .object({ id: z.string().min(1), isActive: z.boolean() })
      .parse(input);
    await prisma.automationRule.update({ where: { id }, data: { isActive } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: isActive ? 'automation_rule.activated' : 'automation_rule.paused',
        entityType: 'AUTOMATION_RULE',
        entityId: id,
      },
    });
    revalidatePath('/admin/automation-rules');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteAutomationRuleAction(
  input: { id: string },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const id = z.string().min(1).parse(input.id);
    const before = await prisma.automationRule.findUnique({ where: { id } });
    if (!before) return { ok: false, error: 'Rule not found' };
    await prisma.automationRule.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'automation_rule.deleted',
        entityType: 'AUTOMATION_RULE',
        entityId: id,
        beforeData: JSON.stringify(before),
      },
    });
    revalidatePath('/admin/automation-rules');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
