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

## Best Practices

1. **Always import 'reflect-metadata'** at the entry point of your application
2. **Use the container** for creating agents rather than manual construction
3. **Reset the global container** between tests to ensure isolation
4. **Use interfaces** when injecting dependencies into your own classes
5. **Keep configuration in one place** - prefer passing config to container over setting individual services

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
