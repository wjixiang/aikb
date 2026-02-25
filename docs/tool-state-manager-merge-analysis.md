# ToolStateManager Merge Analysis

## Executive Summary

**Question**: Can `ToolStateManager` be merged into `ToolManager`?

**Answer**: **Yes, it is feasible and recommended**, but with some important considerations about the current architecture and design patterns.

---

## Current Architecture

### ToolManager (Singleton)

**Location**: [`libs/agent-lib/src/tools/ToolManager.ts`](libs/agent-lib/src/tools/ToolManager.ts)

**Responsibilities**:

- Register/unregister tool providers ([`GlobalToolProvider`](libs/agent-lib/src/tools/providers/GlobalToolProvider.ts), [`ComponentToolProvider`](libs/agent-lib/src/tools/IToolProvider.ts))
- Maintain a registry of all tools with their enabled/disabled state
- Execute tool calls
- Notify subscribers of tool availability changes
- Enable/disable individual tools

**Key Methods**:

- [`registerProvider()`](libs/agent-lib/src/tools/ToolManager.ts:44)
- [`unregisterProvider()`](libs/agent-lib/src/tools/ToolManager.ts:93)
- [`getAllTools()`](libs/agent-lib/src/tools/ToolManager.ts:133)
- [`getAvailableTools()`](libs/agent-lib/src/tools/ToolManager.ts:141)
- [`executeTool()`](libs/agent-lib/src/tools/ToolManager.ts:153)
- [`enableTool()`](libs/agent-lib/src/tools/ToolManager.ts:176)
- [`disableTool()`](libs/agent-lib/src/tools/ToolManager.ts:191)
- [`isToolEnabled()`](libs/agent-lib/src/tools/ToolManager.ts:206)
- [`onAvailabilityChange()`](libs/agent-lib/src/tools/ToolManager.ts:233)

### ToolStateManager (Singleton)

**Location**: [`libs/agent-lib/src/tools/state/ToolStateManager.ts`](libs/agent-lib/src/tools/state/ToolStateManager.ts)

**Responsibilities**:

- Maintain the current tool state strategy (based on active skill)
- Apply the strategy to enable/disable tools based on skill configuration
- Uses Strategy Pattern for different skill-based tool control

**Key Methods**:

- [`getCurrentStrategy()`](libs/agent-lib/src/tools/state/ToolStateManager.ts:29)
- [`setStrategy(skill)`](libs/agent-lib/src/tools/state/ToolStateManager.ts:37)
- [`applyStrategy(toolManager)`](libs/agent-lib/src/tools/state/ToolStateManager.ts:50)
- [`getStrategyName()`](libs/agent-lib/src/tools/state/ToolStateManager.ts:75)

### Usage in VirtualWorkspace

**Location**: [`libs/agent-lib/src/statefulContext/virtualWorkspace.ts`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts)

The [`VirtualWorkspace`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:23) class:

1. Injects both [`IToolManager`](libs/agent-lib/src/tools/IToolManager.ts:52) and [`IToolStateManager`](libs/agent-lib/src/tools/state/IToolStateManager.ts:12) (lines 35-36)
2. Uses [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) to apply skill-based tool strategies (line 156-157)
3. Provides [`getToolManager()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:132) and [`getToolStateManager()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:139) getters

---

## Analysis: Can They Be Merged?

### Arguments FOR Merging

1. **Tight Coupling**: [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) exists solely to manipulate [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29)'s state. It has no purpose without [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29).

2. **Single Responsibility of Tool State**: Tool enabling/disabling is inherently a tool management concern. Splitting this into two managers adds unnecessary complexity.

3. **Simplified DI**: Currently requires two singleton bindings in [`container.ts`](libs/agent-lib/src/di/container.ts:160). Merging would simplify dependency injection.

4. **Reduced Indirection**: The current flow is:

   ```
   SkillManager → VirtualWorkspace → ToolStateManager → ToolManager
   ```

   Merging would simplify to:

   ```
   SkillManager → VirtualWorkspace → ToolManager
   ```

5. **Limited Usage**: [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) is only used in [`VirtualWorkspace`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:23) and nowhere else in the codebase.

### Arguments AGAINST Merging

1. **Separation of Concerns**: The current design follows the Strategy Pattern, separating:
   - **ToolManager**: Low-level tool registry and execution
   - **ToolStateManager**: High-level skill-based tool control policy

