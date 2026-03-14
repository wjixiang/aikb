/**
 * Memory module exports
 */

// Turn-based architecture (new)
export { TurnMemoryStore } from './TurnMemoryStore.js';
export type { ITurnMemoryStore } from './TurnMemoryStore.interface.js';
export { TurnStatus } from './Turn.js';
export type { Turn, ThinkingRound as TurnThinkingRound, ToolCallResult, TurnMemoryExport } from './Turn.js';

// Observable TurnMemoryStore
export { createObservableTurnMemoryStore, ObservableTurnMemoryStoreFactory } from './ObservableTurnMemoryStore.js';
export type { TurnStoreObserverCallbacks } from './ObservableTurnMemoryStore.js';

// Legacy exports (deprecated)
export { ContextMemoryStore } from './ContextMemoryStore.js';
export type { ContextSnapshot, MemorySummary } from './ContextMemoryStore.js';

// MemoryModule (now Turn-based)
export {
    MemoryModule,
    defaultMemoryConfig,
} from './MemoryModule.js';

// Type exports (IMemoryModule interface and related types)
export type { IMemoryModule, MemoryModuleConfig, ThinkingPhaseResult } from './types.js';
