import { Module } from '@nestjs/common';
import { EntityStorageService } from './entity-storage.service';
import { EntityStorageMemoryService } from './entity-storage.memory.service';
import { PropertyStorageService } from './property-storage.service';
import { PropertyStorageMemoryService } from './property-storage.memory.service';
import { EdgeStorageService } from './edge-storage.service';
import { EdgeStorageMemoryService } from './edge-storage.memory.service';
import { VertexStorageMemoryService } from './vertex-storage.memory.service';
import { VertextStorageService } from './vertext-storage.service';
import { GitVersionControlService } from '../versionControl/version-control.service';

@Module({
  providers: [
    EntityStorageService,
    EntityStorageMemoryService,
    PropertyStorageService,
    PropertyStorageMemoryService,
    EdgeStorageService,
    EdgeStorageMemoryService,
    VertexStorageMemoryService,
    VertextStorageService,
    GitVersionControlService,
  ],
  exports: [
    EntityStorageService,
    EntityStorageMemoryService,
    PropertyStorageService,
    PropertyStorageMemoryService,
    EdgeStorageService,
    EdgeStorageMemoryService,
    VertextStorageService,
    VertexStorageMemoryService,
    GitVersionControlService,
  ],
})
export class KnowledgeBaseStorageModule {}
