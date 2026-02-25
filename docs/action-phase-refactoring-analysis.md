# Action Phase Refactoring Analysis

## Overview

This document analyzes whether the **action phase** in [`Agent`](../libs/agent-lib/src/agent/agent.ts) can be refactored into an independent module, similar to how the **thinking phase** was extracted into [`ThinkingModule`](../libs/agent-lib/src/thinking/ThinkingModule.ts).

## Current Architecture

### Agent Request Loop Flow

The [`requestLoop()`](../libs/agent-lib/src/agent/agent.ts:293) method in [`Agent`](../libs/agent-lib/src/agent/agent.ts:84) orchestrates the complete agent execution cycle:

```typescript
while (stack.length > 0) {
    // 1. Thinking Phase (delegated to ThinkingModule)
    const thinkingResult = await this.thinkingModule.performThinkingPhase(
        currentWorkspaceContext,
        currentTurn?.taskContext,
        [],
        lastToolResults
    );

    // 2. Action Phase (embedded in Agent)
    const response = await this.attemptApiRequest();  // Line 403
    const executionResult = await this.executeToolCalls(response, ...);  // Line 420
}
```

### Action Phase Components

The action phase consists of two main methods in [`Agent`](../libs/agent-lib/src/agent/agent.ts:84):

| Method                                                            | Location | Responsibility                        |
| ----------------------------------------------------------------- | -------- | ------------------------------------- |
| [`attemptApiRequest()`](../libs/agent-lib/src/agent/agent.ts:688) | Agent    | Make API request to LLM with tools    |
| [`executeToolCalls()`](../libs/agent-lib/src/agent/agent.ts:587)  | Agent    | Execute tool calls and build response |

### Current Action Phase Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                         Agent                                    │
├─────────────────────────────────────────────────────────────────┤
│  requestLoop()                                                   │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Thinking Phase (delegated)                                │ │
│  │  └─> thinkingModule.performThinkingPhase()                 │ │
│  └───────────────────────────────────────────────────────────┘ │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Action Phase (embedded)                                  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  attemptApiRequest()                                │ │ │
│  │  │  - Build prompt (system, workspace, memory)          │ │ │
│  │  │  - Convert tools to OpenAI format                   │ │ │
│  │  │  - Call apiClient.makeRequest()                     │ │ │
│  │  │  - Handle errors                                     │ │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  executeToolCalls()                                │ │ │
│  │  │  - Handle attempt_completion                        │ │ │
│  │  │  - Handle recall_conversation                       │ │ │
│  │  │  - Execute tools via IToolManager                  │ │ │
│  │  │  - Build tool results                               │ │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Comparison: Thinking Phase vs Action Phase

### Similarities

| Aspect               | Thinking Phase                   | Action Phase             |
| -------------------- | -------------------------------- | ------------------------ |
| **Current Location** | ThinkingModule (independent)     | Agent (embedded)         |
| **API Calls**        | Yes (via ApiClient)              | Yes (via ApiClient)      |
| **Token Usage**      | Tracked                          | Tracked                  |
| **Tool Usage**       | Restricted (thinking tools only) | All tools available      |
| **Context Required** | Workspace, task context          | Workspace, memory, tools |
| **Result Storage**   | TurnMemoryStore                  | TurnMemoryStore          |
| **Error Handling**   | Yes                              | Yes                      |

### Key Differences

| Aspect                 | Thinking Phase                       | Action Phase                         |
| ---------------------- | ------------------------------------ | ------------------------------------ |
| **Complexity**         | Multi-round, LLM-controlled          | Single API request + tool execution  |
| **State Management**   | Internal state (sequential thinking) | Minimal state                        |
| **Tool Execution**     | No tool execution                    | Executes all tool calls              |
| **Completion Signal**  | `continueThinking=false`             | `attempt_completion` tool            |
| **Integration Points** | MemoryModule, TurnMemoryStore        | Workspace, ToolManager, MemoryModule |

## Analysis: Can Action Phase Be Extracted?

### ✅ Yes - Action Phase Can Be Extracted

The action phase **can** be refactored into an independent module. Here's the analysis:

### Arguments FOR Extraction

1. **Single Responsibility Principle**
   - Agent currently handles: request loop orchestration, thinking phase delegation, action phase execution, error handling
   - Action phase has distinct responsibilities: API requests, tool execution, result building

2. **Separation of Concerns**
   - Thinking phase is already independent
   - Action phase has its own logic that can be isolated
   - Clear boundary between planning (thinking) and execution (action)

