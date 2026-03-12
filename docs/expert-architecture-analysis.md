# Expert Architecture Analysis: Skills to Multi-Expert Migration

## Overview

This document provides a comprehensive analysis of the current Expert architecture and the migration path from the existing Skills-based pattern to a multi-expert pattern.

---

## 1. Current Skills Architecture

### 1.1 Core Components

The Skills architecture consists of the following key components:

#### SkillManager ([`SkillManager.ts`](../libs/agent-lib/src/skills/SkillManager.ts))
- **Purpose**: Manages skill registration, activation, and lifecycle
- **Key Features**:
  - Single active skill at a time
  - Manages component activation/deactivation
  - Supports DI token resolution for components
  - Provides skill summaries for LLM selection

#### Skill Definition ([`types.ts`](../libs/agent-lib/src/skills/types.ts))
```typescript
interface Skill {
    name: string;
    displayName: string;
    description: string;
    whenToUse?: string;
    triggers?: string[];
    prompt: {
        capability: string;
        direction: string;
    };
    components?: ComponentDefinition[];
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
    onComponentActivate?: (component: ToolComponent) => Promise<void>;
    onComponentDeactivate?: (component: ToolComponent) => Promise<void>;
}
```

#### ComponentDefinition
```typescript
interface ComponentDefinition {
    componentId: string;
    displayName: string;
    description: string;
    instance: ToolComponent | (() => ToolComponent) | (() => Promise<ToolComponent>) | symbol;
}
```

### 1.2 Integration Points

#### VirtualWorkspace Integration
- [`VirtualWorkspace`](../libs/agent-lib/src/statefulContext/virtualWorkspace.ts) contains a `SkillManager` instance
- Skills are registered during workspace initialization
- Active skill's components are registered in the workspace
- Skill tools are made available through `ToolManager`

#### Agent Integration
- Agent accesses skills through `workspace.getSkillManager()`
- Agent can activate/deactivate skills dynamically
- Skill prompts enhance the agent's system prompt

### 1.3 Current Limitations

1. **Single Active Skill**: Only one skill can be active at a time
2. **No Parallel Execution**: Skills cannot execute tasks in parallel
3. **No Task Decomposition**: No built-in mechanism for breaking down complex tasks
4. **Shared Context**: All skills share the same workspace and memory
5. **No Result Aggregation**: No mechanism to combine results from multiple skills

---

## 2. New Expert Architecture

### 2.1 Core Components

The Expert architecture introduces the following key components:

#### ExpertRegistry ([`ExpertRegistry.ts`](../libs/agent-lib/src/expert/ExpertRegistry.ts))
- **Purpose**: Manages all available Expert configurations
- **Key Features**:
  - Register and retrieve expert configurations
  - Find experts by capability or trigger
  - List all available experts

#### ExpertExecutor ([`ExpertExecutor.ts`](../libs/agent-lib/src/expert/ExpertExecutor.ts))
- **Purpose**: Creates, manages, and executes Expert instances
- **Key Features**:
  - Creates Expert instances with independent Agent instances
  - Manages Expert lifecycle (create, activate, suspend, resume, dispose)
  - Executes tasks on Experts
  - Collects artifacts from all Experts

#### ExpertInstance ([`ExpertInstance.ts`](../libs/agent-lib/src/expert/ExpertInstance.ts))
- **Purpose**: Represents a running Expert with its own Agent
- **Key Features**:
  - Independent VirtualWorkspace
  - Independent MemoryModule
  - Independent execution loop
  - Status tracking (idle, ready, running, completed, failed, suspended)
  - Artifact collection

#### ExpertOrchestrator ([`ExpertOrchestrator.ts`](../libs/agent-lib/src/expert/ExpertOrchestrator.ts))
- **Purpose**: Orchestrates multiple Experts for complex tasks
- **Key Features**:
  - Task decomposition
  - Multiple scheduling strategies (sequential, parallel, dependency-ordered, conditional)
  - Result aggregation
  - Context passing between Experts

### 2.2 Expert Configuration

```typescript
interface ExpertConfig {
    expertId: string;
    displayName: string;
    description: string;
    whenToUse?: string;
    triggers?: string[];
    responsibilities: string;
    capabilities: string[];
    components: ExpertComponentDefinition[];
    prompt: {
        capability: string;
        direction: string;
    };
    systemPrompt?: string;
    autoActivate?: boolean;
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
    onComponentActivate?: (component: ToolComponent) => Promise<void>;
    onComponentDeactivate?: (component: ToolComponent) => Promise<void>;
}
```

### 2.3 Key Differences from Skills

