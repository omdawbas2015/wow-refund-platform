'use server';

import { prisma } from '@wow/db';
import {
  approveUserSchema,
  rejectUserSchema,
  updateCountrySchema,
  upsertBrandSchema,
  upsertPaymentMethodSchema,
  upsertRootCauseSchema,
  updateEmailTemplateSchema,
  createEmailTemplateSchema,
  toggleFeatureFlagSchema,
  upsertSettingSchema,
  deleteSettingSchema,
  upsertSlaRuleSchema,
  deleteSlaRuleSchema,
  toggleSlaRuleActiveSchema,
  type UpdateCountryInput,
  type UpsertBrandInput,
  type UpsertPaymentMethodInput,
  type UpsertRootCauseInput,
  type UpdateEmailTemplateInput,
  type CreateEmailTemplateInput,
  type ToggleFeatureFlagInput,
  type UpsertSettingInput,
  type DeleteSettingInput,
  type UpsertSlaRuleInput,
  type DeleteSlaRuleInput,
  type ToggleSlaRuleActiveInput,
} from '@wow/validators';
import { auth } from '@/auth';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { revalidatePath } from 'next/cache';

// ── Pending signup approvals ─────────────────────────────────────────────

export async function approveUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = approveUserSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const { userId, roleId, primaryCountryId } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: 'User not found' };
    if (user.status !== 'PENDING') return { ok: false, error: 'User is not pending' };

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ACTIVE',
        roleId,
        primaryCountryId: primaryCountryId ?? null,
        approvedById: admin.id,
        approvedAt: new Date(),
        mustChangePassword: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'user.approved',
        entityType: 'USER',
        entityId: userId,
        afterData: JSON.stringify({ status: 'ACTIVE', roleId, primaryCountryId }),
      },
    });

    await dispatchEmail({
      templateKey: 'AUTH_SIGNUP_APPROVED',
      locale: user.preferredLocale as 'en' | 'ar',
      to: user.email,
      variables: {
        name: user.name,
        loginUrl: `${process.env['AUTH_URL'] ?? 'http://localhost:3000'}/forgot-password?email=${encodeURIComponent(user.email)}`,
      },
      context: { type: 'AUTH', id: user.id },
    });

    revalidatePath('/admin/pending-approvals');
    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

export async function suspendUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const userId = String(formData.get('userId') ?? '');
    if (!userId) return { ok: false, error: 'Missing userId' };
    if (userId === admin.id) {
      return { ok: false, error: 'You cannot suspend your own account' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!user) return { ok: false, error: 'User not found' };
    if (user.deletedAt) return { ok: false, error: 'User is archived' };
    if (user.status !== 'ACTIVE') {
      return { ok: false, error: `Only ACTIVE users can be suspended (currently ${user.status})` };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'SUSPENDED' },
    });
    await audit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'user.suspended',
      entityType: 'USER',
      entityId: userId,
      before: { status: 'ACTIVE' },
      after: { status: 'SUSPENDED' },
    });

    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function reactivateUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const userId = String(formData.get('userId') ?? '');
    if (!userId) return { ok: false, error: 'Missing userId' };

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true, deletedAt: true },
    });
    if (!user) return { ok: false, error: 'User not found' };
    if (user.deletedAt) return { ok: false, error: 'User is archived; cannot reactivate' };
    if (user.status !== 'SUSPENDED') {
      return { ok: false, error: `Only SUSPENDED users can be reactivated (currently ${user.status})` };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { status: 'ACTIVE' },
    });
    await audit({
      actorId: admin.id,
      actorEmail: admin.email,
      action: 'user.reactivated',
      entityType: 'USER',
      entityId: userId,
      before: { status: 'SUSPENDED' },
      after: { status: 'ACTIVE' },
    });

    revalidatePath('/admin/users');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function rejectUserAction(formData: FormData): Promise<ActionResult> {
  try {
    const admin = await requireAdmin();
    const raw = Object.fromEntries(formData.entries());
    const parsed = rejectUserSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };

    const { userId, reason } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return { ok: false, error: 'User not found' };

    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'ARCHIVED',
        rejectedReason: reason,
        deletedAt: new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorId: admin.id,
        actorEmail: admin.email,
        action: 'user.rejected',
        entityType: 'USER',
        entityId: userId,
        afterData: JSON.stringify({ reason }),
      },
    });

    revalidatePath('/admin/pending-approvals');
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  }
}