3. **Testability**
   - Action phase logic can be tested independently
   - Mock dependencies easier (ApiClient, ToolManager, MemoryModule)
   - Unit tests for API request building, tool execution, error handling

4. **Reusability**
   - ActionModule could be used in different agent implementations
   - Could support different action strategies (e.g., parallel execution, batch execution)

5. **Consistency**
   - Follows the same pattern as ThinkingModule
   - Both phases become first-class modules
   - Clearer architecture

6. **Maintainability**
   - Easier to understand action phase logic in isolation
   - Changes to action phase don't affect Agent orchestration
   - Better code organization

### Potential Challenges

1. **Tight Coupling with Agent State**
   - Action phase accesses: `_tokenUsage`, `_toolUsage`, `_consecutiveMistakeCount`
   - Solution: Pass these as parameters or return from ActionModule

2. **Tool Execution Dependencies**
   - Action phase needs: `workspace.getToolManager()`, `workspace.render()`
   - Solution: Inject dependencies via constructor

3. **MemoryModule Integration**
   - Action phase needs to add messages to memory
   - Solution: Pass MemoryModule reference or use callback pattern

4. **Workspace State Updates**
   - Action phase triggers workspace re-render after tool execution
   - Solution: Return signal to Agent to trigger re-render

## Proposed ActionModule Design

### Interface Definition

```typescript
// libs/agent-lib/src/action/types.ts

/**
 * Configuration for ActionModule
 */
export interface ActionModuleConfig {
  /** API request timeout in milliseconds */
  apiRequestTimeout: number;
  /** Maximum retry attempts for failed tool executions */
  maxToolRetryAttempts: number;
  /** Enable parallel tool execution */
  enableParallelExecution: boolean;
}

/**
 * Default configuration for ActionModule
 */
export const defaultActionConfig: ActionModuleConfig = {
  apiRequestTimeout: 60000,
  maxToolRetryAttempts: 3,
  enableParallelExecution: false,
};

/**
 * Result from action phase
 */
export interface ActionPhaseResult {
  /** API response from LLM */
  apiResponse: ApiResponse;
  /** Tool execution results */
  toolResults: ToolResult[];
  /** Whether task completion was attempted */
  didAttemptCompletion: boolean;
  /** Assistant message to add to history */
  assistantMessage: ApiMessage;
  /** User message content (tool results) to add to history */
  userMessageContent: Array<
    Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam
  >;
  /** Tokens used in action phase */
  tokensUsed: number;
  /** Tool usage statistics */
  toolUsage: ToolUsage;
}

/**
 * Interface for ActionModule
 */
export interface IActionModule {
  /**
   * Perform action phase
   * @param workspaceContext - Current workspace state
   * @param systemPrompt - System prompt for the request
   * @param conversationHistory - Conversation history for the request
   * @param tools - Available tools for execution
   * @param isAborted - Callback to check if task is aborted
   */
  performActionPhase(
    workspaceContext: string,
    systemPrompt: string,
    conversationHistory: ApiMessage[],
    tools: any[],
    isAborted: () => boolean,
  ): Promise<ActionPhaseResult>;

  /**
   * Get current configuration
   */
  getConfig(): ActionModuleConfig;

  /**
   * Update configuration
   */
  updateConfig(config: Partial<ActionModuleConfig>): void;
}
```

### Implementation Structure

