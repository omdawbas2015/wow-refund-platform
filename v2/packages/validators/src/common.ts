import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email({ message: 'Please enter a valid email address.' });

export const phoneSchema = z
  .string()
  .trim()
  .min(5)
  .max(20)
  .regex(/^\+?[0-9\s-]+$/, 'Please enter a valid phone number.');

export const nonEmptyString = z.string().trim().min(1, 'Required');

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const otpCodeSchema = z
  .string()
  .trim()
  .length(6, 'Code must be exactly 6 digits')
  .regex(/^[0-9]+$/, 'Code must be digits only');

export const localeSchema = z.enum(['en', 'ar']);
export type Locale = z.infer<typeof localeSchema>;

export const dateRangeSchema = z
  .object({
    from: z.date(),
    to: z.date(),
  })
  .refine((v) => v.from <= v.to, { message: 'From date must be before or equal to To date' });
