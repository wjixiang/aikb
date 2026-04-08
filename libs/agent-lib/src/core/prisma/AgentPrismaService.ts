/**
 * Agent Prisma Service
 *
 * PrismaClient wrapper for agent-lib database access
 * Uses @prisma/adapter-pg with PostgreSQL
 */

import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

export class AgentPrismaService extends PrismaClient {
  constructor() {
    const connectionString = process.env['AGENT_DATABASE_URL'];
    if (!connectionString) {
      throw new Error('AGENT_DATABASE_URL environment variable is not set');
    }
    const pool = new Pool({ connectionString });
    // Type assertion needed: @prisma/adapter-pg bundles @types/pg@8.11.11
    // which conflicts with the newer @types/pg@8.20.0 used here
    const adapter = new PrismaPg(pool as never);
    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}