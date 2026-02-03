import { Module } from '@nestjs/common';
import { PubmedService } from './pubmed/pubmed.service';

@Module({
  providers: [PubmedService],
})
export class NihclientModule {}
