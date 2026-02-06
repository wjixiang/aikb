import { Module, Global } from '@nestjs/common';
import { AgentDBPrismaService } from './prisma';

@Global()
@Module({
  providers: [AgentDBPrismaService],
  exports: [AgentDBPrismaService],
})
export class AgentDBModule {}
