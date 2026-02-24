# Tool Management Refactoring

## Overview

This document describes the refactoring of the tool management system to use a centralized IoC (Inversion of Control) pattern with InversifyJS dependency injection.

## Architecture Summary

### Before Refactoring

- Tools were managed directly by `VirtualWorkspace` in a `toolSet` Map
- Each `ToolComponent` registered its tools directly with the workspace
- Global tools were initialized in `VirtualWorkspace.initializeGlobalTools()`
- Skill-based tool control was implemented by directly manipulating `toolSet` entries

### After Refactoring

- Tools are managed by a centralized `IToolManager` singleton
- Tool sources are abstracted through `IToolProvider` interface
- Global tools are provided by `GlobalToolProvider`
- Component tools are provided by `ComponentToolProvider`
- Skill-based tool control uses Strategy pattern via `IToolStateManager`

## Key Components

### IToolProvider

```typescript
export interface IToolProvider {
    readonly id: string;
    getTools(): Promise<Tool[]> | Tool[];
    getTool(name: string): Promise<Tool | undefined> | Tool | undefined;
    executeTool(name: string, params: any): Promise<any>;
    readonly priority: number;
}
```

Tool providers abstract the source of tools. Built-in providers:
- `GlobalToolProvider` - Provides global tools (attempt_completion, get_skill, list_skills, deactivate_skill)
- `ComponentToolProvider` - Provides tools from a ToolComponent

### IToolManager

```typescript
export interface IToolManager {
    registerProvider(provider: IToolProvider): void;
    unregisterProvider(providerId: string): boolean;
    getAllTools(): ToolRegistration[];
    getAvailableTools(): Tool[];
    executeTool(name: string, params: any): Promise<any>;
    enableTool(name: string): boolean;
    disableTool(name: string): boolean;
    isToolEnabled(name: string): boolean;
    getToolSource(name: string): { source: ToolSource; providerId: string } | null;
    onAvailabilityChange(callback: ToolAvailabilityCallback): () => void;
    notifyAvailabilityChange(): void;
}
```

### ToolSource

```typescript
export enum ToolSource {
    COMPONENT = 'component',  // From ToolComponent
    GLOBAL = 'global',        // Global tools
    SKILL = 'skill',          // Skill-scoped tools
    UNKNOWN = 'unknown'       // Unknown source
}
```

### IToolStateStrategy

```typescript
export interface IToolStateStrategy {
    getEnabledTools(): string[];
    shouldEnableTool(toolName: string): boolean;
    readonly strategyName: string;
}
```

Built-in strategies:
- `NoSkillStrategy` - All tools enabled (default when no skill is active)
- `SkillBasedStrategy` - Only tools defined in the active skill are enabled

### IToolStateManager

```typescript
export interface IToolStateManager {
    getCurrentStrategy(): IToolStateStrategy;
    setStrategy(skill: Skill | null): void;
    applyStrategy(toolManager: IToolManager): void;
    getStrategyName(): string;
}
```

## Dependency Injection

All components are registered in the InversifyJS container:

```typescript
// In DI container configuration
container.bind<IToolManager>(TYPES.IToolManager).to(ToolManager).inSingletonScope();
container.bind<IToolStateManager>(TYPES.IToolStateManager).to(ToolStateManager).inSingletonScope();
container.bind<IToolProvider>(TYPES.IGlobalToolProvider).to(GlobalToolProvider);
// ComponentToolProvider is created dynamically per component
```

## Migration Guide

### For Existing Code

The refactoring maintains backward compatibility. Existing APIs continue to work:

```typescript
// Old code continues to work
workspace.getAllTools();
workspace.getAvailableTools();
workspace.handleToolCall(toolName, params);
workspace.registerComponent(registration);
```

### For New Code

Use the injected `IToolManager` directly:

```typescript
@injectable()
export class MyComponent {
    constructor(
        @inject(TYPES.IToolManager) toolManager: IToolManager,
        @inject(TYPES.IToolStateManager) toolStateManager: IToolStateManager,
    ) {
        // Register a custom provider
        toolManager.registerProvider(new MyCustomProvider());
        
        // Get all tools
        const tools = toolManager.getAllTools();
        
        // Execute a tool
        const result = await toolManager.executeTool('myTool', params);
    }
}
```

### Creating Custom Tool Providers

```typescript
import { BaseToolProvider, ToolSource } from '../tools/IToolProvider.js';
import type { Tool } from '../statefulContext/types.js';

@injectable()
export class MyCustomProvider extends BaseToolProvider {
    readonly id = 'my-custom-provider';
    readonly priority = 50;
    
    private tools: Tool[] = [
        // Define your tools
    ];
    
    getTools(): Tool[] {
        return this.tools;
    }
    
    getTool(name: string): Tool | undefined {
        return this.tools.find(t => t.toolName === name);
    }
    
    async executeTool(name: string, params: any): Promise<any> {
        // Implement tool execution
    }
}
```

### Custom Tool State Strategies

```typescript
import type { IToolStateStrategy } from '../tools/state/IToolStateStrategy.js';

export class MyCustomStrategy implements IToolStateStrategy {
    readonly strategyName = 'my-custom';
    
    getEnabledTools(): string[] {
        // Return list of enabled tool names
        return ['tool1', 'tool2'];
    }
    
    shouldEnableTool(toolName: string): boolean {
        // Return true if tool should be enabled
        return toolName.startsWith('allowed_');
    }
}

// Use the custom strategy
toolStateManager.setStrategyFactory(new MyCustomStrategyFactory());
```

## File Structure

```
libs/agent-lib/src/tools/
├── IToolProvider.ts          # Provider interface and ToolSource enum
├── IToolManager.ts           # Manager interface and ToolRegistration
├── ToolManager.ts            # Manager implementation
├── index.ts                  # Main exports
├── providers/
│   ├── index.ts              # Provider exports
│   ├── GlobalToolProvider.ts # Global tools provider
│   └── ComponentToolProvider.ts # Component tools provider
└── state/
    ├── IToolStateStrategy.ts # Strategy interface and implementations
    ├── IToolStateManager.ts  # State manager interface
    └── ToolStateManager.ts   # State manager implementation
```

## Benefits

1. **Centralized Management**: All tool operations go through a single `IToolManager`
2. **Extensibility**: Easy to add new tool sources via `IToolProvider`
3. **Testability**: Interfaces enable easy mocking for unit tests
4. **Flexibility**: Strategy pattern allows different tool state management approaches
5. **Backward Compatibility**: Existing code continues to work during migration

## Testing

### Unit Testing with Mocks

```typescript
import { Mock } from 'vitest';

// Mock IToolManager
const mockToolManager = {
    registerProvider: vi.fn(),
    unregisterProvider: vi.fn(),
    getAllTools: vi.fn().returns([]),
    getAvailableTools: vi.fn().returns([]),
    executeTool: vi.fn().resolves({ success: true }),
    enableTool: vi.fn().returns(true),
    disableTool: vi.fn().returns(true),
    isToolEnabled: vi.fn().returns(true),
    getToolSource: vi.fn().returns(null),
    onAvailabilityChange: vi.fn().returns(() => {}),
    notifyAvailabilityChange: vi.fn(),
};

// Use in tests
const component = new MyComponent(mockToolManager, mockStateManager);
```

## See Also

- [Refactoring Plan](../plans/tool-management-refactoring.md)
- [Skill-based Tool Control](./skill-based-tool-control-implementation.md)
