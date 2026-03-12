import { Global, Module, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {
  constructor(@Inject(forwardRef(() => PrismaService)) private prismaService: PrismaService) {}
}