| Aspect | Skills | Experts |
|--------|--------|---------|
| **Scope** | Single active skill at a time | Multiple experts can coexist |
| **Execution** | Sequential within single agent | Parallel or sequential across multiple agents |
| **Context** | Shared workspace and memory | Independent workspace and memory per expert |
| **Lifecycle** | Activate/deactivate on single agent | Create/activate/suspend/resume/dispose per expert |
| **Orchestration** | Manual (LLM decides) | Built-in orchestrator with strategies |
| **Artifacts** | None | Explicit artifact collection and sharing |
| **Task Model** | Implicit (LLM-driven) | Explicit task decomposition |

---

## 3. Migration Path

### 3.1 Phase 1: Coexistence (Current State)

**Goal**: Allow both Skills and Experts to coexist during transition.

**Approach**:
- Keep existing SkillManager and Expert systems separate
- VirtualWorkspace maintains both SkillManager and ExpertRegistry
- Agent can use either system based on task requirements

**Benefits**:
- Zero breaking changes
- Gradual migration of skills to experts
- Allows testing expert system in parallel

### 3.2 Phase 2: Skill-to-Expert Adapter

**Goal**: Create an adapter that allows Skills to be used as Experts.

**Approach**:
```typescript
class SkillToExpertAdapter {
    convertSkillToExpert(skill: Skill): ExpertConfig {
        return {
            expertId: skill.name,
            displayName: skill.displayName,
            description: skill.description,
            whenToUse: skill.whenToUse,
            triggers: skill.triggers,
            responsibilities: skill.description,
            capabilities: this.extractCapabilities(skill.prompt.capability),
            components: skill.components || [],
            prompt: skill.prompt,
            onActivate: skill.onActivate,
            onDeactivate: skill.onDeactivate,
            onComponentActivate: skill.onComponentActivate,
            onComponentDeactivate: skill.onComponentDeactivate
        };
    }
}
```

**Benefits**:
- Reuses existing skill definitions
- Gradual migration without rewriting skills
- Skills can be orchestrated like experts

### 3.3 Phase 3: Expert-First Architecture

**Goal**: Make Experts the primary pattern, deprecate Skills.

**Approach**:
- New features implemented as Experts only
- Existing skills gradually migrated to Experts
- SkillManager becomes a thin wrapper around ExpertRegistry

**Benefits**:
- Unified architecture
- Simplified codebase
- Better separation of concerns

### 3.4 Phase 4: Complete Migration

**Goal**: Remove Skills architecture entirely.

**Approach**:
- All skills migrated to Experts
- SkillManager removed
- VirtualWorkspace simplified to use ExpertRegistry only

**Benefits**:
- Cleaner architecture
- Reduced maintenance burden
- Consistent patterns across codebase

---

## 4. Implementation Considerations

### 4.1 ExpertInstance Implementation Status

The current [`ExpertInstance.ts`](../libs/agent-lib/src/expert/ExpertInstance.ts) has several TODO items:

1. **Logger Access**: Currently uses `(this.agent as any).logger` - should be properly injected
2. **Agent Creation**: [`ExpertExecutor.createAgent()`](../libs/agent-lib/src/expert/ExpertExecutor.ts:92) is not fully implemented
3. **DI Integration**: Container is optional but not fully utilized

### 4.2 ExpertExecutor.createAgent() Implementation

The current implementation throws an error. It needs to:

```typescript
private createAgent(config: ExpertConfig): Agent {
    // 1. Create VirtualWorkspace
    const workspace = new VirtualWorkspace({
        container: this.container,
        skills: [], // Experts don't use skills
        components: config.components
    });

    // 2. Create Agent with workspace
    const agentConfig: AgentConfig = {
        // Configure agent with expert's system prompt
        systemPrompt: this.buildSystemPrompt(config)
    };

    const agent = new Agent(
        this.apiClient,
        this.memoryModule,
        this.thinkingModule,
        this.actionModule,
        this.taskModule,
        this.toolManager,
        workspace,
        agentConfig,
        this.logger
    );

    return agent;
}
```

### 4.3 Dependency Injection Integration

The Expert system needs proper DI integration:

1. **Container Injection**: ExpertExecutor should receive the Container
2. **Component Resolution**: Use DI tokens for component instances
3. **Expert Registration**: Register Experts as DI services

```typescript
// In DI container setup
container.bind<IExpertExecutor>(TYPES.ExpertExecutor).to(ExpertExecutor);
container.bind<IExpertRegistry>(TYPES.ExpertRegistry).to(ExpertRegistry);
container.bind<ExpertOrchestrator>(TYPES.ExpertOrchestrator).to(ExpertOrchestrator);
```

### 4.4 VirtualWorkspace Modifications

VirtualWorkspace needs to support Expert integration:

