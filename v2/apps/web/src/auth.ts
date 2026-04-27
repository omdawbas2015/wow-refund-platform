import NextAuth from 'next-auth';
import type { Adapter } from 'next-auth/adapters';
import Credentials from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@auth/prisma-adapter';
import { prisma } from '@wow/db';
import { loginSchema } from '@wow/validators';
import { verifyPassword } from './lib/password';
import { authConfig } from './auth.config';
import { consumeAuthLimit } from './lib/rate-limit';

const LOCKOUT_ATTEMPTS = Number(process.env['LOGIN_LOCKOUT_ATTEMPTS'] ?? 5);
const LOCKOUT_WINDOW_MIN = Number(process.env['LOGIN_LOCKOUT_WINDOW_MINUTES'] ?? 15);
const LOCKOUT_DURATION_MIN = Number(process.env['LOGIN_LOCKOUT_DURATION_MINUTES'] ?? 30);

/** Best-effort client IP. Next/Auth v5 passes a Request to `authorize`; the
 *  upstream proxies set x-forwarded-for. Fall back to a stable label so the
 *  limiter still throttles even when the IP is unknown. */
function ipFromRequest(req: unknown): string {
  if (req && typeof req === 'object' && 'headers' in req) {
    const headers = (req as { headers: Headers | Record<string, string> }).headers;
    const get =
      typeof (headers as Headers).get === 'function'
        ? (k: string) => (headers as Headers).get(k)
        : (k: string) => (headers as Record<string, string>)[k] ?? null;
    const xff = get('x-forwarded-for');
    if (xff) return xff.split(',')[0]!.trim();
    const real = get('x-real-ip');
    if (real) return real;
  }
  return 'unknown';
}

export const { auth, handlers, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma) as unknown as Adapter,
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(creds, req) {
        const parsed = loginSchema.safeParse(creds);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        // Rate limit by IP — 5 attempts per 5 minutes is below typical brute
        // force thresholds. The same scope/IP key is used across the auth
        // surface so an attacker cannot rotate between login/forgot/reset.
        const ip = ipFromRequest(req);
        const rl = await consumeAuthLimit('login', ip);
        if (!rl.allowed) {
          throw new Error('RATE_LIMITED');
        }

        const user = await prisma.user.findUnique({
          where: { email },
          include: { role: true },
        });
        if (!user) return null;

        // Account state checks
        if (user.deletedAt) return null;
        if (user.status === 'PENDING') {
          throw new Error('ACCOUNT_PENDING');
        }
        if (user.status === 'SUSPENDED' || user.status === 'ARCHIVED') {
          throw new Error('ACCOUNT_SUSPENDED');
        }
        if (user.lockedUntil && user.lockedUntil > new Date()) {
          throw new Error('ACCOUNT_LOCKED');
        }

        // Password check
        if (!user.passwordHash) {
          throw new Error('PASSWORD_NOT_SET');
        }

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) {
          const now = new Date();
          const windowStart = new Date(now.getTime() - LOCKOUT_WINDOW_MIN * 60 * 1000);
          const attempts =
            user.failedLoginAttempts + (user.lastLoginAt && user.lastLoginAt > windowStart ? 1 : 1);

          const update: { failedLoginAttempts: number; lockedUntil?: Date | null } = {
            failedLoginAttempts: attempts,
          };
          if (attempts >= LOCKOUT_ATTEMPTS) {
            update.lockedUntil = new Date(now.getTime() + LOCKOUT_DURATION_MIN * 60 * 1000);
          }
          await prisma.user.update({ where: { id: user.id }, data: update });
          return null;
        }

        // Reset counters on success
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: 0,
            lockedUntil: null,
            lastLoginAt: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role?.key ?? null,
          status: user.status,
          mustChangePassword: user.mustChangePassword,
          preferredLocale: user.preferredLocale,
        };
      },
    }),
  ],
});
