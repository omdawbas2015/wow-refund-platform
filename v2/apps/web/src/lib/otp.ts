import { prisma } from '@wow/db';
import bcrypt from 'bcryptjs';
import { generateOtpCode } from './password';
import { dispatchEmail } from './email/dispatcher';

const OTP_TTL_MINUTES = Number(process.env['OTP_TTL_MINUTES'] ?? 15);
const MAX_ATTEMPTS = 5;

/**
 * Creates a new OTP for the given user and emails it via Power Automate.
 * Invalidates any previous OTPs for the same purpose.
 */
export async function issueOtp(params: {
  userId: string;
  email: string;
  userName: string;
  purpose?: 'PASSWORD_RESET' | 'EMAIL_VERIFY' | '2FA';
  locale?: 'en' | 'ar';
}): Promise<{ tokenId: string }> {
  const purpose = params.purpose ?? 'PASSWORD_RESET';

  // Invalidate existing unconsumed OTPs of this purpose
  await prisma.otpToken.updateMany({
    where: { userId: params.userId, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = generateOtpCode(6);
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  const token = await prisma.otpToken.create({
    data: {
      userId: params.userId,
      codeHash,
      purpose,
      expiresAt,
    },
  });

  // Send the code via Power Automate
  await dispatchEmail({
    templateKey: 'AUTH_OTP_PASSWORD_RESET',
    locale: params.locale ?? 'en',
    to: params.email,
    variables: {
      name: params.userName,
      code,
      ttl: OTP_TTL_MINUTES,
    },
    context: { type: 'OTP', id: token.id },
  });

  return { tokenId: token.id };
}

export type OtpVerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NOT_FOUND' | 'EXPIRED' | 'INVALID' | 'TOO_MANY_ATTEMPTS' };

/**
 * Verifies a code for the given email. Returns the userId on success.
 * Consumes the token on success.
 */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: 'PASSWORD_RESET' | 'EMAIL_VERIFY' | '2FA' = 'PASSWORD_RESET',
): Promise<OtpVerifyResult> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: false, reason: 'NOT_FOUND' };

  const token = await prisma.otpToken.findFirst({
    where: { userId: user.id, purpose, consumedAt: null },
    orderBy: { createdAt: 'desc' },
  });

  if (!token) return { ok: false, reason: 'NOT_FOUND' };
  if (token.expiresAt < new Date()) return { ok: false, reason: 'EXPIRED' };
  if (token.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'TOO_MANY_ATTEMPTS' };

  const matches = await bcrypt.compare(code, token.codeHash);
  if (!matches) {
    await prisma.otpToken.update({
      where: { id: token.id },
      data: { attempts: { increment: 1 } },
    });
    return { ok: false, reason: 'INVALID' };
  }

  await prisma.otpToken.update({
    where: { id: token.id },
    data: { consumedAt: new Date() },
  });

  return { ok: true, userId: user.id };
}
