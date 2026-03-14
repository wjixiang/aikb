# Dependency Injection with InversifyJS

This module provides dependency injection for the agent-lib library using InversifyJS.

## Overview

The DI container manages the lifecycle and dependencies of:
- **Agent** - Main agent class
- **VirtualWorkspace** - Workspace context manager
- **MemoryModule** - Conversation memory management
- **ApiClient** - API client for LLM providers
- **TurnMemoryStore** - Turn-based memory storage
- **ReflectiveThinkingProcessor** - Reflective thinking processor
- **SkillManager** - Skill management

## Quick Start

### Using AgentFactory (Recommended for existing code)

```typescript
import 'reflect-metadata';
import { AgentFactory } from './agent/AgentFactory.js';
import { VirtualWorkspace } from './statefulContext/index.js';

const workspace = new VirtualWorkspace({});
const agent = AgentFactory.create(
    workspace,
    {
        capability: 'You are a helpful assistant',
        direction: 'Follow user instructions carefully'
    },
    {
        config: { apiRequestTimeout: 60000 },
        apiConfiguration: { apiModelId: 'gpt-4' }
    }
);

await agent.start('Help me write code');
```

### Using the Container Directly (New code)

```typescript
import 'reflect-metadata';
import { getGlobalContainer } from './di/index.js';

const container = getGlobalContainer();
const agent = container.createAgent({
    agentPrompt: {
        capability: 'You are a helpful assistant',
        direction: 'Follow user instructions carefully'
    },
    config: {
        apiRequestTimeout: 60000
    }
});

await agent.start('Help me write code');
```

### Using Observables with DI

The DI container now supports automatic agent observation. When you provide observer callbacks, the container automatically wraps the agent in an ObservableAgent proxy:

```typescript
import 'reflect-metadata';
import { getGlobalContainer } from './di/index.js';

const container = getGlobalContainer();
const agent = container.createAgent({
    agentPrompt: {
        capability: 'You are a helpful assistant',
        direction: 'Follow user instructions carefully'
    },
    observers: {
        onStatusChanged: (taskId, status) => {
            console.log(`Agent ${taskId} status changed to: ${status}`);
        },
        onMessageAdded: (taskId, message) => {
            console.log(`New message in task ${taskId}:`, message);
        },
        onTaskCompleted: (taskId) => {
            console.log(`Task ${taskId} completed!`);
        },
        onError: (error, context) => {
            console.error(`Error in ${context}:`, error);
        }
    }
});

await agent.start('Help me write code');
// All observer callbacks will be triggered automatically
```

**Note:** The container handles the ObservableAgent wrapping internally. You no longer need to manually call `createObservableAgent()` when using the DI container.

## Service Identifiers (TYPES)

All services are registered with the container using these identifiers:

```typescript
import { TYPES } from './di/index.js';

// Core Services
TYPES.Agent
TYPES.VirtualWorkspace
TYPES.IVirtualWorkspace  // Interface
TYPES.ApiClient
TYPES.MemoryModule
TYPES.IMemoryModule      // Interface

// Supporting Services
TYPES.SkillManager
TYPES.TurnMemoryStore
TYPES.ReflectiveThinkingProcessor

// Configuration
TYPES.AgentConfig
TYPES.AgentPrompt
TYPES.VirtualWorkspaceConfig
TYPES.MemoryModuleConfig
TYPES.ProviderSettings
TYPES.TaskId
TYPES.ObservableAgentCallbacks  // Observer callbacks for agent monitoring
```

## Container Scopes

### Transient Scope (Default)
- **Agent** - New instance per request
- **ApiClient** - New instance per request

### Request Scope
- **VirtualWorkspace** - Shared within an agent creation request
- **MemoryModule** - Shared within an agent creation request
- **TurnMemoryStore** - Shared within an agent creation request
- **ReflectiveThinkingProcessor** - Shared within an agent creation request

### Singleton Scope
- **SkillManager** - Shared across all agents

## Configuration

### Default Configuration

The container provides sensible defaults:

