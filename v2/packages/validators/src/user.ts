import { z } from 'zod';
import { emailSchema, nonEmptyString } from './common';

export const approveUserSchema = z.object({
  userId: nonEmptyString,
  roleId: nonEmptyString,
  primaryCountryId: z.string().optional().nullable(),
});
export type ApproveUserInput = z.infer<typeof approveUserSchema>;

export const rejectUserSchema = z.object({
  userId: nonEmptyString,
  reason: nonEmptyString.max(500),
});
export type RejectUserInput = z.infer<typeof rejectUserSchema>;

export const updateUserProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  nameAr: z.string().trim().max(120).optional(),
  phone: z.string().trim().optional(),
  preferredLocale: z.enum(['en', 'ar']).optional(),
  preferredCurrency: z.string().optional(),
  preferredTheme: z.enum(['light', 'dark', 'system']).optional(),
});

export const inviteUserSchema = z.object({
  email: emailSchema,
  name: nonEmptyString,
  roleId: nonEmptyString,
  primaryCountryId: z.string().optional().nullable(),
});
