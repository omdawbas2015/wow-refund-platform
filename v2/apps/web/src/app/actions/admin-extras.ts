'use server';

import { prisma } from '@wow/db';
import { revalidatePath } from 'next/cache';
import { auth } from '@/auth';

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

export async function toggleCountryActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const registryCode = String(formData.get('registryCode') ?? '');
  const activate = String(formData.get('activate') ?? 'true') === 'true';

  if (!registryCode) return;

  const existing = await prisma.country.findUnique({ where: { registryCode } });

  if (existing) {
    await prisma.country.update({ where: { id: existing.id }, data: { isActive: activate } });
  } else if (activate) {
    await prisma.country.create({ data: { registryCode, isActive: true } });
  }

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: activate ? 'country.activated' : 'country.deactivated',
      entityType: 'COUNTRY',
      entityId: registryCode,
    },
  });

  revalidatePath('/admin/countries');
}

export async function toggleBrandActiveAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const brandId = String(formData.get('brandId') ?? '');
  const activate = String(formData.get('activate') ?? 'true') === 'true';

  if (!brandId) return;

  await prisma.brand.update({ where: { id: brandId }, data: { isActive: activate } });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: activate ? 'brand.activated' : 'brand.deactivated',
      entityType: 'BRAND',
      entityId: brandId,
    },
  });

  revalidatePath('/admin/brands');
}

export async function upsertSettingAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const key = String(formData.get('key') ?? '').trim();
  const value = String(formData.get('value') ?? '').trim();
  if (!key) return;

  const existing = await prisma.setting.findUnique({ where: { key } });
  const before = existing?.value ?? null;

  await prisma.setting.upsert({
    where: { key },
    create: { key, value, updatedBy: admin.id },
    update: { value, updatedBy: admin.id },
  });

  await prisma.auditLog.create({
    data: {
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'setting.updated',
      entityType: 'SETTING',
      entityId: key,
      beforeData: before === null ? null : JSON.stringify({ value: before }),
      afterData: JSON.stringify({ value }),
    },
  });

  revalidatePath('/admin/settings');
}