2. **Testability**: Having separate interfaces makes it easier to mock and test each component independently.

3. **Extensibility**: If other tool control policies emerge (e.g., user-based, context-based), the current architecture allows adding new strategy types without modifying [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29).

---

## Recommended Approach

### Option 1: Full Merge (Recommended for Simplicity)

Merge [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) into [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29):

**Benefits**:

- Simpler architecture
- Fewer classes to maintain
- Easier to understand for new developers
- Single source of truth for tool state

**Implementation**:

```typescript
@injectable()
export class ToolManager implements IToolManager {
  // Existing properties...
  private currentStrategy: IToolStateStrategy;
  private strategyFactory: IToolStateStrategyFactory;

  // Add strategy management methods
  setStrategy(skill: Skill | null): void {
    this.currentStrategy = this.strategyFactory.createStrategy(skill);
    this.applyStrategy();
  }

  private applyStrategy(): void {
    const allTools = this.getAllTools();
    for (const registration of allTools) {
      if (registration.source === ToolSource.COMPONENT) {
        const shouldBeEnabled = this.currentStrategy.shouldEnableTool(
          registration.tool.toolName,
        );
        if (shouldBeEnabled !== registration.enabled) {
          registration.enabled = shouldBeEnabled;
        }
      }
    }
    this.notifyAvailabilityChange();
  }
}
```

### Option 2: Keep Separate but Tighten Integration (Recommended for Extensibility)

Keep the separation but make [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) an internal implementation detail of [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29):

**Benefits**:

- Maintains clean separation of policy vs mechanism
- [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29) becomes the single public API
- Strategy pattern remains for extensibility

**Implementation**:

```typescript
@injectable()
export class ToolManager implements IToolManager {
  private stateManager: ToolStateManager;

  // Expose strategy methods through ToolManager
  setStrategy(skill: Skill | null): void {
    this.stateManager.setStrategy(skill);
    this.stateManager.applyStrategy(this);
  }

  getCurrentStrategy(): IToolStateStrategy {
    return this.stateManager.getCurrentStrategy();
  }
}
```

---

## Migration Impact

### Files That Would Change

1. **[`libs/agent-lib/src/tools/ToolManager.ts`](libs/agent-lib/src/tools/ToolManager.ts)** - Add strategy management
2. **[`libs/agent-lib/src/tools/IToolManager.ts`](libs/agent-lib/src/tools/IToolManager.ts)** - Add strategy methods to interface
3. **[`libs/agent-lib/src/statefulContext/virtualWorkspace.ts`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts)** - Remove [`toolStateManager`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:30) dependency
4. **[`libs/agent-lib/src/di/container.ts`](libs/agent-lib/src/di/container.ts)** - Remove [`IToolStateManager`](libs/agent-lib/src/tools/state/IToolStateManager.ts:12) binding
5. **[`libs/agent-lib/src/di/types.ts`](libs/agent-lib/src/di/types.ts)** - Remove [`IToolStateManager`](libs/agent-lib/src/tools/state/IToolStateManager.ts:12) symbol

### Backward Compatibility

To maintain backward compatibility during migration:

1. Keep [`IToolStateManager`](libs/agent-lib/src/tools/state/IToolStateManager.ts:12) interface but mark as deprecated
2. Make [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) delegate to [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29)
3. Update all consumers in a single PR

---

## Conclusion

**Recommendation**: **Merge [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) into [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29)**

The current separation adds complexity without providing significant benefits. The strategy pattern can still be maintained internally within [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29) if needed for future extensibility, but the public API should be unified through a single manager.

This merge would:

- Reduce the number of singleton services from 2 to 1
- Simplify the dependency graph
- Make the codebase easier to understand and maintain
- Reduce the cognitive load for developers working with tools

---

## Next Steps

If you decide to proceed with the merge:

1. Create a feature branch
2. Add strategy management methods to [`ToolManager`](libs/agent-lib/src/tools/ToolManager.ts:29)
3. Update [`VirtualWorkspace`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:23) to use the merged API
4. Update DI container configuration
5. Run all tests to ensure no regressions
6. Deprecate and eventually remove [`ToolStateManager`](libs/agent-lib/src/tools/state/ToolStateManager.ts:16) files
