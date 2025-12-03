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
import { EntityDBPrismaService } from 'entity-db';
import { PropertyDBPrismaService } from 'property-db'
import { GraphDBPrismaService } from 'graph-db';
import { VersionControlDBPrismaService } from 'VersionControl-db'

@Module({
  providers: [
    EntityDBPrismaService,
    PropertyDBPrismaService,
    GraphDBPrismaService,
    EntityStorageService,
    EntityStorageMemoryService,
    PropertyStorageService,
    PropertyStorageMemoryService,
    EdgeStorageService,
    EdgeStorageMemoryService,
    VertexStorageMemoryService,
    VertextStorageService,
    GitVersionControlService,
    VersionControlDBPrismaService
  ],
  exports: [
    EntityDBPrismaService,
    PropertyDBPrismaService,
    GraphDBPrismaService,
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
