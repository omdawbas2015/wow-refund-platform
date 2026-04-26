import { z } from 'zod';
import { nonEmptyString, emailSchema } from './common';

export const createPromoConfigSchema = z.object({
  brandId: nonEmptyString,
  countryId: nonEmptyString,
  type: z.enum(['CUSTOMER_COMPENSATION', 'SERVICE_RECOVERY']),
  value: z.coerce.number().min(0),
  currency: nonEmptyString.max(8),
  label: z.string().trim().max(120).optional().or(z.literal('')),
});
export type CreatePromoConfigInput = z.infer<typeof createPromoConfigSchema>;

export const togglePromoConfigSchema = z.object({
  configId: nonEmptyString,
  isActive: z.coerce.boolean(),
});
export type TogglePromoConfigInput = z.infer<typeof togglePromoConfigSchema>;

export const uploadPromoCodesSchema = z.object({
  configId: nonEmptyString,
  /**
   * Free-text input — one code per line; comma- and whitespace-tolerant.
   * Server-side normalizer parses this into an array.
   */
  codesRaw: nonEmptyString.max(64_000),
  expiresAt: z.coerce.date().optional(),
});
export type UploadPromoCodesInput = z.infer<typeof uploadPromoCodesSchema>;

export const allocatePromoSchema = z.object({
  configId: nonEmptyString,
  customerEmail: emailSchema,
  customerName: z.string().trim().max(120).optional().or(z.literal('')),
  caseId: nonEmptyString.optional(),
  reason: z.string().trim().max(500).optional().or(z.literal('')),
});
export type AllocatePromoInput = z.infer<typeof allocatePromoSchema>;

export const markPromoUsedSchema = z.object({
  allocationId: nonEmptyString,
});
export type MarkPromoUsedInput = z.infer<typeof markPromoUsedSchema>;
