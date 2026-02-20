import { Module, Global } from '@nestjs/common';
import { AgentDBPrismaService } from './prisma.js';

@Global()
@Module({
  providers: [AgentDBPrismaService],
  exports: [AgentDBPrismaService],
})
export class AgentDBModule {}
