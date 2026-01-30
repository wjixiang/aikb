import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { meSHClient } from './mesh-client.service';

@Module({
  imports: [HttpModule],
  providers: [meSHClient],
  exports: [meSHClient],
})
export class MeShClientModule {}