```typescript
// AgentConfig defaults
{
    apiRequestTimeout: 40000,
    maxRetryAttempts: 3,
    consecutiveMistakeLimit: 3
}

// MemoryModuleConfig defaults
{
    maxThinkingRounds: 3,
    thinkingTokenBudget: 10000,
    enableRecall: true,
    maxRecallContexts: 3,
    enableSummarization: true,
    maxRecalledMessages: 20,
    apiRequestTimeout: 40000
}

// ProviderSettings defaults
{
    apiProvider: 'zai',
    apiKey: process.env.GLM_API_KEY || '',
    apiModelId: 'glm-4.5'
}
```

### Custom Configuration

Pass custom configuration when creating an agent:

```typescript
const agent = container.createAgent({
    agentPrompt: { capability: 'Test', direction: 'Test' },
    config: {
        apiRequestTimeout: 60000,
        maxRetryAttempts: 5
    },
    apiConfiguration: {
        apiProvider: 'openai',
        apiKey: 'your-key',
        apiModelId: 'gpt-4'
    }
});
```

## Testing with DI

### Using the Container in Tests

```typescript
import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { getGlobalContainer, resetGlobalContainer } from './di/index.js';

describe('Agent Tests', () => {
    beforeEach(() => {
        resetGlobalContainer();
    });

    it('should create agent with container', () => {
        const container = getGlobalContainer();
        const agent = container.createAgent({
            agentPrompt: { capability: 'Test', direction: 'Test' }
        });
        expect(agent).toBeDefined();
    });
});
```

### Mocking Dependencies

```typescript
import 'reflect-metadata';
import { Container } from 'inversify';
import { TYPES } from './di/index.js';
import type { ApiClient } from './api-client/index.js';

// Create mock
const mockApiClient: ApiClient = {
    makeRequest: vi.fn().mockResolvedValue({
        toolCalls: [],
        textResponse: 'Mock response',
        requestTime: 100,
        tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 }
    })
};

// Create container with mock
const container = new AgentContainer();
const internalContainer = container.getContainer();
internalContainer.rebind<ApiClient>(TYPES.ApiClient).toConstantValue(mockApiClient);

// Create agent with mock
const agent = container.createAgent({
    agentPrompt: { capability: 'Test', direction: 'Test' }
});
```

## Architecture

### Dependency Graph

```
Agent
├── VirtualWorkspace (IVirtualWorkspace)
│   └── SkillManager
├── MemoryModule (IMemoryModule)
│   ├── ApiClient
│   ├── TurnMemoryStore
│   └── ReflectiveThinkingProcessor
│       └── ApiClient
└── ApiClient
```

### Interface vs Implementation

- Use **interfaces** (`IVirtualWorkspace`, `IMemoryModule`) for dependency injection
- Use **implementations** (`VirtualWorkspace`, `MemoryModule`) for concrete instances
- The container binds implementations to interfaces:
  ```typescript
  container.bind<IVirtualWorkspace>(TYPES.IVirtualWorkspace).to(VirtualWorkspace)
  container.bind<IMemoryModule>(TYPES.IMemoryModule).to(MemoryModule)
  ```

## Migration from Manual DI

### Before (Manual DI)

```typescript
import { Agent } from './agent/agent.js';
import { VirtualWorkspace } from './statefulContext/index.js';
import { ApiClientFactory } from './api-client/ApiClientFactory.js';

const workspace = new VirtualWorkspace({});
const apiClient = ApiClientFactory.create({
    apiProvider: 'zai',
    apiKey: process.env.GLM_API_KEY,
    apiModelId: 'glm-4.5'
});

const agent = new Agent(
    { apiRequestTimeout: 40000 },
    workspace,
    { capability: 'Test', direction: 'Test' },
    apiClient,
    undefined, // memoryModule
    'task-123'
);
```

### After (Container DI)

```typescript
import { getGlobalContainer } from './di/index.js';

const container = getGlobalContainer();
const agent = container.createAgent({
    agentPrompt: { capability: 'Test', direction: 'Test' },
    config: { apiRequestTimeout: 40000 },
    taskId: 'task-123'
});
```

## ObservableAgent Integration

The DI container now integrates with the ObservableAgent pattern. When you provide observer callbacks via the `observers` option, the container automatically wraps the agent in an ObservableAgent proxy.

### Before (Manual Wrapping)