```typescript
interface VirtualWorkspaceOptions {
    container?: Container;
    skills?: Skill[];
    components?: ComponentDefinition[];
    expertMode?: boolean; // New flag for expert mode
}

class VirtualWorkspace {
    private expertMode: boolean;
    private expertRegistry?: ExpertRegistry;

    constructor(options: VirtualWorkspaceOptions) {
        this.expertMode = options.expertMode || false;
        // ... existing initialization
    }

    getExpertRegistry(): ExpertRegistry | undefined {
        return this.expertRegistry;
    }
}
```

### 4.5 Agent Modifications

Agent needs to support Expert orchestration:

```typescript
class Agent {
    private expertExecutor?: IExpertExecutor;
    private expertOrchestrator?: ExpertOrchestrator;

    async executeWithExperts(request: ExpertOrchestrationRequest): Promise<ExpertOrchestrationResult> {
        if (!this.expertOrchestrator) {
            throw new Error('Expert orchestration not enabled');
        }
        return await this.expertOrchestrator.orchestrate(request);
    }
}
```

---

## 5. Migration Strategy for Existing Skills

### 5.1 Simple Skills (No Components)

**Example**: [`pico-extraction.skill.ts`](../libs/agent-lib/src/skills/builtin/pico-extraction.skill.ts)

**Migration**:
```typescript
// Before (Skill)
export default defineSkill({
    name: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Extract PICO elements from clinical studies',
    capabilities: ['Extract Population', 'Extract Intervention', ...],
    workDirection: '...'
});

// After (Expert)
export default defineExpert({
    expertId: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Extract PICO elements from clinical studies',
    responsibilities: 'Extract PICO elements from clinical studies',
    capabilities: ['Extract Population', 'Extract Intervention', ...],
    prompt: {
        capability: '...',
        direction: '...'
    }
});
```

### 5.2 Skills with Components

**Example**: [`paper-analysis-with-components.skill.ts`](../libs/agent-lib/src/skills/builtin/paper-analysis-with-components.skill.ts)

**Migration**:
```typescript
// Before (Skill)
export default defineSkill({
    name: 'paper-analysis-with-components',
    displayName: 'Paper Analysis (with Components)',
    description: 'Advanced paper analysis skill',
    capabilities: ['Calculate complexity', 'Extract citations', ...],
    workDirection: '...',
    components: [
        createComponentDefinition('paper-analyzer', 'Paper Analyzer', '...', TYPES.PaperAnalysisComponent)
    ]
});

// After (Expert)
export default defineExpert({
    expertId: 'paper-analysis-with-components',
    displayName: 'Paper Analysis (with Components)',
    description: 'Advanced paper analysis expert',
    responsibilities: 'Analyze academic papers for complexity, citations, and comparisons',
    capabilities: ['Calculate complexity', 'Extract citations', ...],
    components: [
        createExpertComponentDefinition('paper-analyzer', 'Paper Analyzer', '...', TYPES.PaperAnalysisComponent)
    ],
    prompt: {
        capability: '...',
        direction: '...'
    }
});
```

### 5.3 Complex Skills with Detailed Workflows

**Example**: [`meta-analysis-article-retrieval.skill.ts`](../libs/agent-lib/src/skills/builtin/meta-analysis-article-retrieval.skill.ts)

**Migration Strategy**:
- Keep the detailed workflow in `systemPrompt`
- Consider breaking down into multiple experts for orchestration
- Use ExpertOrchestrator for complex multi-phase workflows

```typescript
// Option 1: Single Expert with detailed systemPrompt
export default defineExpert({
    expertId: 'meta-analysis-article-retrieval',
    displayName: 'Meta-Analysis Article Retrieval',
    description: 'Systematic literature retrieval for meta-analysis',
    responsibilities: 'Conduct systematic literature searches for meta-analysis',
    capabilities: ['Decompose questions', 'Design search strategies', ...],
    systemPrompt: `You are conducting the literature retrieval phase...`,
    prompt: {
        capability: '...',
        direction: '...'
    }
});

// Option 2: Multiple Experts with Orchestration
const questionDecompositionExpert = defineExpert({ ... });
const searchStrategyExpert = defineExpert({ ... });
const retrievalExpert = defineExpert({ ... });

// Orchestrate them
const orchestrationRequest: ExpertOrchestrationRequest = {
    task: 'Conduct meta-analysis article retrieval',
    strategy: 'sequential',
    expertTasks: [
        { expertId: 'question-decomposition', task: { ... } },
        { expertId: 'search-strategy', task: { ... } },
        { expertId: 'retrieval', task: { ... } }
    ]
};
```

---

## 6. Testing Strategy

### 6.1 Unit Tests

1. **ExpertRegistry Tests**
   - Register and retrieve experts
   - Find by capability/trigger
   - List experts