```typescript
// libs/agent-lib/src/action/ActionModule.ts

@injectable()
export class ActionModule implements IActionModule {
  private config: ActionModuleConfig;
  private apiClient: ApiClient;
  private logger: Logger;
  private toolManager: IToolManager;
  private memoryModule: IMemoryModule;

  constructor(
    @inject(TYPES.ApiClient) apiClient: ApiClient,
    @inject(TYPES.Logger) logger: Logger,
    @inject(TYPES.IToolManager) toolManager: IToolManager,
    @inject(TYPES.IMemoryModule) memoryModule: IMemoryModule,
    @inject(TYPES.ActionModuleConfig)
    @optional()
    config: Partial<ActionModuleConfig> = {},
  ) {
    this.config = { ...defaultActionConfig, ...config };
    this.apiClient = apiClient;
    this.logger = logger;
    this.toolManager = toolManager;
    this.memoryModule = memoryModule;
  }

  async performActionPhase(
    workspaceContext: string,
    systemPrompt: string,
    conversationHistory: ApiMessage[],
    tools: any[],
    isAborted: () => boolean,
  ): Promise<ActionPhaseResult> {
    // 1. Make API request
    const apiResponse = await this.makeApiRequest(
      systemPrompt,
      workspaceContext,
      conversationHistory,
      tools,
    );

    // 2. Convert API response to assistant message
    const assistantMessage = this.convertApiResponseToApiMessage(apiResponse);

    // 3. Execute tool calls
    const { toolResults, userMessageContent, didAttemptCompletion } =
      await this.executeToolCalls(apiResponse, isAborted);

    // 4. Calculate token usage
    const tokensUsed = this.calculateTokenUsage(apiResponse);

    // 5. Build tool usage statistics
    const toolUsage = this.buildToolUsage(toolResults);

    return {
      apiResponse,
      toolResults,
      didAttemptCompletion,
      assistantMessage,
      userMessageContent,
      tokensUsed,
      toolUsage,
    };
  }

  private async makeApiRequest(
    systemPrompt: string,
    workspaceContext: string,
    conversationHistory: ApiMessage[],
    tools: any[],
  ): Promise<ApiResponse> {
    // Extracted from Agent.attemptApiRequest()
  }

  private async executeToolCalls(
    response: ApiResponse,
    isAborted: () => boolean,
  ): Promise<{
    toolResults: ToolResult[];
    userMessageContent: Array<
      Anthropic.TextBlockParam | Anthropic.ToolResultBlockParam
    >;
    didAttemptCompletion: boolean;
  }> {
    // Extracted from Agent.executeToolCalls()
  }

  private convertApiResponseToApiMessage(response: ApiResponse): ApiMessage {
    // Extracted from Agent.converApiResponseToApiMessage()
  }

  // ... helper methods
}
```

### Updated Agent Integration

```typescript
// libs/agent-lib/src/agent/agent.ts (refactored)

@injectable()
export class Agent {
  // ... existing properties

  private actionModule: IActionModule; // NEW: Action module

  constructor(
    @inject(TYPES.AgentConfig)
    @optional()
    public config: AgentConfig = defaultAgentConfig,
    @inject(TYPES.IVirtualWorkspace) workspace: IVirtualWorkspace,
    @inject(TYPES.AgentPrompt) agentPrompt: AgentPrompt,
    @inject(TYPES.ApiClient) apiClient: ApiClient,
    @inject(TYPES.IMemoryModule) memoryModule: IMemoryModule,
    @inject(TYPES.IThinkingModule) thinkingModule: IThinkingModule,
    @inject(TYPES.ITaskModule) taskModule: ITaskModule,
    @inject(TYPES.IActionModule) actionModule: IActionModule, // NEW
    @inject(TYPES.Logger) private logger: ILogger,
    @inject(TYPES.TaskId) @optional() taskId?: string,
  ) {
    // ... existing initialization
    this.actionModule = actionModule; // NEW
  }

  protected async requestLoop(query: string): Promise<boolean> {
    // ... existing setup

    while (stack.length > 0) {
      // ... existing checks

      try {
        // THINKING PHASE (unchanged)
        const thinkingResult = await this.thinkingModule.performThinkingPhase(
          currentWorkspaceContext,
          currentTurn?.taskContext,
          [],
          lastToolResults,
        );
        // ... existing thinking phase handling

        // ACTION PHASE (refactored)
        const systemPrompt = await this.getSystemPrompt();
        const conversationHistory = this.memoryModule.getHistoryForPrompt();
        const tools = this.convertWorkspaceToolsToOpenAI();

        const actionResult = await this.actionModule.performActionPhase(
          workspaceContext,
          systemPrompt,
          conversationHistory,
          tools,
          () => this.isAborted(),
        );

        // Update agent state from action result
        this._tokenUsage.totalTokensOut += actionResult.tokensUsed;
        this._toolUsage = { ...this._toolUsage, ...actionResult.toolUsage };

        // Add messages to memory
        this.memoryModule.addMessage(actionResult.assistantMessage);
        if (actionResult.userMessageContent.length > 0) {
          const message = MessageBuilder.custom(
            'system',
            actionResult.userMessageContent,
          );
          this.memoryModule.addMessage(message);
        }

        // Record tool calls to turn
        actionResult.toolResults.forEach((result) => {
          this.memoryModule.recordToolCall(
            result.toolName,
            result.success,
            result.result,
          );
        });

        // Trigger workspace re-render
        await this.workspace.render();

        // Check if task completed
        if (!actionResult.didAttemptCompletion) {
          // Continue to next turn
          this.memoryModule.completeTurn();
          needsNewTurn = true;
          stack.push({
            sender: 'system',
            content: [{ type: 'text', text: 'WORKSPACE STATE UPDATED' }],
          });
        } else {
          this.memoryModule.completeTurn();
        }
      } catch (error) {
        // ... existing error handling
      }
    }

    this.complete();
    return false;
  }

  // REMOVED methods (now in ActionModule):
  // - attemptApiRequest()
  // - executeToolCalls()
  // - converApiResponseToApiMessage()
  // - convertWorkspaceToolsToOpenAI()
}
```

## DI Container Updates

```typescript
// libs/agent-lib/src/di/container.ts

import { ActionModule, defaultActionConfig } from '../action/ActionModule.js';
import type { ActionModuleConfig } from '../action/types.js';
import type { IActionModule } from '../action/types.js';

private setupBindings(): void {
    // ... existing bindings

    // Action Module
    this.container
        .bind<IActionModule>(TYPES.IActionModule)
        .to(ActionModule)
        .inRequestScope();
    this.container
        .bind(TYPES.ActionModule)
        .to(ActionModule)
        .inRequestScope();

    // ActionModule configuration
    this.container
        .bind<ActionModuleConfig>(TYPES.ActionModuleConfig)
        .toConstantValue(defaultActionConfig);
}
```

```typescript
// libs/agent-lib/src/di/types.ts

export const TYPES = {
  // ... existing types

  /**
   * ActionModule for action phase management
   * @scope Request - Shared within an agent creation request
   */
  ActionModule: Symbol('ActionModule'),

  /**
   * IActionModule interface
   * @scope Request - Shared within an agent creation request
   */
  IActionModule: Symbol('IActionModule'),

  /**
   * ActionModuleConfig - Configuration for ActionModule
   */
  ActionModuleConfig: Symbol('ActionModuleConfig'),
};
```

## File Structure

```
libs/agent-lib/src/
├── action/                      # NEW: Action module
│   ├── index.ts
│   ├── types.ts                 # IActionModule, ActionModuleConfig
│   ├── ActionModule.ts          # Main implementation
│   └── __tests__/
│       └── ActionModule.test.ts
├── thinking/                    # EXISTING: Thinking module
│   ├── index.ts
│   ├── types.ts
│   ├── ThinkingModule.ts
│   └── __tests__/
│       └── ThinkingModule.test.ts
├── agent/
│   ├── agent.ts                 # REFACTORED: Remove action logic
│   └── ...
└── di/
    └── types.ts                 # UPDATED: Add ActionModule types
```

## Benefits

1. **Single Responsibility**: Agent focuses on orchestration, ActionModule handles execution
2. **Testability**: ActionModule can be tested in isolation
3. **Reusability**: ActionModule can be used in different agent implementations
4. **Maintainability**: Clearer separation of concerns
5. **Consistency**: Follows the same pattern as ThinkingModule
6. **Extensibility**: Easy to add new action strategies (parallel execution, batching, etc.)

## Migration Path

### Phase 1: Create New Module (Non-Breaking)

1. Create `libs/agent-lib/src/action/` directory
2. Create `IActionModule` interface and types
3. Create `ActionModule` implementation
4. Add DI types and bindings
5. Add unit tests for ActionModule
6. Keep existing Agent methods as-is

### Phase 2: Integrate with Agent (Non-Breaking)

1. Inject ActionModule into Agent
2. Add delegation in requestLoop()
3. Keep old methods as deprecated wrappers
4. Add integration tests

### Phase 3: Clean Up (Breaking)

1. Remove deprecated methods from Agent
2. Update all tests
3. Update documentation

## Conclusion

**Yes, the action phase can and should be refactored into an independent module.**

The refactoring follows the same successful pattern used for the thinking phase and provides significant benefits in terms of:

- **Architecture**: Cleaner separation between orchestration (Agent) and execution (ActionModule)
- **Testability**: Independent testing of action phase logic
- **Maintainability**: Easier to understand and modify
- **Consistency**: Both phases become first-class, independent modules

The main challenges (state management, dependency injection, memory integration) are solvable with well-defined interfaces and dependency injection patterns.

## Next Steps

1. Review and approve this analysis
2. Switch to Architect mode to create detailed implementation plan
3. Switch to Code mode to implement Phase 1
4. Run tests to ensure no regressions
5. Continue with Phase 2 and 3
