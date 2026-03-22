/**
 * Memory module exports
 */

// Legacy exports (deprecated)
export { ContextMemoryStore } from './ContextMemoryStore.js';
export type { ContextSnapshot, MemorySummary } from './ContextMemoryStore.js';

// MemoryModule (now Turn-based)
export {
    MemoryModule,
    defaultMemoryConfig,
} from './MemoryModule.js';

// Type exports (IMemoryModule interface and related types)
export type { IMemoryModule, MemoryModuleConfig } from './types.js';

// Message types (migrated from task/task.type.ts)
export type { ApiMessage, MessageBuilder, MessageAddedCallback, ExtendedContentBlock, ThinkingBlock } from './types.js';
