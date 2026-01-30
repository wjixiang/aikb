import { Module } from '@nestjs/common';
import { EntityController } from '../controllers/entity.controller';
import { VertexController } from '../controllers/vertex.controller';
import { PropertyController } from '../controllers/property.controller';
import { EdgeController } from '../controllers/edge.controller';
import { SearchController } from '../controllers/search.controller';
import { VersionControlController } from '../controllers/version-control.controller';
import { HealthController } from '../controllers/health.controller';

// Import the complete lib module that contains all services
import { KnowledgeBaseLibModule } from 'knowledgeBase-lib';

@Module({
  imports: [KnowledgeBaseLibModule],
  controllers: [
    EntityController,
    VertexController,
    PropertyController,
    EdgeController,
    SearchController,
    VersionControlController,
    HealthController, // Add health-check controller
  ],
})
export class AppModule {}
