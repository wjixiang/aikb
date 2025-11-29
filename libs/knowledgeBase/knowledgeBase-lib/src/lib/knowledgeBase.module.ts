import { Module } from '@nestjs/common';
import { EntityStorageService } from './knowledgeBaseStorage/entity-storage.service';
import { KnowledgeBaseStorageModule } from './knowledgeBaseStorage/knowledge-base-storage.module';

@Module({
  controllers: [],
  providers: [EntityStorageService],
  exports: [],
  imports: [KnowledgeBaseStorageModule],
})
export class KnowledgeBaseLibModule {}
