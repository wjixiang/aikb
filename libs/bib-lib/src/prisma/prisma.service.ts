import { Injectable, type OnModuleInit, type OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

interface PrismaServiceOptions {
  datasources?: {
    db?: {
      url?: string;
    };
  };
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(options?: PrismaServiceOptions) {
    const connectionString = options?.datasources?.db?.url || process.env.BIB_DATABASE_URL;
    if (!connectionString) {
      throw new Error('BIB_DATABASE_URL environment variable is not set');
    }
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
