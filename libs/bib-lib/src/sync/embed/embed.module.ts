import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { EmbedService } from './embed.service.js';

@Module({
  imports: [PrismaModule],
  providers: [EmbedService],
  exports: [EmbedService],
})
export class EmbedModule {}
