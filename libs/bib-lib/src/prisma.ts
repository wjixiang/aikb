/**
 * Prisma Client export for external packages
 *
 * This exports the PrismaClient for use in Next.js apps
 * that share the same database schema.
 */

import { PrismaClient } from './generated/prisma/client';

// PrismaClient singleton for development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process['env']['NODE_ENV'] === 'development' ? ['query', 'error', 'warn'] : ['error'],
  } as any);

if (process['env']['NODE_ENV'] !== 'production') globalForPrisma.prisma = prisma;

export { PrismaClient };
export type * from './generated/prisma/client';
