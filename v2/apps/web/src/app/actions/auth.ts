'use server';

import { prisma } from '@wow/db';
import {
  signupSchema,
  forgotPasswordRequestSchema,
  forgotPasswordVerifySchema,
  setPasswordSchema,
} from '@wow/validators';
import { hashPassword } from '@/lib/password';
import { issueOtp, verifyOtp } from '@/lib/otp';
import { dispatchEmail } from '@/lib/email/dispatcher';
import { auth, signIn } from '@/auth';
import { revalidatePath } from 'next/cache';

type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };

/**
 * Signup: creates a user in PENDING status and notifies admins.
 */
export async function signupAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = signupSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please check your input.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, name, phone, preferredLocale } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Don't leak registration state — return a generic success
    return { ok: true, message: 'If the email is available, a request has been submitted.' };
  }

  const user = await prisma.user.create({
    data: {
      email,
      name,
      phone: phone || null,
      preferredLocale: preferredLocale ?? 'en',
      status: 'PENDING',
    },
  });

  // Notify admins
  const admins = await prisma.user.findMany({
    where: { status: 'ACTIVE', role: { key: 'ADMIN' } },
    select: { email: true, preferredLocale: true },
  });

  for (const admin of admins) {
    await dispatchEmail({
      templateKey: 'AUTH_ADMIN_NEW_SIGNUP',
      locale: 'en',
      to: admin.email,
      variables: {
        name,
        email,
        submittedAt: new Date().toISOString(),
        approvalUrl: `${process.env['AUTH_URL'] ?? 'http://localhost:3000'}/admin/pending-approvals`,
      },
      context: { type: 'AUTH', id: user.id },
    });
  }

  return { ok: true, message: 'Request submitted. An administrator will review your account shortly.' };
}

/**
 * Forgot password step 1 — email a 6-digit OTP.
 */
export async function forgotPasswordRequestAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = forgotPasswordRequestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please enter a valid email.' };
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  // Always respond with success (do not leak account existence)
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
    return { ok: true, message: 'If an account exists, a code has been sent.' };
  }

  await issueOtp({
    userId: user.id,
    email: user.email,
    userName: user.name,
    purpose: 'PASSWORD_RESET',
    locale: user.preferredLocale as 'en' | 'ar',
  });

  return { ok: true, message: 'Code sent.' };
}

/**
 * Forgot password step 2 — verify OTP and set new password.
 */
export async function forgotPasswordVerifyAction(formData: FormData): Promise<ActionResult> {
  const raw = Object.fromEntries(formData.entries());
  const parsed = forgotPasswordVerifySchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please check your input.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, code, newPassword } = parsed.data;
  const result = await verifyOtp(email, code, 'PASSWORD_RESET');

  if (!result.ok) {
    return { ok: false, error: 'The code is invalid or expired.' };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: result.userId },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  return { ok: true, message: 'Password reset. You can now sign in.' };
}

/**
 * Set password (first-login for approved users).
 */
export async function setPasswordAction(formData: FormData): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user) return { ok: false, error: 'Not authenticated.' };

  const raw = Object.fromEntries(formData.entries());
  const parsed = setPasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: 'Please check your input.', fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const passwordHash = await hashPassword(parsed.data.password);
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      mustChangePassword: false,
    },
  });

  revalidatePath('/', 'layout');
  return { ok: true, message: 'Password set.' };
}

/**
 * Login action — wraps next-auth signIn for programmatic use.
 */
export async function loginAction(formData: FormData): Promise<ActionResult> {
  const email = String(formData.get('email') ?? '');
  const password = String(formData.get('password') ?? '');
  const callbackUrl = String(formData.get('callbackUrl') ?? '/');

  try {
    await signIn('credentials', { email, password, redirectTo: callbackUrl });
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // next-auth throws NEXT_REDIRECT when successful — re-throw to let Next handle it
    if (message.includes('NEXT_REDIRECT')) throw err;
    if (message.includes('ACCOUNT_PENDING')) return { ok: false, error: 'ACCOUNT_PENDING' };
    if (message.includes('ACCOUNT_SUSPENDED')) return { ok: false, error: 'ACCOUNT_SUSPENDED' };
    if (message.includes('ACCOUNT_LOCKED')) return { ok: false, error: 'ACCOUNT_LOCKED' };
    return { ok: false, error: 'INVALID_CREDENTIALS' };
  }
}
