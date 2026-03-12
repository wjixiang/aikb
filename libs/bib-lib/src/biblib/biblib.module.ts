import { Module } from '@nestjs/common';
import { BiblibService } from './biblib.service';
import { BiblibController } from './biblib.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [BiblibService],
  controllers: [BiblibController]
})
export class BiblibModule {}
