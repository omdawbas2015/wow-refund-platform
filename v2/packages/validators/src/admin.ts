import { z } from 'zod';
import { nonEmptyString } from './common';

// ── Country ───────────────────────────────────────────────────────────────

export const updateCountrySchema = z.object({
  countryId: nonEmptyString,
  isActive: z.coerce.boolean().optional(),
  managerEmail: z.string().trim().email().optional().or(z.literal('')),
  cutoffTime: z
    .string()
    .regex(/^([01]?\d|2[0-3]):[0-5]\d$/, 'Use HH:mm')
    .optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpdateCountryInput = z.infer<typeof updateCountrySchema>;

// ── Brand ─────────────────────────────────────────────────────────────────

export const upsertBrandSchema = z.object({
  brandId: nonEmptyString.optional(),
  name: nonEmptyString.max(64),
  nameAr: z.string().trim().max(64).optional().or(z.literal('')),
  slug: nonEmptyString
    .max(64)
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Use lowercase letters, digits, and hyphens'),
  logoUrl: z.string().url().optional().or(z.literal('')),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpsertBrandInput = z.infer<typeof upsertBrandSchema>;

// ── Payment method ────────────────────────────────────────────────────────

export const upsertPaymentMethodSchema = z.object({
  paymentMethodId: nonEmptyString.optional(),
  key: nonEmptyString.max(64),
  label: nonEmptyString.max(64),
  labelAr: z.string().trim().max(64).optional().or(z.literal('')),
  iconSlug: z.string().trim().max(64).optional().or(z.literal('')),
  iconUrl: z.string().url().optional().or(z.literal('')),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use #rrggbb')
    .optional()
    .or(z.literal('')),
  requiresAuthCode: z.coerce.boolean().optional(),
  executionType: z.enum(['MANUAL', 'BATCH']).optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpsertPaymentMethodInput = z.infer<typeof upsertPaymentMethodSchema>;

// ── Root cause ────────────────────────────────────────────────────────────

export const upsertRootCauseSchema = z.object({
  rootCauseId: nonEmptyString.optional(),
  key: nonEmptyString.max(64),
  label: nonEmptyString.max(120),
  labelAr: z.string().trim().max(120).optional().or(z.literal('')),
  category: z.string().trim().max(64).optional().or(z.literal('')),
  requiresEvidence: z.coerce.boolean().optional(),
  isActive: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().min(0).optional(),
});
export type UpsertRootCauseInput = z.infer<typeof upsertRootCauseSchema>;

// ── Email template ────────────────────────────────────────────────────────

export const updateEmailTemplateSchema = z.object({
  templateId: nonEmptyString,
  subject: nonEmptyString.max(200),
  body: nonEmptyString.max(8000),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  isActive: z.coerce.boolean().optional(),
});
export type UpdateEmailTemplateInput = z.infer<typeof updateEmailTemplateSchema>;

export const createEmailTemplateSchema = z.object({
  key: nonEmptyString.max(64),
  category: nonEmptyString.max(32),
  locale: z.enum(['en', 'ar']),
  subject: nonEmptyString.max(200),
  body: nonEmptyString.max(8000),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});
export type CreateEmailTemplateInput = z.infer<typeof createEmailTemplateSchema>;

// ── Feature flags / settings ──────────────────────────────────────────────

export const toggleFeatureFlagSchema = z.object({
  key: nonEmptyString.max(96),
  enabled: z.coerce.boolean(),
});
export type ToggleFeatureFlagInput = z.infer<typeof toggleFeatureFlagSchema>;

export const upsertSettingSchema = z.object({
  key: nonEmptyString
    .max(96)
    .regex(/^[a-z0-9._-]+$/, 'lowercase letters, digits, dot/underscore/dash only'),
  value: z.string().max(8000),
  description: z.string().trim().max(500).optional().or(z.literal('')),
});
export type UpsertSettingInput = z.infer<typeof upsertSettingSchema>;

export const deleteSettingSchema = z.object({
  key: nonEmptyString.max(96),
});
export type DeleteSettingInput = z.infer<typeof deleteSettingSchema>;

// ── SLA rules ─────────────────────────────────────────────────────────────

export const upsertSlaRuleSchema = z
  .object({
    id: nonEmptyString.optional(),
    name: nonEmptyString.max(96),
    countryId: z.string().trim().optional().or(z.literal('')),
    brandId: z.string().trim().optional().or(z.literal('')),
    rootCauseId: z.string().trim().optional().or(z.literal('')),
    thresholdHours: z.coerce.number().int().min(1).max(24 * 365),
    warningHours: z.coerce.number().int().min(0).max(24 * 365).optional(),
    escalateToRole: z.string().trim().max(32).optional().or(z.literal('')),
    isActive: z.coerce.boolean().optional(),
  })
  .refine(
    (v) => v.warningHours === undefined || v.warningHours < v.thresholdHours,
    { message: 'warningHours must be less than thresholdHours', path: ['warningHours'] },
  );
export type UpsertSlaRuleInput = z.infer<typeof upsertSlaRuleSchema>;

export const deleteSlaRuleSchema = z.object({
  id: nonEmptyString,
});
export type DeleteSlaRuleInput = z.infer<typeof deleteSlaRuleSchema>;

export const toggleSlaRuleActiveSchema = z.object({
  id: nonEmptyString,
  isActive: z.coerce.boolean(),
});
export type ToggleSlaRuleActiveInput = z.infer<typeof toggleSlaRuleActiveSchema>;
