'use server';

import { prisma } from '@wow/db';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { MODULE_DEFINITIONS } from '@/lib/module-toggles';

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

export async function setModuleToggleAction(
  input: { key: string; isEnabled: boolean },
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const { key, isEnabled } = z
      .object({ key: z.string().min(1), isEnabled: z.boolean() })
      .parse(input);
    const def = MODULE_DEFINITIONS.find((d) => d.key === key);
    if (!def) return { ok: false, error: `Unknown module: ${key}` };

    await prisma.moduleToggle.upsert({
      where: { key },
      create: {
        key,
        label: def.label,
        description: def.description,
        isEnabled,
        updatedById: me.id,
      },
      update: {
        isEnabled,
        // Refresh label/description in case the definitions changed since
        // the row was created.
        label: def.label,
        description: def.description,
        updatedById: me.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: isEnabled ? 'module.enabled' : 'module.disabled',
        entityType: 'MODULE_TOGGLE',
        entityId: key,
      },
    });

    revalidatePath('/admin/modules');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