type ActionResult<T = void> =
  | (T extends void ? { ok: true } : { ok: true; data: T })
  | { ok: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user) throw new Error('UNAUTHENTICATED');
  if (session.user.role !== 'ADMIN') throw new Error('FORBIDDEN');
  return session.user;
}

async function audit(args: {
  actorId: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
}) {
  await prisma.auditLog.create({
    data: {
      actorId: args.actorId,
      actorEmail: args.actorEmail,
      action: args.action,
      entityType: args.entityType,
      entityId: args.entityId,
      ...(args.before !== undefined ? { beforeData: JSON.stringify(args.before) } : {}),
      ...(args.after !== undefined ? { afterData: JSON.stringify(args.after) } : {}),
    },
  });
}

// ── Countries ─────────────────────────────────────────────────────────────

export async function updateCountryAction(
  input: UpdateCountryInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = updateCountrySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { countryId, ...rest } = parsed.data;
    const before = await prisma.country.findUnique({ where: { id: countryId } });
    if (!before) return { ok: false, error: 'Country not found' };

    const data: Record<string, unknown> = {};
    if (rest.isActive !== undefined) data['isActive'] = rest.isActive;
    if (rest.managerEmail !== undefined) data['managerEmail'] = rest.managerEmail || null;
    if (rest.cutoffTime !== undefined) data['cutoffTime'] = rest.cutoffTime;
    if (rest.sortOrder !== undefined) data['sortOrder'] = rest.sortOrder;

    const updated = await prisma.country.update({ where: { id: countryId }, data });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.country.updated',
      entityType: 'COUNTRY',
      entityId: countryId,
      before,
      after: updated,
    });
    revalidatePath('/admin/countries');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Brands ────────────────────────────────────────────────────────────────

