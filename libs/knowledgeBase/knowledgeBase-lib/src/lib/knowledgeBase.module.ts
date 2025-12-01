import { Module } from '@nestjs/common';
import { EntityStorageService } from './knowledgeBaseStorage/entity-storage.service';
import { KnowledgeBaseStorageModule } from './knowledgeBaseStorage/knowledge-base-storage.module';
import { VersionControlModule } from './versionControl/version-control.module';
import { EventsModule } from './events/events.module';
import { KnowledgeManagementService } from './knowledgeManagement/knowledge-management.service';

@Module({
  controllers: [],
  providers: [EntityStorageService, KnowledgeManagementService],
  exports: [KnowledgeManagementService],
  imports: [KnowledgeBaseStorageModule, VersionControlModule, EventsModule],
})
export class KnowledgeBaseLibModule {}
