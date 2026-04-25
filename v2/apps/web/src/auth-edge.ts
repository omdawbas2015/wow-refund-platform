import NextAuth from 'next-auth';
import { authConfig } from './auth.config';

/**
 * Edge-compatible auth instance — no Prisma, no bcrypt.
 * Used by middleware to read the JWT cookie.
 */
export const { auth } = NextAuth(authConfig);