```typescript
import { createObservableAgent } from './agent/ObservableAgent.js';
import { AgentFactory } from './agent/AgentFactory.js';

const agent = AgentFactory.create(workspace, agentPrompt);
const observableAgent = createObservableAgent(agent, {
    onStatusChanged: (taskId, status) => console.log(status),
    onMessageAdded: (taskId, message) => console.log(message)
});
```

### After (Container Integration)

```typescript
import { getGlobalContainer } from './di/index.js';

const container = getGlobalContainer();
const agent = container.createAgent({
    agentPrompt: { capability: 'Test', direction: 'Test' },
    observers: {
        onStatusChanged: (taskId, status) => console.log(status),
        onMessageAdded: (taskId, message) => console.log(message)
    }
});
// Agent is automatically wrapped - no manual wrapping needed
```

### Available Observer Callbacks

#### Task-level Callbacks

```typescript
interface ObservableAgentCallbacks {
    onMessageAdded?: (taskId: string, message: ApiMessage) => void;
    onStatusChanged?: (taskId: string, status: TaskStatus) => void;
    onTaskCompleted?: (taskId: string) => void;
    onTaskAborted?: (taskId: string, reason: string) => void;
    onMethodCall?: (methodName: string, args: any[]) => void;
    onPropertyChange?: (propertyName: string, newValue: any, oldValue: any) => void;
    onError?: (error: Error, context: string) => void;
}
```

#### Turn-level Callbacks

The ObservableAgent also supports detailed turn-based memory observation:

```typescript
interface ObservableAgentCallbacks {
    // Turn lifecycle
    onTurnCreated?: (turnId: string, turnNumber: number, workspaceContext: string, taskContext?: string) => void;
    onTurnStatusChanged?: (turnId: string, status: TurnStatus) => void;
    
    // Turn messages
    onTurnMessageAdded?: (turnId: string, message: ApiMessage) => void;
    
    // Thinking phase
    onThinkingPhaseCompleted?: (turnId: string, rounds: ThinkingRound[], tokensUsed: number) => void;
    
    // Tool calls
    onToolCallRecorded?: (turnId: string, toolName: string, success: boolean, result: any) => void;
    
    // Summary
    onTurnSummaryStored?: (turnId: string, summary: string, insights: string[]) => void;
    
    // Token usage
    onTurnActionTokensUpdated?: (turnId: string, tokens: number) => void;
}
```

#### Example: Observing Turn-level Events

```typescript
const agent = container.createAgent({
    agentPrompt: { capability: 'Test', direction: 'Test' },
    observers: {
        // Task-level
        onStatusChanged: (taskId, status) => console.log(`Task ${taskId} status: ${status}`),
        
        // Turn-level
        onTurnCreated: (turnId, turnNumber, workspaceContext, taskContext) => {
            console.log(`Turn ${turnNumber} created: ${turnId}`);
        },
        onThinkingPhaseCompleted: (turnId, rounds, tokensUsed) => {
            console.log(`Thinking phase: ${rounds.length} rounds, ${tokensUsed} tokens`);
        },
        onToolCallRecorded: (turnId, toolName, success, result) => {
            console.log(`Tool ${toolName} ${success ? 'succeeded' : 'failed'}`);
        }
    }
});
```

## Best Practices

1. **Always import 'reflect-metadata'** at the entry point of your application
2. **Use the container** for creating agents rather than manual construction
3. **Use observer callbacks via the container** instead of manual wrapping for cleaner code
4. **Reset the global container** between tests to ensure isolation
5. **Use interfaces** when injecting dependencies into your own classes
6. **Keep configuration in one place** - prefer passing config to container over setting individual services

## Troubleshooting

### Error: "No matching bindings found"

Make sure you've imported 'reflect-metadata' and the service is properly decorated with @injectable.

### Error: "Missing required @inject or @multiInject annotation"

Make sure constructor parameters have @inject(TYPES.ServiceName) decorators.

### Circular Dependencies

The container handles circular dependencies between VirtualWorkspace and SkillManager using lazy injection. If you encounter circular dependency issues in your own code, consider:
1. Using interfaces instead of concrete classes
2. Restructuring to avoid circular dependencies
3. Using @lazyInject() from inversify (advanced)
