/**
 * Prisma client singleton for library usage
 */

import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const connectionString = process.env.BIB_DATABASE_URL;
  if (!connectionString) {
    throw new Error('BIB_DATABASE_URL environment variable is not set');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);

  prismaInstance = new PrismaClient({ adapter });
  return prismaInstance;
}

// Export singleton instance
export const prisma = getPrisma();
