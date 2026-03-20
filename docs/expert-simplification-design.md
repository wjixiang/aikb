# Expert System Simplification Design

## Overview

This document proposes a simplification of the current Expert system by removing the Expert wrapper layer and enabling direct Agent creation with different expert configurations.

## Current Architecture Analysis

### Current Structure

```
┌─────────────────────────────────────────────────────────────────┐
│                        ExpertAdapter                             │
│              (MessageBus → Expert bridge)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ExpertExecutor                              │
│            (Creates/manages Expert instances)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ExpertInstance                              │
│           (Thin wrapper around Agent)                            │
│  - expertId, instanceId                                          │
│  - Delegates lifecycle to Agent                                  │
│  - Persistence handling                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Agent                                   │
│  - VirtualWorkspace                                              │
│  - MemoryModule                                                  │
│  - Tool execution                                                │
│  - Mail-driven mode                                              │
└─────────────────────────────────────────────────────────────────┘
```

### Problems with Current Architecture

1. **Redundant Wrappers**: [`ExpertInstance`](libs/agent-lib/src/core/expert/ExpertInstance.ts:33) is essentially a thin proxy to Agent with minimal added functionality
2. **Unnecessary Complexity**: ExpertExecutor, ExpertRegistry, ExpertAdapter add layers without significant benefit
3. **Confusing Abstractions**: "Expert" vs "Agent" distinction is artificial - an Expert IS an Agent with specific configuration
4. **Maintenance Burden**: More code to maintain for the same functionality

### What ExpertInstance Actually Does

Looking at [`ExpertInstance`](libs/agent-lib/src/core/expert/ExpertInstance.ts:33):
- Holds `expertId`, `instanceId` (identity)
- Delegates `start()` → `agent.startMailDrivenMode()`
- Delegates `stop()` → `agent.abort()` + `agent.stopMailDrivenMode()`
- Handles persistence (export and save results)
- Provides `getStateSummary()` and `getArtifacts()`

All of these can be moved to Agent or handled by a factory.

---

## Proposed Architecture

### Core Principle

**Expert = Agent + ExpertConfig**

Instead of wrapping Agent in ExpertInstance, we directly create Agents with expert-specific configurations.

### New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    ExpertAgentFactory                            │
│         (Creates Agents with expert configs)                     │
│  - loadExpertConfig(url)                                         │
│  - createExpertAgent(config)                                     │
│  - startExpertAgent(agent)                                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                          Agent                                   │
│  - expertId, instanceId (new optional fields)                   │
│  - VirtualWorkspace                                              │
│  - MemoryModule                                                  │
│  - Tool execution                                                │
│  - Mail-driven mode                                              │
│  - Persistence (moved from ExpertInstance)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Detailed Design

### 1. Extend Agent with Expert Identity

Add optional expert identity fields to Agent:

```typescript
// agent.ts
export interface AgentExpertIdentity {
  expertId: string;
  instanceId: string;
}

// Add to Agent class
class Agent {
  // New optional expert identity
  private _expertIdentity?: AgentExpertIdentity;
  
  // New method to set expert identity
  setExpertIdentity(identity: AgentExpertIdentity): void {
    this._expertIdentity = identity;
  }
  
  get expertId(): string | undefined {
    return this._expertIdentity?.expertId;
  }
  
  get instanceId(): string | undefined {
    return this._expertIdentity?.instanceId;
  }
}
```

### 2. Create ExpertAgentFactory

A simplified factory that creates expert Agents directly:

```typescript
// ExpertAgentFactory.ts
export class ExpertAgentFactory {
  /**
   * Load expert config from directory (using createExpertConfig pattern)
   */
  static async loadExpertConfig(expertDir: string): Promise<ExpertConfig> {
    // Load config.json, sop.md, capability.md from directory
  }
  
  /**
   * Create an Agent with expert configuration
   */
  static createExpertAgent(
    config: ExpertConfig,
    options?: ExpertAgentOptions
  ): Agent {
    // Create VirtualWorkspace with expert's components
    const workspace = ExpertAgentFactory.createWorkspace(config);
    
    // Create Agent with expert's SOP and settings
    const agent = AgentFactory.create(workspace, config.sop, {
      config: config.agentConfig,
      apiConfiguration: config.apiConfiguration,
      taskId: `expert-${config.expertId}-${options?.instanceId || randomUUID()}`,
    });
    
    // Set expert identity
    agent.setExpertIdentity({
      expertId: config.expertId,
      instanceId: options?.instanceId || randomUUID(),
    });
    
    // Register components
    await ExpertAgentFactory.registerComponents(agent, config);
    
    return agent;
  }
  
  /**
   * Start agent in mail-driven mode with persistence
   */
  static async startExpertAgent(
    agent: Agent,
    mailConfig?: ExpertMailConfig,
    persistenceStore?: IExpertPersistenceStore
  ): Promise<void> {
    // Setup persistence if provided
    if (persistenceStore) {
      agent.setPersistenceStore(persistenceStore);
    }
    
    // Start mail-driven mode
    if (mailConfig?.enabled) {
      await agent.startMailDrivenMode(mailConfig.pollInterval || 30000);
    }
  }
}
```

