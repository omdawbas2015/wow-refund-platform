import type { NextAuthConfig, DefaultSession } from 'next-auth';

/**
 * Edge-compatible Auth.js config.
 * This is imported by the middleware (which runs on the Edge Runtime).
 * It must NOT import anything that pulls in Prisma, bcrypt, or Node-only APIs.
 *
 * The full config (with Prisma adapter + credentials provider) lives in `./auth.ts`.
 */

declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      email: string;
      name: string;
      role?: string | null;
      status: string;
      mustChangePassword: boolean;
      preferredLocale: string;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string | null;
    status: string;
    mustChangePassword: boolean;
    preferredLocale: string;
  }
}

export const authConfig: NextAuthConfig = {
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 }, // 8h
  trustHost: true,
  pages: {
    signIn: '/login',
    error: '/login',
  },
  providers: [], // populated in ./auth.ts
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? null;
        token.status = user.status;
        token.mustChangePassword = user.mustChangePassword;
        token.preferredLocale = user.preferredLocale;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = (token.id as string) ?? '';
        session.user.role = (token.role as string | null) ?? null;
        session.user.status = (token.status as string) ?? 'ACTIVE';
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
        session.user.preferredLocale = (token.preferredLocale as string) ?? 'en';
      }
      return session;
    },
  },
};