export async function upsertBrandAction(input: UpsertBrandInput): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const parsed = upsertBrandSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { brandId, name, nameAr, slug, logoUrl, isActive, sortOrder } = parsed.data;

    const data = {
      name,
      nameAr: nameAr || null,
      slug,
      logoUrl: logoUrl || null,
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };

    if (brandId) {
      const before = await prisma.brand.findUnique({ where: { id: brandId } });
      if (!before) return { ok: false, error: 'Brand not found' };
      const updated = await prisma.brand.update({ where: { id: brandId }, data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.brand.updated',
        entityType: 'BRAND',
        entityId: brandId,
        before,
        after: updated,
      });
      revalidatePath('/admin/brands');
      return { ok: true, data: { id: updated.id } };
    } else {
      const dupName = await prisma.brand.findUnique({ where: { name } });
      if (dupName) return { ok: false, error: 'A brand with this name already exists' };
      const dupSlug = await prisma.brand.findUnique({ where: { slug } });
      if (dupSlug) return { ok: false, error: 'A brand with this slug already exists' };
      const created = await prisma.brand.create({ data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.brand.created',
        entityType: 'BRAND',
        entityId: created.id,
        after: created,
      });
      revalidatePath('/admin/brands');
      return { ok: true, data: { id: created.id } };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Payment methods ───────────────────────────────────────────────────────

export async function upsertPaymentMethodAction(
  input: UpsertPaymentMethodInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const parsed = upsertPaymentMethodSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const {
      paymentMethodId,
      key,
      label,
      labelAr,
      iconSlug,
      iconUrl,
      color,
      requiresAuthCode,
      executionType,
      isActive,
      sortOrder,
    } = parsed.data;

    const data = {
      key,
      label,
      labelAr: labelAr || null,
      iconSlug: iconSlug || null,
      iconUrl: iconUrl || null,
      color: color || null,
      ...(requiresAuthCode !== undefined ? { requiresAuthCode } : {}),
      ...(executionType !== undefined ? { executionType } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };

    if (paymentMethodId) {
      const before = await prisma.paymentMethod.findUnique({ where: { id: paymentMethodId } });
      if (!before) return { ok: false, error: 'Payment method not found' };
      const updated = await prisma.paymentMethod.update({ where: { id: paymentMethodId }, data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.payment_method.updated',
        entityType: 'PAYMENT_METHOD',
        entityId: paymentMethodId,
        before,
        after: updated,
      });
      revalidatePath('/admin/payment-methods');
      return { ok: true, data: { id: updated.id } };
    } else {
      const dup = await prisma.paymentMethod.findUnique({ where: { key } });
      if (dup) return { ok: false, error: 'A payment method with this key already exists' };
      const created = await prisma.paymentMethod.create({ data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.payment_method.created',
        entityType: 'PAYMENT_METHOD',
        entityId: created.id,
        after: created,
      });
      revalidatePath('/admin/payment-methods');
      return { ok: true, data: { id: created.id } };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Root causes ──────────────────────────────────────────────────────────

export async function upsertRootCauseAction(
  input: UpsertRootCauseInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const parsed = upsertRootCauseSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { rootCauseId, key, label, labelAr, category, requiresEvidence, isActive, sortOrder } =
      parsed.data;

    const data = {
      key,
      label,
      labelAr: labelAr || null,
      category: category || null,
      ...(requiresEvidence !== undefined ? { requiresEvidence } : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(sortOrder !== undefined ? { sortOrder } : {}),
    };

    if (rootCauseId) {
      const before = await prisma.rootCause.findUnique({ where: { id: rootCauseId } });
      if (!before) return { ok: false, error: 'Root cause not found' };
      const updated = await prisma.rootCause.update({ where: { id: rootCauseId }, data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.root_cause.updated',
        entityType: 'ROOT_CAUSE',
        entityId: rootCauseId,
        before,
        after: updated,
      });
      revalidatePath('/admin/root-causes');
      return { ok: true, data: { id: updated.id } };
    } else {
      const dup = await prisma.rootCause.findUnique({ where: { key } });
      if (dup) return { ok: false, error: 'A root cause with this key already exists' };
      const created = await prisma.rootCause.create({ data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.root_cause.created',
        entityType: 'ROOT_CAUSE',
        entityId: created.id,
        after: created,
      });
      revalidatePath('/admin/root-causes');
      return { ok: true, data: { id: created.id } };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Email templates ──────────────────────────────────────────────────────

export async function updateEmailTemplateAction(
  input: UpdateEmailTemplateInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = updateEmailTemplateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { templateId, subject, body, description, isActive } = parsed.data;
    const before = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
    if (!before) return { ok: false, error: 'Template not found' };
    const updated = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        subject,
        body,
        description: description || null,
        ...(isActive !== undefined ? { isActive } : {}),
      },
    });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.email_template.updated',
      entityType: 'EMAIL_TEMPLATE',
      entityId: templateId,
      before,
      after: updated,
    });
    revalidatePath('/admin/email-templates');
    revalidatePath(`/admin/email-templates/${templateId}`);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function createEmailTemplateAction(
  input: CreateEmailTemplateInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const parsed = createEmailTemplateSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    const { key, category, locale, subject, body, description } = parsed.data;
    const dup = await prisma.emailTemplate.findUnique({
      where: { key_locale: { key, locale } },
    });
    if (dup) return { ok: false, error: `Template ${key} (${locale}) already exists` };

    const created = await prisma.emailTemplate.create({
      data: { key, category, locale, subject, body, description: description || null },
    });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.email_template.created',
      entityType: 'EMAIL_TEMPLATE',
      entityId: created.id,
      after: created,
    });
    revalidatePath('/admin/email-templates');
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Feature flags ─────────────────────────────────────────────────────────

export async function toggleFeatureFlagAction(
  input: ToggleFeatureFlagInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = toggleFeatureFlagSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const { key, enabled } = parsed.data;

    const existing = await prisma.featureFlag.findUnique({ where: { key } });
    if (!existing) return { ok: false, error: 'Unknown feature flag' };
    if (existing.enabled === enabled) return { ok: true };

    const updated = await prisma.featureFlag.update({
      where: { key },
      data: { enabled },
    });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: enabled ? 'admin.feature_flag.enabled' : 'admin.feature_flag.disabled',
      entityType: 'FEATURE_FLAG',
      entityId: key,
      before: { enabled: existing.enabled },
      after: { enabled: updated.enabled },
    });
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── System settings ───────────────────────────────────────────────────────

export async function upsertSettingAction(
  input: UpsertSettingInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = upsertSettingSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const { key, value, description } = parsed.data;

    const before = await prisma.setting.findUnique({ where: { key } });
    const data = {
      value,
      description: description || null,
      updatedBy: me.id,
    };
    const after = await prisma.setting.upsert({
      where: { key },
      create: { key, ...data },
      update: data,
    });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: before ? 'admin.setting.updated' : 'admin.setting.created',
      entityType: 'SETTING',
      entityId: key,
      ...(before ? { before } : {}),
      after,
    });
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteSettingAction(
  input: DeleteSettingInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = deleteSettingSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const { key } = parsed.data;

    const existing = await prisma.setting.findUnique({ where: { key } });
    if (!existing) return { ok: false, error: 'Setting not found' };

    await prisma.setting.delete({ where: { key } });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.setting.deleted',
      entityType: 'SETTING',
      entityId: key,
      before: existing,
    });
    revalidatePath('/admin/settings');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── SLA rules ─────────────────────────────────────────────────────────────

