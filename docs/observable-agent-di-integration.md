# ObservableAgent DI Integration

## Overview

This document describes the integration of the `ObservableAgent` pattern with the InversifyJS-based dependency injection (DI) container in the agent-lib library.

## Features

The ObservableAgent provides two levels of observation:

1. **Task-level callbacks** - Monitor high-level agent events (status, messages, completion)
2. **Turn-level callbacks** - Monitor detailed turn-based memory events (turn creation, thinking phase, tool calls)

## Motivation

Previously, the `ObservableAgent` wrapper was applied as a post-processing step after agent creation:

```typescript
// Old approach (manual wrapping)
const agent = container.createAgent({...});
const observableAgent = createObservableAgent(agent, observers);
```

With the migration to a DI-based architecture, this pattern felt inconsistent. The new approach integrates observation directly into the DI container, making it a first-class concern.

## Changes Made

### 1. Added ObservableAgentCallbacks to DI Types

**File:** [`libs/agent-lib/src/di/types.ts`](../libs/agent-lib/src/di/types.ts)

Added a new service identifier for observer callbacks:

```typescript
export const TYPES = {
    // ... existing types
    ObservableAgentCallbacks: Symbol('ObservableAgentCallbacks'),
};
```

### 2. Modified AgentContainer

**File:** [`libs/agent-lib/src/di/container.ts`](../libs/agent-lib/src/di/container.ts)

- Updated `AgentCreationOptions` to type `observers` as `ObservableAgentCallbacks`
- Modified `createAgent()` to automatically wrap agents when observers are provided
- Added observer binding in `setupAgentBindings()`

```typescript
public createAgent(options: AgentCreationOptions = {}): Agent {
    const agentContainer = new Container({ defaultScope: 'Transient' });
    this.setupAgentBindings(agentContainer, options);
    
    const agent = agentContainer.get<Agent>(TYPES.Agent);
    
    // Auto-wrap if observers provided
    if (options.observers && Object.keys(options.observers).length > 0) {
        return createObservableAgent(agent, options.observers);
    }
    
    return agent;
}
```

### 3. Simplified AgentFactory

**File:** [`libs/agent-lib/src/agent/AgentFactory.ts`](../libs/agent-lib/src/agent/AgentFactory.ts)

Removed manual wrapping logic - the container now handles it:

```typescript
// Old code removed:
// if (observers && Object.keys(observers).length > 0) {
//     return createObservableAgent(agent, observers);
// }

// New approach - pass observers to container
const agent = container.createAgent({
    // ... other options
    observers, // Container handles wrapping
});
```

### 4. Updated Documentation

**Files:**
- [`libs/agent-lib/src/agent/ObservableAgent.ts`](../libs/agent-lib/src/agent/ObservableAgent.ts) - Updated JSDoc comments
- [`libs/agent-lib/src/di/README.md`](../libs/agent-lib/src/di/README.md) - Added ObservableAgent integration section

## Usage Examples

### Creating an Agent with Observers (Recommended)

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
            console.log(`Agent ${taskId} status: ${status}`);
        },
        onMessageAdded: (taskId, message) => {
            console.log('New message:', message);
        },
        onTaskCompleted: (taskId) => {
            console.log(`Task ${taskId} completed!`);
        },
        onError: (error, context) => {
            console.error(`Error in ${context}:`, error);
        }
    }
});

// Agent is automatically wrapped - no manual wrapping needed
await agent.start('Help me write code');
```

### Using AgentFactory

```typescript
import { AgentFactory } from './agent/AgentFactory.js';

const agent = AgentFactory.create(
    workspace,
    agentPrompt,
    {
        observers: {
            onStatusChanged: (taskId, status) => console.log(status),
            onMessageAdded: (taskId, message) => console.log(message)
        }
    }
);
// Wrapping is handled by the container
```

### Manual Wrapping (Still Available)

For backward compatibility or special cases:

```typescript
import { createObservableAgent } from './agent/ObservableAgent.js';

const agent = createObservableAgent(existingAgent, {
    onStatusChanged: (taskId, status) => console.log(status)
});
```

### Observing Turn-level Events

The ObservableAgent now supports detailed turn-based memory observation:

```typescript
import { getGlobalContainer } from './di/index.js';

const container = getGlobalContainer();
const agent = container.createAgent({
    agentPrompt: { capability: 'Test', direction: 'Test' },
    observers: {
        // Task-level callbacks
        onStatusChanged: (taskId, status) => {
            console.log(`Task ${taskId} status: ${status}`);
        },
        
        // Turn-level callbacks
        onTurnCreated: (turnId, turnNumber, workspaceContext, taskContext) => {
            console.log(`Turn ${turnNumber} created: ${turnId}`);
        },
        onTurnStatusChanged: (turnId, status) => {
            console.log(`Turn ${turnId} status: ${status}`);
        },
        onTurnMessageAdded: (turnId, message) => {
            console.log(`Message added to turn ${turnId}:`, message.role);
        },
        onThinkingPhaseCompleted: (turnId, rounds, tokensUsed) => {
            console.log(`Thinking phase completed for ${turnId}: ${rounds.length} rounds, ${tokensUsed} tokens`);
        },
        onToolCallRecorded: (turnId, toolName, success, result) => {
            console.log(`Tool ${toolName} ${success ? 'succeeded' : 'failed'} in ${turnId}`);
        },
        onTurnSummaryStored: (turnId, summary, insights) => {
            console.log(`Summary stored for ${turnId}:`, summary);
        },
        onTurnActionTokensUpdated: (turnId, tokens) => {
            console.log(`Action phase used ${tokens} tokens for ${turnId}`);
        }
    }
});

await agent.start('Help me write code');
// All callbacks will be triggered automatically
```

## Benefits

1. **Consistency**: Observation is now handled by the DI container like all other cross-cutting concerns
2. **Simplicity**: No need to manually wrap agents - the container handles it automatically
3. **Type Safety**: Observer callbacks are properly typed through the DI system
4. **Flexibility**: Manual wrapping is still available for edge cases
5. **Testability**: Easier to test with and without observers

## Migration Guide

### Before

```typescript
const agent = AgentFactory.create(workspace, agentPrompt);
const observableAgent = createObservableAgent(agent, observers);
```

### After

```typescript
const agent = AgentFactory.create(workspace, agentPrompt, { observers });
// agent is already observable
```

## Testing

All existing DI container tests pass (41/41 tests). The integration maintains backward compatibility while providing a cleaner API.

## Related Files

- [`libs/agent-lib/src/di/types.ts`](../libs/agent-lib/src/di/types.ts) - Service identifiers
- [`libs/agent-lib/src/di/container.ts`](../libs/agent-lib/src/di/container.ts) - DI container implementation
- [`libs/agent-lib/src/agent/ObservableAgent.ts`](../libs/agent-lib/src/agent/ObservableAgent.ts) - Observable agent proxy
- [`libs/agent-lib/src/agent/AgentFactory.ts`](../libs/agent-lib/src/agent/AgentFactory.ts) - Agent factory facade
