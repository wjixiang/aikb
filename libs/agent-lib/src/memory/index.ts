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
export {
    ReflectiveThinkingProcessor,
    ReflectiveThinkingConfig,
    ReflectiveThinkingResult,
    ThinkingRound,
    ThinkingControl,
    RecallRequest,
} from './ReflectiveThinkingProcessor.js';

// MemoryModule (now Turn-based)
export {
    MemoryModule,
    MemoryModuleConfig,
    defaultMemoryConfig,
    ThinkingPhaseResult,
    RecallRequest as MemoryModuleRecallRequest,
} from './MemoryModule.js';

// Type exports (IMemoryModule interface)
export type { IMemoryModule } from './types.js';
