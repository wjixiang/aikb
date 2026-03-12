# Expert Architecture Summary

## Quick Reference

### Current Skills Architecture
- **Single active skill at a time**
- **Shared workspace and memory**
- **Sequential execution**
- **Manual orchestration (LLM-driven)**

### New Expert Architecture
- **Multiple experts can coexist**
- **Independent workspace and memory per expert**
- **Parallel/sequential/conditional execution**
- **Built-in orchestration with strategies**

---

## Key Files

### Expert Architecture
| File | Purpose |
|------|---------|
| [`ExpertExecutor.ts`](../libs/agent-lib/src/expert/ExpertExecutor.ts) | Creates and executes Expert instances |
| [`ExpertInstance.ts`](../libs/agent-lib/src/expert/ExpertInstance.ts) | Running Expert with Agent |
| [`ExpertOrchestrator.ts`](../libs/agent-lib/src/expert/ExpertOrchestrator.ts) | Multi-expert orchestration |
| [`ExpertRegistry.ts`](../libs/agent-lib/src/expert/ExpertRegistry.ts) | Expert configuration management |
| [`types.ts`](../libs/agent-lib/src/expert/types.ts) | Type definitions |

### Skills Architecture (Legacy)
| File | Purpose |
|------|---------|
| [`SkillManager.ts`](../libs/agent-lib/src/skills/SkillManager.ts) | Skill lifecycle management |
| [`SkillDefinition.ts`](../libs/agent-lib/src/skills/SkillDefinition.ts) | Skill definition builder |
| [`types.ts`](../libs/agent-lib/src/skills/types.ts) | Type definitions |

---

## Migration Phases

### Phase 1: Coexistence (Current)
- Keep both systems separate
- VirtualWorkspace maintains both SkillManager and ExpertRegistry
- Zero breaking changes

### Phase 2: Skill-to-Expert Adapter
- Create adapter to convert Skills to Experts
- Reuse existing skill definitions
- Gradual migration

### Phase 3: Expert-First
- New features as Experts only
- Existing skills gradually migrated
- SkillManager becomes thin wrapper

### Phase 4: Complete Migration
- All skills migrated to Experts
- SkillManager removed
- Simplified codebase

---

## Quick Migration Example

### Before (Skill)
```typescript
export default defineSkill({
    name: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Extract PICO elements from clinical studies',
    capabilities: ['Extract Population', 'Extract Intervention', ...],
    workDirection: 'Extract PICO elements systematically...'
});
```

### After (Expert)
```typescript
export default defineExpert({
    expertId: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Extract PICO elements from clinical studies',
    responsibilities: 'Extract PICO elements systematically...',
    capabilities: ['Extract Population', 'Extract Intervention', ...],
    prompt: {
        capability: 'You can extract PICO elements...',
        direction: 'Extract PICO elements systematically...'
    }
});
```

---

## Orchestration Strategies

| Strategy | Description | Use Case |
|----------|-------------|----------|
| `sequential` | Execute experts one after another | Dependent tasks |
| `parallel` | Execute all experts simultaneously | Independent tasks |
| `dependency-ordered` | Execute based on dependency graph | Complex workflows |
| `conditional` | Execute based on conditions | Branching workflows |

---

## Immediate Actions Required

1. **Complete [`ExpertExecutor.createAgent()`](../libs/agent-lib/src/expert/ExpertExecutor.ts:92)**
   - Implement proper Agent creation with DI
   - Create VirtualWorkspace with expert components

2. **Fix [`ExpertInstance`](../libs/agent-lib/src/expert/ExpertInstance.ts) Logger**
   - Properly inject ILogger
   - Remove `(this.agent as any)` workaround

3. **Create ExpertDefinition Helper**
   - Similar to SkillDefinition for type-safe expert creation
   - Helper functions for common patterns

---

## Documentation Files

- **[expert-architecture-analysis.md](expert-architecture-analysis.md)** - Comprehensive analysis of both architectures
- **[expert-architecture-diagrams.md](expert-architecture-diagrams.md)** - Visual diagrams and flowcharts
- **[expert-migration-guide.md](expert-migration-guide.md)** - Practical migration guide with code examples

---

## Key Advantages of Expert Architecture

1. **Parallel Execution**: Multiple experts can work simultaneously
2. **Independent Contexts**: Each expert has isolated workspace and memory
3. **Built-in Orchestration**: Explicit task decomposition and result aggregation
4. **Better Scalability**: Can handle complex multi-step workflows
5. **Artifact Sharing**: Explicit mechanism for sharing data between experts
6. **Flexible Strategies**: Multiple execution strategies for different use cases

---

## Related Documentation

- [Skill Component Refactoring Summary](skill-component-refactoring-summary.md)
- [Agent Thinking Cycle Implementation](agent-thinking-cycle-implementation.md)
- [Tool Management Refactoring](tool-management-refactoring.md)
