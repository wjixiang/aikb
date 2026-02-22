/**
 * Memory module exports
 */

// Turn-based architecture (new)
export { TurnMemoryStore } from './TurnMemoryStore.js';
export { Turn, TurnStatus, ThinkingRound as TurnThinkingRound, ToolCallResult, TurnMemoryExport } from './Turn.js';

// Observable TurnMemoryStore
export {
    createObservableTurnMemoryStore,
    ObservableTurnMemoryStoreFactory,
    TurnStoreObserverCallbacks
} from './ObservableTurnMemoryStore.js';

// Legacy exports (deprecated)
export { ContextMemoryStore, ContextSnapshot, MemorySummary } from './ContextMemoryStore.js';

// MemoryModule (now Turn-based)
export {
    MemoryModule,
    defaultMemoryConfig,
} from './MemoryModule.js';

// Type exports (IMemoryModule interface and related types)
export type { IMemoryModule, MemoryModuleConfig, ThinkingPhaseResult } from './types.js';
