# Expert Migration Guide

This guide provides practical steps and code examples for migrating from Skills-based to multi-expert pattern.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Creating Your First Expert](#creating-your-first-expert)
3. [Migrating Existing Skills](#migrating-existing-skills)
4. [Using ExpertOrchestrator](#using-expertorchestrator)
5. [Advanced Patterns](#advanced-patterns)
6. [Testing Strategies](#testing-strategies)
7. [Common Pitfalls](#common-pitfalls)

---

## Quick Start

### 1. Define an Expert

```typescript
// experts/paper-analysis.expert.ts
import { defineExpert, createExpertComponentDefinition } from '../expert/ExpertDefinition.js';
import { TYPES } from '../di/types.js';

export default defineExpert({
    expertId: 'paper-analysis',
    displayName: 'Paper Analysis',
    description: 'Analyzes academic papers for complexity, citations, and comparisons',
    responsibilities: 'Analyze academic papers to extract insights, calculate complexity metrics, and identify key citations',
    capabilities: [
        'Calculate paper complexity scores across multiple dimensions',
        'Extract and rank key citations from papers',
        'Compare two papers side-by-side'
    ],
    components: [
        createExpertComponentDefinition(
            'paper-analyzer',
            'Paper Analyzer',
            'Analyzes academic papers for complexity, citations, and comparisons',
            TYPES.PaperAnalysisComponent
        )
    ],
    prompt: {
        capability: 'You have the following capabilities:\n- Calculate paper complexity\n- Extract key citations\n- Compare papers',
        direction: 'When analyzing papers, follow this workflow:\n1. Use calculate_complexity to get metrics\n2. Use extract_key_citations to identify references\n3. Use compare_papers for comparative analysis'
    },
    systemPrompt: 'You are an expert in academic paper analysis. Provide detailed, well-structured insights.',
    autoActivate: true
});
```

### 2. Register Experts

```typescript
// main.ts
import { ExpertRegistry } from './expert/ExpertRegistry.js';
import { ExpertExecutor } from './expert/ExpertExecutor.js';
import { ExpertOrchestrator } from './expert/ExpertOrchestrator.js';
import paperAnalysisExpert from './experts/paper-analysis.expert.js';

// Create registry
const registry = new ExpertRegistry();

// Register expert
registry.register(paperAnalysisExpert);

// Create executor
const executor = new ExpertExecutor(registry);

// Create orchestrator
const orchestrator = new ExpertOrchestrator(executor, registry);
```

### 3. Execute a Task

```typescript
// Single expert execution
const result = await executor.execute({
    expertId: 'paper-analysis',
    task: {
        taskId: 'task-001',
        description: 'Analyze this paper for complexity and key citations',
        input: { paperContent: '...' },
        expectedOutputs: ['complexityScore', 'keyCitations']
    }
});

console.log(result.summary);
console.log(result.output);
```

---

## Creating Your First Expert

### Expert Definition Builder

First, create an `ExpertDefinition` helper similar to `SkillDefinition`:

```typescript
// expert/ExpertDefinition.ts
import type { ExpertConfig, ExpertComponentDefinition } from './types.js';

export interface ExpertDefinitionConfig {
    expertId: string;
    displayName: string;
    description: string;
    whenToUse?: string;
    triggers?: string[];
    responsibilities: string;
    capabilities: string[];
    components?: ExpertComponentDefinition[];
    prompt: {
        capability: string;
        direction: string;
    };
    systemPrompt?: string;
    autoActivate?: boolean;
    onActivate?: () => Promise<void>;
    onDeactivate?: () => Promise<void>;
    onComponentActivate?: (component: any) => Promise<void>;
    onComponentDeactivate?: (component: any) => Promise<void>;
    version?: string;
    category?: string;
    tags?: string[];
}

export class ExpertDefinition {
    private config: ExpertDefinitionConfig;

    constructor(config: ExpertDefinitionConfig) {
        this.config = config;
    }

    build(): ExpertConfig {
        return {
            expertId: this.config.expertId,
            displayName: this.config.displayName,
            description: this.config.description,
            whenToUse: this.config.whenToUse,
            triggers: this.config.triggers,
            responsibilities: this.config.responsibilities,
            capabilities: this.config.capabilities,
            components: this.config.components || [],
            prompt: this.config.prompt,
            systemPrompt: this.config.systemPrompt,
            autoActivate: this.config.autoActivate,
            onActivate: this.config.onActivate,
            onDeactivate: this.config.onDeactivate,
            onComponentActivate: this.config.onComponentActivate,
            onComponentDeactivate: this.config.onComponentDeactivate
        };
    }

    static create(config: ExpertDefinitionConfig): ExpertDefinition {
        return new ExpertDefinition(config);
    }
}

export function defineExpert(config: ExpertDefinitionConfig): ExpertConfig {
    return new ExpertDefinition(config).build();
}

export function createExpertComponentDefinition(
    componentId: string,
    displayName: string,
    description: string,
    instanceOrFactory: any | (() => any)
): ExpertComponentDefinition {
    return {
        componentId,
        displayName,
        description,
        instance: instanceOrFactory
    };
}
```

### Expert without Components

```typescript
// experts/text-processing.expert.ts
import { defineExpert } from '../expert/ExpertDefinition.js';

export default defineExpert({
    expertId: 'text-processing',
    displayName: 'Text Processing',
    description: 'Processes and analyzes text data',
    responsibilities: 'Process text to extract insights, perform sentiment analysis, and summarize content',
    capabilities: [
        'Extract key information from text',
        'Perform sentiment analysis',
        'Generate text summaries'
    ],
    prompt: {
        capability: 'You can process and analyze text data to extract insights.',
        direction: 'When processing text, focus on accuracy and clarity. Provide structured output with clear sections.'
    },
    systemPrompt: 'You are a text processing expert. Analyze text thoroughly and provide actionable insights.'
});
```

### Expert with Components

```typescript
// experts/database-query.expert.ts
import { defineExpert, createExpertComponentDefinition } from '../expert/ExpertDefinition.js';
import { TYPES } from '../di/types.js';

export default defineExpert({
    expertId: 'database-query',
    displayName: 'Database Query',
    description: 'Executes database queries and analyzes results',
    responsibilities: 'Execute database queries safely and analyze results to provide insights',
    capabilities: [
        'Execute SQL queries',
        'Analyze query results',
        'Optimize query performance'
    ],
    components: [
        createExpertComponentDefinition(
            'database-connector',
            'Database Connector',
            'Connects to and queries databases',
            TYPES.DatabaseConnector
        )
    ],
    prompt: {
        capability: 'You can execute database queries and analyze results.',
        direction: 'Always validate queries before execution. Analyze results thoroughly and provide insights.'
    },
    systemPrompt: 'You are a database expert. Ensure query safety and provide meaningful analysis of results.',
    onActivate: async () => {
        console.log('[DatabaseQueryExpert] Activated');
    },
    onDeactivate: async () => {
        console.log('[DatabaseQueryExpert] Deactivated');
    }
});
```

---

## Migrating Existing Skills

### Skill to Expert Mapping

| Skill Property | Expert Property | Notes |
|----------------|-----------------|-------|
| `name` | `expertId` | Direct mapping |
| `displayName` | `displayName` | Direct mapping |
| `description` | `description` | Direct mapping |
| `whenToUse` | `whenToUse` | Direct mapping |
| `triggers` | `triggers` | Direct mapping |
| `prompt.capability` | `prompt.capability` | Direct mapping |
| `prompt.direction` | `prompt.direction` | Direct mapping |
| `components` | `components` | Direct mapping |
| `onActivate` | `onActivate` | Direct mapping |
| `onDeactivate` | `onDeactivate` | Direct mapping |
| `onComponentActivate` | `onComponentActivate` | Direct mapping |
| `onComponentDeactivate` | `onComponentDeactivate` | Direct mapping |
| N/A | `responsibilities` | New field - describe expert's role |
| N/A | `systemPrompt` | New field - additional system prompt |
| N/A | `autoActivate` | New field - auto-activation flag |

### Migration Example: Simple Skill

**Before (Skill):**

```typescript
// skills/builtin/pico-extraction.skill.ts
import { defineSkill } from '../SkillDefinition.js';

export default defineSkill({
    name: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Extract PICO elements from clinical studies',
    whenToUse: 'Use this skill when you need to extract Population, Intervention, Comparison, and Outcome elements from clinical studies.',
    capabilities: [
        'Extract Population information',
        'Extract Intervention details',
        'Extract Comparison groups',
        'Extract Outcome measures'
    ],
    workDirection: 'Extract PICO elements systematically. Provide structured output for each element.',
    version: '1.0.0'
});
```

**After (Expert):**

```typescript
// experts/builtin/pico-extraction.expert.ts
import { defineExpert } from '../../expert/ExpertDefinition.js';

export default defineExpert({
    expertId: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Extract PICO elements from clinical studies',
    whenToUse: 'Use this expert when you need to extract Population, Intervention, Comparison, and Outcome elements from clinical studies.',
    responsibilities: 'Extract PICO elements systematically from clinical studies to provide structured data for analysis',
    capabilities: [
        'Extract Population information',
        'Extract Intervention details',
        'Extract Comparison groups',
        'Extract Outcome measures'
    ],
    prompt: {
        capability: 'You have the following capabilities:\n- Extract Population information\n- Extract Intervention details\n- Extract Comparison groups\n- Extract Outcome measures',
        direction: 'Extract PICO elements systematically. Provide structured output for each element with clear labels.'
    },
    systemPrompt: 'You are a PICO extraction expert. Carefully analyze clinical studies and extract accurate PICO elements.',
    version: '1.0.0'
});
```

### Migration Example: Skill with Components

**Before (Skill):**

```typescript
// skills/builtin/paper-analysis-with-components.skill.ts
import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import { TYPES } from '../../di/types.js';

export default defineSkill({
    name: 'paper-analysis-with-components',
    displayName: 'Paper Analysis (with Components)',
    description: 'Advanced paper analysis skill that manages multiple components',
    capabilities: [
        'Calculate paper complexity scores across multiple dimensions',
        'Extract and rank key citations from papers',
        'Compare two papers side-by-side'
    ],
    workDirection: `When analyzing papers, follow this workflow:
1. Use calculate_complexity to get comprehensive complexity metrics
2. Use extract_key_citations to identify important references
3. Use compare_papers for comparative analysis between multiple papers`,
    components: [
        createComponentDefinition(
            'paper-analyzer',
            'Paper Analyzer',
            'Analyzes academic papers for complexity, citations, and comparisons',
            TYPES.PaperAnalysisComponent
        )
    ],
    onActivate: async () => {
        console.log('[PaperAnalysisSkill] Activated with paper analyzer component');
    },
    onDeactivate: async () => {
        console.log('[PaperAnalysisSkill] Deactivated - clearing analysis results');
    },
    version: '0.0.1'
});
```

**After (Expert):**

```typescript
// experts/builtin/paper-analysis-with-components.expert.ts
import { defineExpert, createExpertComponentDefinition } from '../../expert/ExpertDefinition.js';
import { TYPES } from '../../di/types.js';

export default defineExpert({
    expertId: 'paper-analysis-with-components',
    displayName: 'Paper Analysis (with Components)',
    description: 'Advanced paper analysis expert that manages multiple components',
    responsibilities: 'Analyze academic papers to extract insights, calculate complexity metrics, and identify key citations',
    capabilities: [
        'Calculate paper complexity scores across multiple dimensions',
        'Extract and rank key citations from papers',
        'Compare two papers side-by-side'
    ],
    components: [
        createExpertComponentDefinition(
            'paper-analyzer',
            'Paper Analyzer',
            'Analyzes academic papers for complexity, citations, and comparisons',
            TYPES.PaperAnalysisComponent
        )
    ],
    prompt: {
        capability: 'You have the following capabilities:\n- Calculate paper complexity scores\n- Extract and rank key citations\n- Compare papers side-by-side',
        direction: `When analyzing papers, follow this workflow:
1. Use calculate_complexity to get comprehensive complexity metrics
2. Use extract_key_citations to identify important references
3. Use compare_papers for comparative analysis between multiple papers`
    },
    systemPrompt: 'You are an expert in academic paper analysis. Provide detailed, well-structured insights.',
    onActivate: async () => {
        console.log('[PaperAnalysisExpert] Activated with paper analyzer component');
    },
    onDeactivate: async () => {
        console.log('[PaperAnalysisExpert] Deactivated - clearing analysis results');
    },
    version: '0.0.1'
});
```

### Skill-to-Expert Adapter

For gradual migration, create an adapter:

```typescript
// expert/SkillToExpertAdapter.ts
import type { Skill } from '../skills/types.js';
import type { ExpertConfig } from './types.js';

export class SkillToExpertAdapter {
    convertSkillToExpert(skill: Skill): ExpertConfig {
        // Extract capabilities from prompt.capability
        const capabilities = this.extractCapabilities(skill.prompt.capability);

        return {
            expertId: skill.name,
            displayName: skill.displayName,
            description: skill.description,
            whenToUse: skill.whenToUse,
            triggers: skill.triggers,
            responsibilities: skill.description,
            capabilities: capabilities.length > 0 ? capabilities : [skill.description],
            components: skill.components || [],
            prompt: skill.prompt,
            systemPrompt: undefined,
            autoActivate: false,
            onActivate: skill.onActivate,
            onDeactivate: skill.onDeactivate,
            onComponentActivate: skill.onComponentActivate,
            onComponentDeactivate: skill.onComponentDeactivate
        };
    }

    private extractCapabilities(capabilityText: string): string[] {
        // Parse capability text to extract individual capabilities
        // This is a simple implementation - adjust based on your format
        const lines = capabilityText.split('\n');
        return lines
            .filter(line => line.trim().startsWith('-'))
            .map(line => line.trim().replace(/^-\s*/, ''));
    }

    convertSkillsToExperts(skills: Skill[]): ExpertConfig[] {
        return skills.map(skill => this.convertSkillToExpert(skill));
    }
}
```

---

## Using ExpertOrchestrator

### Sequential Execution

```typescript
import { ExpertOrchestrator } from './expert/ExpertOrchestrator.js';

const orchestrationRequest = {
    task: 'Complete meta-analysis article retrieval',
    strategy: 'sequential' as const,
    expertTasks: [
        {
            expertId: 'question-decomposition',
            task: {
                taskId: 'task-001',
                description: 'Decompose the clinical question into focused sub-questions',
                input: { question: 'Effect of ACE inhibitors on cardiovascular outcomes' },
                expectedOutputs: ['subQuestions']
            }
        },
        {
            expertId: 'search-strategy',
            task: {
                taskId: 'task-002',
                description: 'Design PubMed search strategies for each sub-question',
                expectedOutputs: ['searchFormulas']
            }
        },
        {
            expertId: 'article-retrieval',
            task: {
                taskId: 'task-003',
                description: 'Execute searches and retrieve articles',
                expectedOutputs: ['articleLists']
            }
        }
    ],
    globalContext: {
        project: 'meta-analysis-001',
        deadline: '2024-12-31'
    },
    timeout: 300000 // 5 minutes
};

const result = await orchestrator.orchestrate(orchestrationRequest);

console.log('Success:', result.success);
console.log('Summary:', result.overallSummary);
console.log('Final Output:', result.finalOutput);
console.log('Artifacts:', result.artifacts);
```

### Parallel Execution

```typescript
const parallelRequest = {
    task: 'Analyze multiple papers',
    strategy: 'parallel' as const,
    expertTasks: [
        {
            expertId: 'paper-analysis',
            task: {
                taskId: 'task-001',
                description: 'Analyze paper A',
                input: { paperId: 'paper-a' }
            }
        },
        {
            expertId: 'paper-analysis',
            task: {
                taskId: 'task-002',
                description: 'Analyze paper B',
                input: { paperId: 'paper-b' }
            }
        },
        {
            expertId: 'paper-analysis',
            task: {
                taskId: 'task-003',
                description: 'Analyze paper C',
                input: { paperId: 'paper-c' }
            }
        }
    ]
};

const result = await orchestrator.orchestrate(parallelRequest);
```

### Conditional Execution

```typescript
const conditionalRequest = {
    task: 'Process user request',
    strategy: 'conditional' as const,
    expertTasks: [
        {
            expertId: 'request-classification',
            task: {
                taskId: 'task-001',
                description: 'Classify the user request'
            }
        },
        {
            expertId: 'query-processing',
            task: {
                taskId: 'task-002',
                description: 'Process the query'
            },
            conditional: true // Only execute if condition is met
        },
        {
            expertId: 'error-handling',
            task: {
                taskId: 'task-003',
                description: 'Handle any errors'
            },
            conditional: true
        }
    ]
};

const result = await orchestrator.orchestrate(conditionalRequest);
```

### Context Passing

```typescript
const requestWithContext = {
    task: 'Build and test software',
    strategy: 'sequential' as const,
    expertTasks: [
        {
            expertId: 'code-generation',
            task: {
                taskId: 'task-001',
                description: 'Generate code for the feature',
                input: { feature: 'user-authentication' }
            }
        },
        {
            expertId: 'code-review',
            task: {
                taskId: 'task-002',
                description: 'Review the generated code',
                // Context from previous expert is automatically passed
                input: { code: '${code-generation_result.code}' } // Template variable
            }
        },
        {
            expertId: 'testing',
            task: {
                taskId: 'task-003',
                description: 'Test the reviewed code',
                input: {
                    code: '${code-generation_result.code}',
                    review: '${code-review_result.feedback}'
                }
            }
        }
    ]
};

const result = await orchestrator.orchestrate(requestWithContext);
```

---

## Advanced Patterns

### Expert Communication

Experts can communicate through artifacts:

```typescript
// Expert 1 produces an artifact
const expert1Result = await executor.execute({
    expertId: 'data-extraction',
    task: {
        taskId: 'task-001',
        description: 'Extract data from documents'
    }
});

// Expert 2 consumes the artifact
const expert2Result = await executor.execute({
    expertId: 'data-analysis',
    task: {
        taskId: 'task-002',
        description: 'Analyze the extracted data',
        input: {
            data: expert1Result.artifacts.find(a => a.name === 'extracted-data')?.content
        }
    }
});
```

### Expert Composition

Create composite experts that orchestrate sub-experts:

```typescript
// experts/meta-analysis-composite.expert.ts
import { defineExpert } from '../expert/ExpertDefinition.js';

export default defineExpert({
    expertId: 'meta-analysis-composite',
    displayName: 'Meta-Analysis Composite',
    description: 'Orchestrates multiple experts for complete meta-analysis',
    responsibilities: 'Coordinate multiple experts to complete a full meta-analysis workflow',
    capabilities: [
        'Orchestrate question decomposition',
        'Coordinate search strategy development',
        'Coordinate article retrieval',
        'Coordinate data extraction',
        'Coordinate statistical analysis'
    ],
    prompt: {
        capability: 'You can orchestrate multiple experts to complete complex meta-analysis workflows.',
        direction: 'Use the ExpertOrchestrator to coordinate sub-experts. Pass context between experts as needed.'
    },
    systemPrompt: 'You are a meta-analysis coordinator. Break down tasks and delegate to appropriate experts.'
});
```

### Expert Lifecycle Hooks

```typescript
export default defineExpert({
    expertId: 'lifecycle-example',
    displayName: 'Lifecycle Example',
    description: 'Demonstrates expert lifecycle hooks',
    responsibilities: 'Example expert with lifecycle hooks',
    capabilities: ['Demonstrate lifecycle'],
    prompt: {
        capability: 'Demonstrates lifecycle hooks',
        direction: 'N/A'
    },
    onActivate: async () => {
        console.log('[LifecycleExpert] Activating...');
        // Initialize resources
        await initializeResources();
        console.log('[LifecycleExpert] Activated');
    },
    onDeactivate: async () => {
        console.log('[LifecycleExpert] Deactivating...');
        // Cleanup resources
        await cleanupResources();
        console.log('[LifecycleExpert] Deactivated');
    },
    onComponentActivate: async (component) => {
        console.log(`[LifecycleExpert] Component activated: ${component.componentId}`);
    },
    onComponentDeactivate: async (component) => {
        console.log(`[LifecycleExpert] Component deactivated: ${component.componentId}`);
    }
});
```

---

## Testing Strategies

### Unit Testing Expert Definitions

```typescript
// expert/__tests__/ExpertDefinition.test.ts
import { describe, it, expect } from 'vitest';
import { defineExpert, createExpertComponentDefinition } from '../ExpertDefinition.js';
import { TYPES } from '../../di/types.js';

describe('ExpertDefinition', () => {
    it('should create a valid expert config', () => {
        const expert = defineExpert({
            expertId: 'test-expert',
            displayName: 'Test Expert',
            description: 'Test description',
            responsibilities: 'Test responsibilities',
            capabilities: ['Test capability'],
            prompt: {
                capability: 'Test capability',
                direction: 'Test direction'
            }
        });

        expect(expert.expertId).toBe('test-expert');
        expect(expert.displayName).toBe('Test Expert');
        expect(expert.capabilities).toEqual(['Test capability']);
    });

    it('should include components when provided', () => {
        const expert = defineExpert({
            expertId: 'test-expert-with-components',
            displayName: 'Test Expert with Components',
            description: 'Test description',
            responsibilities: 'Test responsibilities',
            capabilities: ['Test capability'],
            components: [
                createExpertComponentDefinition(
                    'test-component',
                    'Test Component',
                    'Test description',
                    TYPES.TestComponent
                )
            ],
            prompt: {
                capability: 'Test capability',
                direction: 'Test direction'
            }
        });

        expect(expert.components).toHaveLength(1);
        expect(expert.components[0].componentId).toBe('test-component');
    });
});
```

### Integration Testing Expert Execution

```typescript
// expert/__tests__/ExpertExecutor.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ExpertExecutor } from '../ExpertExecutor.js';
import { ExpertRegistry } from '../ExpertRegistry.js';
import testExpert from './test-data/test-expert.expert.js';

describe('ExpertExecutor', () => {
    let executor: ExpertExecutor;
    let registry: ExpertRegistry;

    beforeEach(() => {
        registry = new ExpertRegistry();
        executor = new ExpertExecutor(registry);
        executor.registerExpert(testExpert);
    });

    it('should execute an expert task', async () => {
        const result = await executor.execute({
            expertId: 'test-expert',
            task: {
                taskId: 'task-001',
                description: 'Test task'
            }
        });

        expect(result.success).toBe(true);
        expect(result.expertId).toBe('test-expert');
    });

    it('should throw error for unknown expert', async () => {
        await expect(executor.execute({
            expertId: 'unknown-expert',
            task: {
                taskId: 'task-001',
                description: 'Test task'
            }
        })).rejects.toThrow('Expert "unknown-expert" not found');
    });
});
```

### Testing Orchestration

```typescript
// expert/__tests__/ExpertOrchestrator.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ExpertOrchestrator } from '../ExpertOrchestrator.js';
import { ExpertExecutor } from '../ExpertExecutor.js';
import { ExpertRegistry } from '../ExpertRegistry.js';
import expertA from './test-data/expert-a.expert.js';
import expertB from './test-data/expert-b.expert.js';

describe('ExpertOrchestrator', () => {
    let orchestrator: ExpertOrchestrator;
    let executor: ExpertExecutor;
    let registry: ExpertRegistry;

    beforeEach(() => {
        registry = new ExpertRegistry();
        executor = new ExpertExecutor(registry);
        orchestrator = new ExpertOrchestrator(executor, registry);

        executor.registerExpert(expertA);
        executor.registerExpert(expertB);
    });

    it('should execute sequential orchestration', async () => {
        const result = await orchestrator.orchestrate({
            task: 'Test sequential',
            strategy: 'sequential',
            expertTasks: [
                {
                    expertId: 'expert-a',
                    task: {
                        taskId: 'task-001',
                        description: 'First task'
                    }
                },
                {
                    expertId: 'expert-b',
                    task: {
                        taskId: 'task-002',
                        description: 'Second task'
                    }
                }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.expertResults.size).toBe(2);
    });

    it('should execute parallel orchestration', async () => {
        const result = await orchestrator.orchestrate({
            task: 'Test parallel',
            strategy: 'parallel',
            expertTasks: [
                {
                    expertId: 'expert-a',
                    task: {
                        taskId: 'task-001',
                        description: 'First task'
                    }
                },
                {
                    expertId: 'expert-b',
                    task: {
                        taskId: 'task-002',
                        description: 'Second task'
                    }
                }
            ]
        });

        expect(result.success).toBe(true);
        expect(result.expertResults.size).toBe(2);
    });
});
```

---

## Common Pitfalls

### 1. Not Implementing ExpertExecutor.createAgent()

**Problem**: The current implementation throws an error.

**Solution**: Implement proper Agent creation with DI:

```typescript
private createAgent(config: ExpertConfig): Agent {
    const workspace = new VirtualWorkspace({
        container: this.container,
        skills: [],
        components: config.components
    });

    const agentConfig: AgentConfig = {
        systemPrompt: this.buildSystemPrompt(config)
    };

    return new Agent(
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
}
```

### 2. Not Properly Injecting Logger

**Problem**: Using `(this.agent as any).logger` is a workaround.

**Solution**: Properly inject ILogger:

```typescript
@injectable()
export class ExpertInstance implements IExpertInstance {
    @inject(TYPES.Logger) private logger!: ILogger;

    // ... rest of implementation
}
```

### 3. Not Handling Expert Lifecycle Properly

**Problem**: Resources not cleaned up on disposal.

**Solution**: Implement proper lifecycle hooks:

```typescript
async dispose(): Promise<void> {
    if (this.status === 'running') {
        this.agent.abort('Expert disposed', 'manual');
    }
    this.status = 'idle';

    // Call onDeactivate hook
    if (this.config.onDeactivate) {
        await this.config.onDeactivate();
    }

    // Deactivate components
    for (const component of this.activeComponents.values()) {
        await this.config.onComponentDeactivate?.(component);
        await component.onDeactivate?.();
    }

    this.artifacts = [];
    this.logger.info(`Expert ${this.expertId} disposed`);
}
```

### 4. Not Sharing Artifacts Between Experts

**Problem**: Experts can't share data.

**Solution**: Use shareable artifacts:

```typescript
// Expert 1 produces shareable artifact
expert1.addArtifact({
    type: 'data',
    name: 'extracted-data',
    content: { /* data */ },
    metadata: { source: 'expert-1' },
    shareable: true
});

// Expert 2 can access shared artifacts
const sharedArtifacts = orchestratorResult.artifacts.filter(a => a.shareable);
```

### 5. Not Using Context Passing

**Problem**: Experts don't receive context from previous experts.

**Solution**: Use context in orchestration:

```typescript
const result = await executor.execute({
    expertId: 'expert-b',
    task: {
        taskId: 'task-002',
        description: 'Process data from expert A'
    },
    context: {
        dataFromExpertA: expertAResult.output
    }
});
```

---

## Next Steps

1. **Implement ExpertExecutor.createAgent()**: Complete the Agent creation logic with proper DI
2. **Create ExpertDefinition helper**: Implement the builder pattern for type-safe expert creation
3. **Migrate high-priority skills**: Start with simple skills without components
4. **Add tests**: Create unit and integration tests for the expert system
5. **Document examples**: Create more real-world examples of expert usage
6. **Monitor performance**: Compare expert vs skill performance metrics
