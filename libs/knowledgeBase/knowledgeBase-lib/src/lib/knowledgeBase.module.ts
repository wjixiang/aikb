import { Module } from '@nestjs/common';
import { KnowledgeBaseStorageModule } from './knowledgeBaseStorage/knowledge-base-storage.module';
import { VersionControlModule } from './versionControl/version-control.module';
import { EventsModule } from './events/events.module';
import { KnowledgeManagementService } from './knowledgeManagement/knowledge-management.service';
import { EmbeddingModule } from 'EmbeddingModule';
import { VersionControlInitService } from './versionControl/version-control-init.service';

@Module({
  controllers: [],
  providers: [KnowledgeManagementService, 
    VersionControlInitService
  ],
  exports: [KnowledgeManagementService, 
    VersionControlInitService, 
    EventsModule, VersionControlModule],
  imports: [KnowledgeBaseStorageModule, VersionControlModule, EventsModule, EmbeddingModule],
})
export class KnowledgeBaseLibModule {}
