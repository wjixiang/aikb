# toolSet Deprecation Plan

## Overview

This document outlines the deprecation plan for the legacy `toolSet` Map in `VirtualWorkspace` and the migration to the new `ToolManager`-based architecture.

## Current State

### Legacy System (Deprecated)

- **`VirtualWorkspace.toolSet`**: A `Map<string, ToolRegistration>` that stores all tools
- **Purpose**: Originally used for tool management before the introduction of `ToolManager`
- **Status**: Deprecated but kept for backward compatibility

### New System (Current)

- **`ToolManager`**: Singleton service that manages all tool providers
- **`IToolProvider`**: Interface for tool sources (GlobalToolProvider, ComponentToolProvider, etc.)
- **`IToolStateManager`**: Manages tool state based on active skill
- **Registration**: Tools are registered via `toolManager.registerProvider(provider)`

## Changes Made

### 1. Removed `initializeGlobalTools()` Call

**Location**: [`VirtualWorkspace` constructor](../libs/agent-lib/src/statefulContext/virtualWorkspace.ts:77-86)

**Before**:

```typescript
this.globalToolProvider = new GlobalToolProvider();
this.toolManager.registerProvider(this.globalToolProvider);
this.initializeSkills();
this.initializeGlobalTools(); // Called to populate toolSet
```

**After**:

```typescript
this.globalToolProvider = new GlobalToolProvider();
this.toolManager.registerProvider(this.globalToolProvider);
this.initializeSkills();
// initializeGlobalTools() no longer called - toolSet not needed for rendering
```

**Reason**: All rendering methods now use `toolManager` instead of `toolSet`.

### 2. Updated Rendering Methods

#### `renderToolBox()`

**Before**:

```typescript
const globalTools = Array.from(this.toolSet.entries())
  .filter(([, value]) => value.source === ToolSource.GLOBAL)
  .map(([, value]) => value.tool);
```

**After**:

```typescript
const allTools = this.toolManager.getAllTools();
const globalTools = allTools
  .filter((reg) => reg.source === ToolSource.GLOBAL)
  .map((reg) => reg.tool);
```

#### `getGlobalTools()`

**Before**:

```typescript
for (const [toolName, value] of this.toolSet.entries()) {
  if (value.source === ToolSource.GLOBAL) {
    globalToolsMap.set(toolName, value.tool);
  }
}
```

**After**:

```typescript
const allTools = this.toolManager.getAllTools();
for (const registration of allTools) {
  if (registration.source === ToolSource.GLOBAL) {
    globalToolsMap.set(registration.tool.toolName, registration.tool);
  }
}
```

#### `renderSkillToolsSection()`

**Before**:

```typescript
const enabledTools = activeSkill.tools.filter((tool) => {
  const registration = this.toolSet.get(tool.toolName);
  return registration?.enabled === true;
});
```

**After**:

```typescript
const enabledTools = activeSkill.tools.filter((tool) => {
  return this.toolManager.isToolEnabled(tool.toolName);
});
```

### 3. Added Deprecation Warnings

Added console warnings to methods that still use `toolSet`:

- `initializeGlobalTools()`: Warns that the method is deprecated
- `handleToolCall()`: Warns when falling back to `toolSet`
- `addGlobalTool()`: Warns to use `toolManager.registerProvider()` instead
- `removeGlobalTool()`: Warns to use `toolManager.unregisterProvider()` instead

## Migration Guide

### For Component Developers

If you're creating a `ToolComponent`:

**Old Way** (Still works but deprecated):

```typescript
class MyComponent extends ToolComponent {
    toolSet = new Map<string, Tool>([
        ['my_tool', { toolName: 'my_tool', desc: '...', paramsSchema: z.object({...}) }]
    ]);
}
```

**New Way** (Recommended):

```typescript
class MyComponent extends ToolComponent {
    // toolSet is still required by ToolComponent abstract class
    toolSet = new Map<string, Tool>([
        ['my_tool', { toolName: 'my_tool', desc: '...', paramsSchema: z.object({...}) }]
    ]);

    // Tools are automatically registered via ComponentToolProvider
    // when you call workspace.registerComponent()
}
```

### For Tool Consumers

**Old Way** (Deprecated):

```typescript
// Get tools from workspace
const tools = workspace.getAllTools();
const globalTools = workspace.getGlobalTools();
```

**New Way** (Recommended):

```typescript
// Get tools from ToolManager
const toolManager = workspace.getToolManager();
const tools = toolManager.getAllTools();
const globalTools = tools.filter((reg) => reg.source === ToolSource.GLOBAL);
```

### For Tool Execution

**Old Way** (Deprecated):

```typescript
const result = await workspace.handleToolCall('tool_name', params);
```

**New Way** (Recommended):

```typescript
const toolManager = workspace.getToolManager();
const result = await toolManager.executeTool('tool_name', params);
```

## Backward Compatibility

The following are kept for backward compatibility:

1. **`toolSet` Map**: Still maintained but no longer populated in constructor
2. **`handleToolCall()`**: Falls back to `toolSet` if tool not found in `ToolManager`
3. **`addGlobalTool()` / `removeGlobalTool()`**: Deprecated APIs still work
4. **`isToolAvailable()` / `getToolSource()`**: Use `toolManager` first, fall back to `toolSet`

## Future Steps

### Phase 1: Monitoring (Current)

- Monitor console warnings for deprecated API usage
- Gather feedback from users

### Phase 2: Warning Period

- Keep deprecated APIs for 2-3 minor versions
- Update documentation to recommend new APIs

### Phase 3: Removal

- Remove `toolSet` Map entirely
- Remove fallback logic from `handleToolCall()`
- Remove `addGlobalTool()` / `removeGlobalTool()` methods
- Update `ToolComponent` to not require `toolSet` property

## Testing

All existing tests pass with the new implementation:

- `virtualWorkspace.test.ts`: ✓ 1 passed
- `agent.tool-rendering.test.ts`: ✓ 12 passed

## Related Files

- [`VirtualWorkspace`](../libs/agent-lib/src/statefulContext/virtualWorkspace.ts)
- [`ToolManager`](../libs/agent-lib/src/tools/ToolManager.ts)
- [`GlobalToolProvider`](../libs/agent-lib/src/tools/providers/GlobalToolProvider.ts)
- [`ToolComponent`](../libs/agent-lib/src/statefulContext/toolComponent.ts)
