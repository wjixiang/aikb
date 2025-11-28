import { Module } from '@nestjs/common';
import { EntityStorageService } from './entity-storage.service';

@Module({
  controllers: [],
  providers: [EntityStorageService],
  exports: [],
})
export class KnowledgeBaseLibModule {}
