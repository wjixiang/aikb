// Fix TextEncoder issue for Node.js environment
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('util');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class EntityDBPrismaService extends PrismaClient {
  constructor() {
    const connectionString = `${process.env['ENTITY_DATABASE_URL']}`;
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }
}
