import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { SyncService } from './sync.service.js';

@Module({
  imports: [PrismaModule],
  providers: [SyncService],
  exports: [SyncService],
})
export class SyncModule {}
