# Thinking Module Refactoring Design

## Overview

This document outlines the design for refactoring the self-reflection (thinking) functionality from [`MemoryModule`](../libs/agent-lib/src/memory/MemoryModule.ts) into a separate, independent [`ThinkingModule`](../libs/agent-lib/src/thinking/ThinkingModule.ts).

**Decision**: The new ThinkingModule will replace and merge functionality from both existing processors:
- [`ThinkingProcessor`](../libs/agent-lib/src/agent/ThinkingProcessor.ts) - Context compression and basic thinking
- [`ReflectiveThinkingProcessor`](../libs/agent-lib/src/memory/ReflectiveThinkingProcessor.ts) - Reflective thinking with memory

These files will be deprecated and eventually removed after the migration is complete.

## Current State Analysis

### Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent                                    │
├─────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    MemoryModule                            │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Turn Management                                     │  │ │
│  │  │  - startTurn() / completeTurn()                      │  │ │
│  │  │  - getCurrentTurn()                                  │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Message Management                                  │  │ │
│  │  │  - addMessage() / getAllMessages()                   │  │ │
│  │  │  - recallTurns()                                     │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Thinking Phase (TO BE EXTRACTED)                    │  │ │
│  │  │  - performThinkingPhase()                            │  │ │
│  │  │  - performSingleThinkingRound()                      │  │ │
│  │  │  - buildThinkingPrompt()                             │  │ │
│  │  │  - buildThinkingTools()                              │  │ │
│  │  │  - generateSummary()                                 │  │ │
│  │  │  - extractInsights()                                 │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  Turn Storage                                        │  │ │
│  │  │  - TurnMemoryStore                                   │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Problems with Current Design

1. **Violation of Single Responsibility Principle**: MemoryModule handles both memory storage AND thinking logic
2. **Tight Coupling**: Thinking functionality is deeply embedded in MemoryModule
3. **Limited Reusability**: Thinking logic cannot be used independently
4. **Testing Complexity**: Testing thinking logic requires full MemoryModule setup
5. **Existing Duplication**: [`ReflectiveThinkingProcessor`](../libs/agent-lib/src/memory/ReflectiveThinkingProcessor.ts) already exists but is not integrated

## Proposed Architecture

### New Module Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                   Agent                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────┐  ┌─────────────────────────────────────────────┐ │
│  │     MemoryModule         │  │              ThinkingModule                   │ │
│  ├──────────────────────────┤  ├─────────────────────────────────────────────┤ │
│  │ Turn Management          │  │  Thinking Phase                              │ │
│  │ - startTurn()            │  │  - performThinkingPhase()                    │ │
│  │ - completeTurn()         │  │  - performThinkingRound()                    │ │
│  │ - getCurrentTurn()       │  │                                               │ │
│  │                          │  │  Prompt Building                              │ │
│  │ Message Management       │  │  - buildThinkingPrompt()                     │ │
│  │ - addMessage()           │  │  - buildThinkingTools()                      │ │
│  │ - getAllMessages()       │  │                                               │ │
│  │ - recallTurns()          │  │  Summary Generation                           │ │
│  │                          │  │  - generateSummary()                          │ │
│  │ Turn Storage             │  │  - extractInsights()                          │ │
│  │ - TurnMemoryStore ◄──────┼──┼──┐  Context Recall                           │ │
│  └──────────────────────────┘  │  │  - handleRecall()                          │ │
│                                 │  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                     ▲
                                     │ (reads from)
                                     │
                          TurnMemoryStore (shared)
```

### Separation of Concerns

| Responsibility | Current Location | New Location |
|----------------|------------------|--------------|
| Turn lifecycle management | MemoryModule | MemoryModule |
| Message storage/retrieval | MemoryModule | MemoryModule |
| Turn storage (TurnMemoryStore) | MemoryModule | MemoryModule |
| Thinking phase orchestration | MemoryModule | ThinkingModule |
| Thinking prompt building | MemoryModule | ThinkingModule |
| Summary generation | MemoryModule | ThinkingModule |
| Insight extraction | MemoryModule | ThinkingModule |
| Thinking tool definitions | MemoryModule | ThinkingModule |
| Context recall | MemoryModule | MemoryModule (delegated) |

## Detailed Design

### 1. New ThinkingModule Interface

```typescript
// libs/agent-lib/src/thinking/types.ts

export interface ThinkingModuleConfig {
    /** Maximum thinking rounds per turn */
    maxThinkingRounds: number;
    /** Token budget for thinking phase */
    thinkingTokenBudget: number;
    /** Enable automatic summarization */
    enableSummarization: boolean;
    /** API request timeout in milliseconds */
    apiRequestTimeout: number;
}

export interface ThinkingPhaseResult {
    /** Thinking rounds performed */
    rounds: ThinkingRound[];
    /** Total tokens used */
    tokensUsed: number;
    /** Whether to proceed to action phase */
    shouldProceedToAction: boolean;
    /** Summary generated */
    summary?: string;
}

export interface IThinkingModule {
    /**
     * Perform thinking phase
     * @param workspaceContext - Current workspace state
     * @param taskContext - Optional task context (user's goal)
     * @param previousRounds - Previous thinking rounds in current phase
     * @param lastToolResults - Results from previous tool executions
     */
    performThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        previousRounds?: ThinkingRound[],
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult>;

    /**
     * Get current configuration
     */
    getConfig(): ThinkingModuleConfig;

    /**
     * Update configuration
     */
    updateConfig(config: Partial<ThinkingModuleConfig>): void;
}
```

### 2. ThinkingModule Implementation

```typescript
// libs/agent-lib/src/thinking/ThinkingModule.ts

@injectable()
export class ThinkingModule implements IThinkingModule {
    private config: ThinkingModuleConfig;
    private apiClient: ApiClient;
    private logger: Logger;
    private turnMemoryStore: TurnMemoryStore;  // REQUIRED: For accessing summaries and history

    constructor(
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.Logger) logger: Logger,
        @inject(TYPES.ThinkingModuleConfig) @optional()
        config: Partial<ThinkingModuleConfig> = {},
        @inject(TYPES.TurnMemoryStore) turnMemoryStore: TurnMemoryStore  // REQUIRED
    ) {
        this.config = { ...defaultThinkingConfig, ...config };
        this.apiClient = apiClient;
        this.logger = logger;
        this.turnMemoryStore = turnMemoryStore;
    }

    async performThinkingPhase(
        workspaceContext: string,
        taskContext?: string,
        previousRounds: ThinkingRound[] = [],
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult> {
        // Get accumulated summaries from TurnMemoryStore
        const accumulatedSummaries = this.buildAccumulatedSummaries();
        
        // Get conversation history for prompt building
        const allMessages = this.turnMemoryStore.getAllMessages();
        
        // Implementation extracted from MemoryModule
    }

    private buildAccumulatedSummaries(): string {
        const summaries = this.turnMemoryStore.getAllSummaries();
        // ... build summaries string
    }

    private handleRecall(request: RecallRequest): Turn[] {
        // Use turnMemoryStore for recall
        if (request.turnNumbers) {
            // Recall by turn numbers
        }
        if (request.keywords) {
            const turns = this.turnMemoryStore.searchTurns(keyword);
            // ...
        }
    }

    private buildThinkingPrompt(...): { ... } { ... }
    private buildThinkingTools(): ChatCompletionTool[] { ... }
    private async generateSummary(...): Promise<string> { ... }
    private extractInsights(rounds: ThinkingRound[]): string[] { ... }
}
```

### 3. Updated MemoryModule

```typescript
// libs/agent-lib/src/memory/MemoryModule.ts (refactored)

@injectable()
export class MemoryModule implements IMemoryModule {
    private config: MemoryModuleConfig;
    private turnStore: TurnMemoryStore;
    private thinkingModule: IThinkingModule;  // NEW: Dependency

    constructor(
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.Logger) private logger: Logger,
        @inject(TYPES.MemoryModuleConfig) @optional() 
        config: Partial<MemoryModuleConfig> = {},
        @inject(TYPES.TurnMemoryStore) turnStore: TurnMemoryStore,
        @inject(TYPES.IThinkingModule) thinkingModule: IThinkingModule  // NEW
    ) {
        this.config = { ...defaultMemoryConfig, ...config };
        this.turnStore = turnStore;
        this.thinkingModule = thinkingModule;  // NEW
    }

    /**
     * Perform thinking phase - delegates to ThinkingModule
     * Note: ThinkingModule will access TurnMemoryStore directly for summaries/history
     */
    async performThinkingPhase(
        workspaceContext: string,
        lastToolResults?: ToolCallResult[]
    ): Promise<ThinkingPhaseResult> {
        if (!this.currentTurn) {
            throw new Error('No active turn. Call startTurn() first.');
        }

        // Update turn status
        this.turnStore.updateTurnStatus(this.currentTurn.id, TurnStatus.THINKING);

        // Delegate to ThinkingModule
        // ThinkingModule will access TurnMemoryStore directly for:
        // - accumulatedSummaries (via getAllSummaries())
        // - conversation history (via getAllMessages())
        const result = await this.thinkingModule.performThinkingPhase(
            workspaceContext,
            this.currentTurn.taskContext,  // Pass task context
            [],  // previousRounds - empty for new phase
            lastToolResults
        );

        // Store thinking phase in turn
        this.turnStore.storeThinkingPhase(
            this.currentTurn.id,
            result.rounds,
            result.tokensUsed
        );

        // Store summary if available
        if (result.summary) {
            this.turnStore.storeSummary(
                this.currentTurn.id,
                result.summary,
                []  // insights - extracted by ThinkingModule
            );
        }

        return result;
    }

    // REMOVED methods (now in ThinkingModule):
    // - performSingleThinkingRound()
    // - buildThinkingPrompt()
    // - buildThinkingTools()
    // - generateSummary()
    // - extractInsights()
    // - extractContent()
    // - extractControlDecision()
    // - extractRecallRequest()
    // - estimateTokens()
}
```

### 4. Updated MemoryModuleConfig

```typescript
// libs/agent-lib/src/memory/types.ts (updated)

export interface MemoryModuleConfig {
    // REMOVED: maxThinkingRounds
    // REMOVED: thinkingTokenBudget
    // REMOVED: apiRequestTimeout (thinking-specific)
    
    /** Enable context recall */
    enableRecall: boolean;
    /** Maximum contexts to recall per request */
    maxRecallContexts: number;
    /** Enable automatic summarization */
    enableSummarization: boolean;
    /** Maximum recalled conversation messages to inject */
    maxRecalledMessages: number;
}
```

### 5. Updated DI Types

```typescript
// libs/agent-lib/src/di/types.ts (updated)

export const TYPES = {
    // ... existing types ...

    /**
     * ThinkingModule concrete class
     * @scope Request - Shared within an agent creation request
     */
    ThinkingModule: Symbol('ThinkingModule'),

    /**
     * IThinkingModule interface
     * @scope Request - Shared within an agent creation request
     */
    IThinkingModule: Symbol('IThinkingModule'),

    /**
     * ThinkingModuleConfig - Configuration for ThinkingModule
     */
    ThinkingModuleConfig: Symbol('ThinkingModuleConfig'),
};
```

### 6. Updated Agent Class

```typescript
// libs/agent-lib/src/agent/agent.ts (updated)

@injectable()
export class Agent {
    private memoryModule: MemoryModule;
    private thinkingModule: IThinkingModule;  // NEW: Direct access if needed

    constructor(
        @inject(TYPES.AgentConfig) @optional() 
        public config: AgentConfig = defaultAgentConfig,
        @inject(TYPES.IVirtualWorkspace) workspace: IVirtualWorkspace,
        @inject(TYPES.AgentPrompt) agentPrompt: AgentPrompt,
        @inject(TYPES.ApiClient) apiClient: ApiClient,
        @inject(TYPES.IMemoryModule) memoryModule: IMemoryModule,
        @inject(TYPES.IThinkingModule) thinkingModule: IThinkingModule,  // NEW
        @inject(TYPES.TaskId) @optional() taskId?: string,
    ) {
        this.workspace = workspace as VirtualWorkspace;
        this._taskId = taskId || crypto.randomUUID();
        this.agentPrompt = agentPrompt;
        this.apiClient = apiClient;
        this.memoryModule = memoryModule as MemoryModule;
        this.thinkingModule = thinkingModule;  // NEW
    }