### 3. Simplified ExpertConfig

Keep ExpertConfig but mark it as "Agent Configuration Schema":

```typescript
// types.ts
/**
 * ExpertConfig - Configuration for creating specialized Agents
 * 
 * This is NOT a separate class - it's a configuration schema
 * used to create Agents with specific capabilities.
 */
export interface ExpertConfig {
  // Identity
  expertId: string;
  displayName: string;
  description: string;
  
  // Agent configuration
  sop: string;                    // Agent's system prompt/SOP
  components: ExpertComponentDefinition[];
  apiConfiguration?: Partial<ProviderSettings>;
  agentConfig?: Partial<AgentConfig>;
  
  // Optional features
  mailConfig?: ExpertMailConfig;
  fileSystemConfig?: ExpertFileSystemConfig;
  virtualWorkspaceConfig?: Partial<VirtualWorkspaceConfig>;
  
  // Metadata
  capabilities?: string[];
  whenToUse?: string;
  triggers?: string[];
}
```

### 4. Migration Path

#### Phase 1: Add Expert Identity to Agent
- Add `expertId`, `instanceId` optional fields to Agent
- Add `setExpertIdentity()` method
- Add persistence support methods to Agent

#### Phase 2: Create ExpertAgentFactory
- Create new `ExpertAgentFactory` class
- Implement `loadExpertConfig()`, `createExpertAgent()`, `startExpertAgent()`

#### Phase 3: Update Usage Sites
- Update `apps/ebm-agent/src/demo-expert.ts` to use new pattern
- Update any other Expert usage sites

#### Phase 4: Deprecate Old Classes
- Mark `ExpertInstance` as deprecated
- Mark `ExpertExecutor` as deprecated
- Mark `ExpertAdapter` as deprecated
- Keep for backward compatibility but recommend migration

#### Phase 5: Remove Old Classes (Future)
- After all usage migrated, remove old classes

---

## New Usage Pattern

### Before (Current)

```typescript
// demo-expert.ts (current)
const registry = new ExpertRegistry();
const executor = new ExpertExecutor(registry, undefined);

config.apiConfiguration = { ... };
config.mailConfig = { ... };

executor.registerExpert(config);
await executor.startExpert(config.expertId);
```

### After (Simplified)

```typescript
// demo-expert.ts (new)
import { ExpertAgentFactory } from 'agent-lib';
import config from '../experts/pubmed-retrieve';

// Apply runtime configuration
config.apiConfiguration = {
  apiProvider: 'zai',
  apiKey: process.env.GLM_API_KEY,
  apiModelId: 'glm-4.5',
};
config.mailConfig = {
  enabled: true,
  baseUrl: process.env.MAILBOX_URL,
  pollInterval: 10000,
};

// Create and start expert agent directly
const agent = await ExpertAgentFactory.createExpertAgent(config);
await ExpertAgentFactory.startExpertAgent(agent, config.mailConfig);

// Graceful shutdown
process.on('SIGINT', async () => {
  await agent.stopMailDrivenMode();
  process.exit(0);
});
```

---

## Components to Modify

### 1. `libs/agent-lib/src/core/agent/agent.ts`
- Add optional `_expertIdentity` field
- Add `setExpertIdentity()`, `get expertId()`, `get instanceId()` methods
- Add optional persistence store support

### 2. `libs/agent-lib/src/core/agent/AgentFactory.ts`
- Add support for expert identity in factory options

### 3. New: `libs/agent-lib/src/core/expert/ExpertAgentFactory.ts`
- New simplified factory for creating expert Agents

### 4. `libs/agent-lib/src/core/expert/index.ts`
- Export new `ExpertAgentFactory`
- Keep old exports for backward compatibility with deprecation notices

### 5. `apps/ebm-agent/src/demo-expert.ts`
- Update to use new pattern

---

## Benefits

1. **Simplicity**: Fewer layers, clearer code flow
2. **Directness**: Create Agents directly with expert config
3. **Maintainability**: Less code to maintain
4. **Flexibility**: Easier to customize individual Agents
5. **Clarity**: "Expert" is clearly a configured Agent, not a separate entity

---

## Backward Compatibility

- Keep `ExpertInstance`, `ExpertExecutor`, `ExpertRegistry`, `ExpertAdapter` for now
- Add `@deprecated` JSDoc comments pointing to new pattern
- Remove in future major version

---

## Implementation Checklist

- [ ] Add expert identity support to Agent class
- [ ] Create ExpertAgentFactory
- [ ] Update demo-expert.ts as reference implementation
- [ ] Add deprecation notices to old classes
- [ ] Update documentation
- [ ] Add migration guide for existing code
