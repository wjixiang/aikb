import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { Injectable } from '@nestjs/common';

const connectionString = `${process.env['WIKI_DATABASE_URL']}`;
const adapter = new PrismaPg({ connectionString });

@Injectable()
export class wikiPrismaService extends PrismaClient {
  constructor() {
    super({
      adapter,
      // Set default transaction timeout to 30 seconds for serverless database startup time
      transactionOptions: {
        timeout: 30000, // 30 seconds
        maxWait: 35000, // Slightly longer than timeout
      },
    });
  }
}

// Also export the prisma instance for backward compatibility
const prisma = new PrismaClient({
  adapter,
  // Set default transaction timeout to 30 seconds for serverless database startup time
  transactionOptions: {
    timeout: 30000, // 30 seconds
    maxWait: 35000, // Slightly longer than timeout
  },
});

export { prisma };