2. **ExpertExecutor Tests**
   - Create expert instances
   - Execute tasks
   - Lifecycle management

3. **ExpertInstance Tests**
   - State transitions
   - Artifact collection
   - Error handling

4. **ExpertOrchestrator Tests**
   - Sequential execution
   - Parallel execution
   - Conditional execution
   - Context passing

### 6.2 Integration Tests

1. **Skill-to-Expert Adapter Tests**
   - Convert skills to experts
   - Verify behavior equivalence

2. **Multi-Expert Workflow Tests**
   - End-to-end task execution
   - Result aggregation
   - Artifact sharing

3. **VirtualWorkspace Integration Tests**
   - Expert mode vs skill mode
   - Component registration
   - Tool availability

### 6.3 Migration Tests

1. **Backward Compatibility Tests**
   - Existing skills still work
   - No breaking changes

2. **Parallel Operation Tests**
   - Skills and experts coexist
   - No conflicts

---

## 7. Recommendations

### 7.1 Immediate Actions

1. **Complete ExpertExecutor.createAgent()**
   - Implement proper Agent creation with DI
   - Create VirtualWorkspace with expert components
   - Configure system prompt

2. **Fix ExpertInstance Logger**
   - Properly inject ILogger
   - Remove `(this.agent as any)` workaround

3. **Create Expert Definition Builder**
   - Similar to `SkillDefinition` for type-safe expert creation
   - Helper functions for common patterns

### 7.2 Short-term Goals (1-2 weeks)

1. **Implement Skill-to-Expert Adapter**
   - Convert existing skills to experts
   - Test behavior equivalence

2. **Add Expert Mode to VirtualWorkspace**
   - Support expert mode flag
   - Integrate ExpertRegistry

3. **Create Example Experts**
   - Migrate 2-3 existing skills to experts
   - Demonstrate multi-expert orchestration

### 7.3 Medium-term Goals (1-2 months)

1. **Migrate All Skills to Experts**
   - Prioritize high-usage skills
   - Maintain backward compatibility

2. **Implement ExpertOrchestrator Strategies**
   - Complete dependency-ordered execution
   - Enhance conditional execution

3. **Add Expert Monitoring**
   - Track expert performance
   - Collect metrics

### 7.4 Long-term Goals (3+ months)

1. **Deprecate Skills**
   - Mark as deprecated
   - Provide migration guide

2. **Remove Skills Architecture**
   - After migration complete
   - Simplify codebase

3. **Advanced Expert Features**
   - Expert communication protocols
   - Dynamic expert creation
   - Expert learning and adaptation

---

## 8. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing functionality | High | Maintain backward compatibility during transition |
| Performance degradation | Medium | Benchmark expert vs skill performance |
| Increased complexity | Medium | Clear documentation and examples |
| DI integration issues | Medium | Thorough testing of DI resolution |
| Migration effort | High | Gradual migration, prioritize high-value skills |

---

## 9. Conclusion

The Expert architecture provides significant advantages over the Skills-based pattern:

1. **Parallel Execution**: Multiple experts can work simultaneously
2. **Independent Contexts**: Each expert has isolated workspace and memory
3. **Built-in Orchestration**: Explicit task decomposition and result aggregation
4. **Better Scalability**: Can handle complex multi-step workflows

The migration should be approached gradually, with coexistence as the initial phase. This allows for testing and validation without breaking existing functionality.

---

## Appendix: File Reference

### Expert Architecture Files
- [`ExpertExecutor.ts`](../libs/agent-lib/src/expert/ExpertExecutor.ts) - Expert creation and execution
- [`ExpertInstance.ts`](../libs/agent-lib/src/expert/ExpertInstance.ts) - Running expert with Agent
- [`ExpertOrchestrator.ts`](../libs/agent-lib/src/expert/ExpertOrchestrator.ts) - Multi-expert orchestration
- [`ExpertRegistry.ts`](../libs/agent-lib/src/expert/ExpertRegistry.ts) - Expert configuration management
- [`types.ts`](../libs/agent-lib/src/expert/types.ts) - Type definitions

### Skills Architecture Files
- [`SkillManager.ts`](../libs/agent-lib/src/skills/SkillManager.ts) - Skill lifecycle management
- [`SkillDefinition.ts`](../libs/agent-lib/src/skills/SkillDefinition.ts) - Skill definition builder
- [`types.ts`](../libs/agent-lib/src/skills/types.ts) - Type definitions

### Integration Files
- [`VirtualWorkspace.ts`](../libs/agent-lib/src/statefulContext/virtualWorkspace.ts) - Workspace with SkillManager
- [`Agent.ts`](../libs/agent-lib/src/agent/agent.ts) - Agent using skills
