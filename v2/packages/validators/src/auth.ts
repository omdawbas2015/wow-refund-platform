import { z } from 'zod';
import { emailSchema, otpCodeSchema, passwordSchema, nonEmptyString } from './common';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const signupSchema = z.object({
  name: nonEmptyString.max(120),
  email: emailSchema,
  phone: z.string().trim().optional().or(z.literal('')),
  preferredLocale: z.enum(['en', 'ar']).default('en'),
});
export type SignupInput = z.infer<typeof signupSchema>;

export const forgotPasswordRequestSchema = z.object({
  email: emailSchema,
});
export type ForgotPasswordRequestInput = z.infer<typeof forgotPasswordRequestSchema>;

export const forgotPasswordVerifySchema = z.object({
  email: emailSchema,
  code: otpCodeSchema,
  newPassword: passwordSchema,
});
export type ForgotPasswordVerifyInput = z.infer<typeof forgotPasswordVerifySchema>;

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
export type SetPasswordInput = z.infer<typeof setPasswordSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });
