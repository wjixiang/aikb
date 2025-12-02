import { Module } from '@nestjs/common';
import { EntityController } from './controllers/entity.controller';
import { VertexController } from './controllers/vertex.controller';
import { PropertyController } from './controllers/property.controller';
import { EdgeController } from './controllers/edge.controller';
import { SearchController } from './controllers/search.controller';
import { VersionControlController } from './controllers/version-control.controller';

// Import the complete lib module that contains all services
import { KnowledgeBaseLibModule } from 'knowledgeBase-lib';
import { EmbeddingModule } from 'EmbeddingModule';

@Module({
  imports: [KnowledgeBaseLibModule, EmbeddingModule],
  controllers: [
    EntityController,
    VertexController,
    PropertyController,
    EdgeController,
    SearchController,
    VersionControlController,
  ],
})
export class KnowledgeManagementModule {}