    // Existing code continues to work - thinking phase is delegated internally
    // through MemoryModule.performThinkingPhase()
}
```

## Migration Path

### Phase 1: Create New Module (Non-Breaking)

1. Create `libs/agent-lib/src/thinking/` directory
2. Create `IThinkingModule` interface
3. Create `ThinkingModule` implementation
4. Add DI types
5. Add unit tests for ThinkingModule

### Phase 2: Integrate with MemoryModule (Non-Breaking)

1. Inject ThinkingModule into MemoryModule
2. Add delegation in `performThinkingPhase()`
3. Keep old methods as deprecated wrappers
4. Add integration tests

### Phase 3: Clean Up (Breaking)

1. Remove deprecated methods from MemoryModule
2. Update MemoryModuleConfig (remove thinking-related config)
3. Update all tests
4. Update documentation

### Phase 4: Optional Enhancements

1. ~~Consider merging with existing `ReflectiveThinkingProcessor`~~ **DECIDED: Yes, merge**
2. Add thinking strategy pattern (different thinking modes)
3. Add thinking metrics and observability
4. Deprecate and remove `ThinkingProcessor` and `ReflectiveThinkingProcessor`

## File Structure

```
libs/agent-lib/src/
├── thinking/                    # NEW: Thinking module
│   ├── index.ts
│   ├── types.ts                 # IThinkingModule, ThinkingModuleConfig
│   ├── ThinkingModule.ts        # Main implementation
│   ├── prompts.ts               # Thinking prompt templates
│   └── __tests__/
│       └── ThinkingModule.test.ts
├── memory/
│   ├── MemoryModule.ts          # REFACTORED: Remove thinking logic
│   ├── types.ts                 # UPDATED: Remove thinking config
│   └── ...
├── agent/
│   ├── agent.ts                 # UPDATED: Inject ThinkingModule
│   └── ...
└── di/
    └── types.ts                 # UPDATED: Add ThinkingModule types
```

## Benefits

1. **Single Responsibility**: Each module has a clear, focused purpose
2. **Testability**: ThinkingModule can be tested independently
3. **Reusability**: ThinkingModule can be used in other contexts
4. **Maintainability**: Easier to understand and modify
5. **Extensibility**: Easy to add new thinking strategies
6. **Reduced Coupling**: MemoryModule no longer depends on ApiClient for thinking

## Backward Compatibility

During Phase 1 and 2, backward compatibility is maintained by:
- Keeping existing method signatures
- Using delegation pattern internally
- Deprecation warnings for removed methods

Phase 3 introduces breaking changes but provides clear migration path.

## Testing Strategy

### Unit Tests
- `ThinkingModule.test.ts`: Test thinking logic in isolation
- `MemoryModule.test.ts`: Test memory management (without thinking)
- Integration tests for delegation

### Mock Strategy
```typescript
// Mock ThinkingModule for MemoryModule tests
const mockThinkingModule = {
    performThinkingPhase: stub().resolves({
        rounds: [],
        tokensUsed: 0,
        shouldProceedToAction: true,
    }),
    getConfig: stub().returns(defaultThinkingConfig),
};
```

## Merged Functionality from Existing Processors

### From ThinkingProcessor (agent/ThinkingProcessor.ts)
- **Context Compression**: Sliding window, token budget, and semantic strategies
- **Tool Result Analysis**: Extract insights from executed tools
- **Next Action Planning**: Determine next steps based on history
- **Token Estimation**: Calculate token usage for thinking

### From ReflectiveThinkingProcessor (memory/ReflectiveThinkingProcessor.ts)
- **Continuous Thinking Rounds**: LLM-controlled multi-round thinking
- **Context Recall**: Recall historical contexts by turn/ID/keyword
- **Summary Generation**: Generate and accumulate summaries
- **Thinking Tools**: `continue_thinking` and `recall_context` tools

### From MemoryModule Thinking Logic
- **Turn-Based Integration**: Store thinking results in turns
- **Workspace Context**: Use current workspace state for thinking
- **Skill Switching Guidance**: Consider skill activation during thinking

### Deprecation Plan

| File | Action | Timeline |
|------|--------|----------|
| `agent/ThinkingProcessor.ts` | Deprecate | Phase 1 |
| `memory/ReflectiveThinkingProcessor.ts` | Deprecate | Phase 1 |
| Both files | Remove | Phase 3 (after migration complete) |

## Open Questions

1. ~~Should we merge `ReflectiveThinkingProcessor` into the new `ThinkingModule`?~~ **DECIDED: Yes**
2. ~~Should thinking strategies be pluggable (strategy pattern)?~~ **DECIDED: No, use unified approach**
3. ~~Should we keep `ThinkingRound` in `Turn.ts` or move to thinking module?~~ **DECIDED: Keep in Turn.ts**
4. ~~Should the new ThinkingModule support both "simple" and "reflective" thinking modes?~~ **DECIDED: No, single unified flow**

## Design Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Merge existing processors | Yes | Consolidate all thinking logic into one authoritative module |
| Strategy pattern | No | Single unified approach reduces complexity |
| ThinkingRound location | Keep in Turn.ts | Closely related to Turn structure, used by both memory and thinking |
| Multiple thinking modes | No | Unified flow combining best aspects of all approaches |

## Next Steps

1. Review and approve this design
2. Switch to Code mode to implement Phase 1
3. Run tests to ensure no regressions
4. Continue with Phase 2 and 3
