import { Module } from '@nestjs/common';
import { EUtilitiesService } from './e-utilities.service';

@Module({
  providers: [EUtilitiesService],
})
export class EUtilitiesModule {}
