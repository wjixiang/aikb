import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

const connectionString = `${process.env['AUTH_DATABASE_URL']}`;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({
  adapter,
  // Set default transaction timeout to 30 seconds for serverless database startup time
  transactionOptions: {
    timeout: 30000, // 30 seconds
    maxWait: 35000, // Slightly longer than timeout
  },
});

export { prisma };
