import pg from 'pg';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from '../config.js';

const { Pool } = pg;

/**
 * PrismaService wrapper for database operations
 * Uses Prisma 7 with PostgreSQL adapter
 */
export class PrismaService {
  private prismaClient: any;
  private pool: pg.Pool | null = null;

  constructor() {
    const connectionString = config.databaseUrl;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
  }

  /**
   * Initialize Prisma client with connection pool
   */
  async init() {
    try {
      // Create PostgreSQL connection pool
      const connectionString = config.databaseUrl;
      this.pool = new Pool({ connectionString });

      // Create adapter
      const adapter = new PrismaPg(this.pool);

      // Initialize Prisma client with adapter
      this.prismaClient = new PrismaClient({ adapter });

      console.log('Prisma client initialized');
    } catch (error) {
      console.error('Failed to initialize Prisma client:', error);
      throw error;
    }
  }

  /**
   * Get Prisma client instance
   */
  get prisma() {
    if (!this.prismaClient) {
      throw new Error('Prisma client not initialized. Call init() first.');
    }
    return this.prismaClient;
  }

  /**
   * Access to generated models (e.g., reviewTask, progress)
   */
  get reviewTask() {
    return this.prisma.reviewTask;
  }

  get progress() {
    return this.prisma.progress;
  }

  get article() {
    return this.prisma.article;
  }

  /**
   * Execute raw SQL query
   */
  $queryRaw(query: TemplateStringsArray, ...values: any[]): any {
    return this.prisma.$queryRaw(query, ...values);
  }

  /**
   * Execute raw SQL query (unsafe)
   */
  $executeRawUnsafe(query: string, ...values: any[]): Promise<number> {
    return this.prisma.$executeRawUnsafe(query, ...values);
  }

  /**
   * Disconnect and cleanup
   */
  async destroy() {
    try {
      if (this.prismaClient) {
        await this.prismaClient.$disconnect();
        this.prismaClient = null;
      }
      if (this.pool) {
        await this.pool.end();
        this.pool = null;
      }
      console.log('Prisma client disconnected');
    } catch (error) {
      console.error('Error disconnecting Prisma:', error);
      throw error;
    }
  }

  /**
   * Execute transaction
   */
  async transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(callback);
  }
}