export async function upsertSlaRuleAction(
  input: UpsertSlaRuleInput,
): Promise<ActionResult<{ id: string }>> {
  try {
    const me = await requireAdmin();
    const parsed = upsertSlaRuleSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' };
    }
    const v = parsed.data;
    const data = {
      name: v.name,
      countryId: v.countryId || null,
      brandId: v.brandId || null,
      rootCauseId: v.rootCauseId || null,
      thresholdHours: v.thresholdHours,
      warningHours: v.warningHours ?? null,
      escalateToRole: v.escalateToRole || null,
      isActive: v.isActive ?? true,
    };

    if (v.id) {
      const before = await prisma.slaRule.findUnique({ where: { id: v.id } });
      if (!before) return { ok: false, error: 'SLA rule not found' };
      const after = await prisma.slaRule.update({ where: { id: v.id }, data });
      await audit({
        actorId: me.id,
        actorEmail: me.email,
        action: 'admin.sla_rule.updated',
        entityType: 'SLA_RULE',
        entityId: v.id,
        before,
        after,
      });
      revalidatePath('/admin/sla-rules');
      return { ok: true, data: { id: v.id } };
    }

    const created = await prisma.slaRule.create({ data });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.sla_rule.created',
      entityType: 'SLA_RULE',
      entityId: created.id,
      after: created,
    });
    revalidatePath('/admin/sla-rules');
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function deleteSlaRuleAction(
  input: DeleteSlaRuleInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = deleteSlaRuleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const existing = await prisma.slaRule.findUnique({ where: { id: parsed.data.id } });
    if (!existing) return { ok: false, error: 'SLA rule not found' };
    await prisma.slaRule.delete({ where: { id: parsed.data.id } });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: 'admin.sla_rule.deleted',
      entityType: 'SLA_RULE',
      entityId: parsed.data.id,
      before: existing,
    });
    revalidatePath('/admin/sla-rules');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function toggleSlaRuleActiveAction(
  input: ToggleSlaRuleActiveInput,
): Promise<ActionResult> {
  try {
    const me = await requireAdmin();
    const parsed = toggleSlaRuleActiveSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: 'Invalid input' };
    const before = await prisma.slaRule.findUnique({ where: { id: parsed.data.id } });
    if (!before) return { ok: false, error: 'SLA rule not found' };
    if (before.isActive === parsed.data.isActive) return { ok: true };
    const after = await prisma.slaRule.update({
      where: { id: parsed.data.id },
      data: { isActive: parsed.data.isActive },
    });
    await audit({
      actorId: me.id,
      actorEmail: me.email,
      action: parsed.data.isActive ? 'admin.sla_rule.activated' : 'admin.sla_rule.deactivated',
      entityType: 'SLA_RULE',
      entityId: parsed.data.id,
      before: { isActive: before.isActive },
      after: { isActive: after.isActive },
    });
    revalidatePath('/admin/sla-rules');
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
