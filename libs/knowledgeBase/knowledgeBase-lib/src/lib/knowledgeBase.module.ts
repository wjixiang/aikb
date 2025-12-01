import { Module } from '@nestjs/common';
import { EntityStorageService } from './knowledgeBaseStorage/entity-storage.service';
import { KnowledgeBaseStorageModule } from './knowledgeBaseStorage/knowledge-base-storage.module';
import { VersionControlModule } from './versionControl/version-control.module';
import { EventsModule } from './events/events.module';
import { KnowledgeManagementService } from './knowledgeManagement/knowledge-management.service';
import { EmbeddingModule } from 'EmbeddingModule';

@Module({
  controllers: [],
  providers: [KnowledgeManagementService],
  exports: [KnowledgeManagementService],
  imports: [KnowledgeBaseStorageModule, VersionControlModule, EventsModule, EmbeddingModule],
})
export class KnowledgeBaseLibModule {}
