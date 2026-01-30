export * from './lib/knowledgeBase.module';

// Export storage services
export { EntityStorageMemoryService } from './lib/knowledgeBaseStorage/entity-storage.memory.service';
export { VertexStorageMemoryService } from './lib/knowledgeBaseStorage/vertex-storage.memory.service';
export { PropertyStorageMemoryService } from './lib/knowledgeBaseStorage/property-storage.memory.service';
export { EdgeStorageMemoryService } from './lib/knowledgeBaseStorage/edge-storage.memory.service';

// Export version control service
export { GitVersionControlService } from './lib/versionControl/version-control.service';
export { VersionControlInitService } from './lib/versionControl/version-control-init.service';

// Export knowledge management service
export { KnowledgeManagementService } from './lib/knowledgeManagement/knowledge-management.service';
export * as KnowledgeManagementInterfaces from './lib/knowledgeManagement/knowledge-management.interface';

// Export event bus service
export { EventBusService } from './lib/events/event-bus.service';

// Export event handlers
export { EntityEventHandler } from './lib/handlers/entity-event.handler';

// Export types with aliases to avoid conflicts
export * from './lib/types';
export * as EventTypes from './lib/events/types';
export { EVENT_TYPES } from './lib/events/types';
export * as EventBusInterfaces from './lib/events/event-bus.interface';
export * as VersionControlTypes from './lib/versionControl/types';
export * as TransactionInterfaces from './lib/transactions/transaction.interface';
