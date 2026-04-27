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

const baseSchema = z.object({
  countryId: z.string().min(1, 'Pick a country'),
  name: z.string().trim().min(2, 'Name is too short').max(120),
  nameAr: z.string().trim().max(120).optional().or(z.literal('')),
  code: z.string().trim().max(40).optional().or(z.literal('')),
  address: z.string().trim().max(400).optional().or(z.literal('')),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .or(z.literal(''))
    .refine(
      (v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v),
      'Email must be a valid address',
    ),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
});

const createSchema = baseSchema;
const updateSchema = baseSchema.extend({ id: z.string().min(1) });

export async function createBranchAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = createSchema.parse(input);
    const created = await prisma.branch.create({
      data: {
        countryId: data.countryId,
        name: data.name,
        nameAr: data.nameAr || null,
        code: data.code || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'branch.created',
        entityType: 'BRANCH',
        entityId: created.id,
        metadata: JSON.stringify({ name: data.name, countryId: data.countryId }),
      },
    });
    revalidatePath('/admin/branches');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function updateBranchAction(input: unknown): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const data = updateSchema.parse(input);
    const before = await prisma.branch.findUnique({ where: { id: data.id } });
    if (!before) return { ok: false, error: 'Branch not found' };
    await prisma.branch.update({
      where: { id: data.id },
      data: {
        countryId: data.countryId,
        name: data.name,
        nameAr: data.nameAr || null,
        code: data.code || null,
        address: data.address || null,
        phone: data.phone || null,
        email: data.email || null,
        isActive: data.isActive,
        sortOrder: data.sortOrder,
      },
    });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'branch.updated',
        entityType: 'BRANCH',
        entityId: data.id,
        beforeData: JSON.stringify(before),
        afterData: JSON.stringify(data),
      },
    });
    revalidatePath('/admin/branches');
    return { ok: true };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { ok: false, error: err.issues.map((i) => i.message).join('; ') };
    }
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleBranchActiveAction(input: { id: string; isActive: boolean }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const { id, isActive } = z
      .object({ id: z.string().min(1), isActive: z.boolean() })
      .parse(input);
    await prisma.branch.update({ where: { id }, data: { isActive } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: isActive ? 'branch.activated' : 'branch.deactivated',
        entityType: 'BRANCH',
        entityId: id,
      },
    });
    revalidatePath('/admin/branches');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteBranchAction(input: { id: string }): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const id = z.string().min(1).parse(input.id);
    const before = await prisma.branch.findUnique({
      where: { id },
      include: { _count: { select: { cases: true } } },
    });
    if (!before) return { ok: false, error: 'Branch not found' };
    if (before._count.cases > 0) {
      return {
        ok: false,
        error: `Cannot delete: ${before._count.cases} case${before._count.cases === 1 ? '' : 's'} reference this branch. Deactivate it instead.`,
      };
    }
    await prisma.branch.delete({ where: { id } });
    await prisma.auditLog.create({
      data: {
        actorId: me.id,
        actorEmail: me.email,
        action: 'branch.deleted',
        entityType: 'BRANCH',
        entityId: id,
        beforeData: JSON.stringify(before),
      },
    });
    revalidatePath('/admin/branches');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
