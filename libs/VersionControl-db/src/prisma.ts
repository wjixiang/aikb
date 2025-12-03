import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';
import { Injectable } from '@nestjs/common';

@Injectable()
export class VersionControlDBPrismaService extends PrismaClient {
  constructor() {
    const connectionString = `${process.env['VERSIONCONTROL_DATABASE_URL']}`;
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }
}

