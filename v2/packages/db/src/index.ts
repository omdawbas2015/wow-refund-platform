import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Singleton Prisma client.
 * In development, hot-reload creates many clients → leak warnings.
 * Cache on globalThis to avoid this.
 */

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

const createClient = () =>
  new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

export const prisma: PrismaClient = global.__prisma ?? createClient();

if (process.env['NODE_ENV'] !== 'production') {
  global.__prisma = prisma;
}

export { Prisma };
export * from '@prisma/client';
export * as seedData from './seed-data';
