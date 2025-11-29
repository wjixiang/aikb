import { Module } from '@nestjs/common';
import { EntityStorageService } from './entity-storage.service';
import { EntityStorageMemoryService } from './entity-storage.memory.service';
import { PropertyStorageService } from './property-storage.service';
import { PropertyStorageMemoryService } from './property-storage.memory.service';

@Module({
  providers: [
    EntityStorageService,
    EntityStorageMemoryService,
    PropertyStorageService,
    PropertyStorageMemoryService,
  ],
  exports: [
    EntityStorageService,
    EntityStorageMemoryService,
    PropertyStorageService,
    PropertyStorageMemoryService,
  ],
})
export class KnowledgeBaseStorageModule {}
