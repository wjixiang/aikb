# Migration Guide: StatefulComponent to ToolComponent

This guide helps you migrate components from the deprecated `StatefulComponent` architecture to the new `ToolComponent` architecture.

## Overview

The `StatefulComponent` architecture used script execution for state management and rendering. The new `ToolComponent` architecture uses tool calls for a more secure and controlled interaction model.

## Key Changes

### 1. Component Base Class

**Old (StatefulComponent):**

```typescript
import { StatefulComponent, State, Permission } from './statefulComponent';
import { proxy } from 'valtio';
import * as z from 'zod';

class MyComponent extends StatefulComponent {
  protected override states: Record<string, State> = {
    myState: {
      permission: Permission.rw,
      schema: z.object({ value: z.string() }),
      state: proxy({ value: 'initial' }),
    },
  };

  protected async init(): Promise<void> {
    // Initialization logic
  }

  protected getScriptUtilities(): Record<string, Function> {
    return {
      myUtility: () => {
        /* ... */
      },
    };
  }
}
```

**New (ToolComponent):**

```typescript
import { ToolComponent } from './toolComponent';
import { Tool } from './types';
import { tdiv } from './ui';
import * as z from 'zod';

class MyComponent extends ToolComponent {
  toolSet = new Map<string, Tool>([
    [
      'myTool',
      {
        toolName: 'myTool',
        desc: 'Description of what the tool does',
        paramsSchema: z.object({ param1: z.string() }),
      },
    ],
  ]);

  private myState = 'initial';

  renderImply = async () => {
    return [
      new tdiv({
        content: `State: ${this.myState}`,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  handleToolCall = async (toolName: string, params: any) => {
    if (toolName === 'myTool') {
      this.myState = params.param1;
    }
  };
}
```

### 2. State Management

**Old:** States were managed using Valtio proxies with explicit permissions and schemas.

**New:** State is managed directly within the component. You can still use Valtio internally if needed, but it's not required by the framework.

### 3. Rendering

**Old:** The `_render()` method returned a single `TUIElement` with built-in state and script utilities rendering.

**New:** The `renderImply()` method returns an array of `TUIElement[]`. You have full control over what to render.

### 4. Tool Definitions

**Old:** Tools were defined as script utilities that could be called via `execute_script`.

**New:** Tools are explicitly defined in the `toolSet` Map with:

- `toolName`: Unique identifier for the tool
- `desc`: Human-readable description
- `paramsSchema`: Zod schema for parameter validation

### 5. Tool Execution

**Old:** Tools were executed via script execution:

```typescript
await workspace.getScriptRuntime().execute('myUtility("arg")');
```

**New:** Tools are called directly:

```typescript
const component = workspace.getComponent('myComponent');
await component.handleToolCall('myTool', { param1: 'value' });
```

## Migration Steps

### Step 1: Identify States

List all states from your `StatefulComponent`:

```typescript
protected override states: Record<string, State> = {
    state1: { ... },
    state2: { ... }
};
```

### Step 2: Convert States to Private Properties

Convert each state to a private property:

```typescript
private state1: State1Type = /* initial value */;
private state2: State2Type = /* initial value */;
```

### Step 3: Define Tools

For each script utility, create a corresponding tool:

```typescript
toolSet = new Map<string, Tool>([
    ['tool1', {
        toolName: 'tool1',
        desc: 'What tool1 does',
        paramsSchema: z.object({ /* parameters */ })
    }],
    ['tool2', { /* ... */ }
]);
```

### Step 4: Implement renderImply

Replace `_render()` with `renderImply()`:

```typescript
renderImply = async () => {
  return [
    new tdiv({
      content: `State1: ${this.state1}`,
      styles: { width: 80, showBorder: false },
    }),
    new tdiv({
      content: `State2: ${this.state2}`,
      styles: { width: 80, showBorder: false },
    }),
  ];
};
```

### Step 5: Implement handleToolCall

Replace script utility logic with tool call handlers:

```typescript
handleToolCall = async (toolName: string, params: any) => {
  switch (toolName) {
    case 'tool1':
      this.state1 = params.param1;
      break;
    case 'tool2':
      this.state2 = params.param2;
      break;
  }
};
```

### Step 6: Remove init() Method

The `init()` method is no longer required. Initialize your state directly in the property declarations or constructor.

### Step 7: Update Workspace Registration

The registration API remains the same:

```typescript
workspace.registerComponent({
  key: 'myComponent',
  component: new MyComponent(),
  priority: 1,
});
```

## VirtualWorkspace Changes

### Removed Methods

- `getScriptRuntime()` - No longer available
- `getCommonTools()` - No longer available
- `setCompletionCallback()` - No longer available

### Changed Methods

- `getStats()` now returns `totalTools` instead of `totalStates`

### Direct Component Access

Instead of script execution, access components directly:

```typescript
const component = workspace.getComponent('myComponent');
await component.handleToolCall('toolName', params);
```

## Example: Complete Migration

### Before (StatefulComponent)

```typescript
class CounterComponent extends StatefulComponent {
  protected override states: Record<string, State> = {
    count: {
      permission: Permission.rw,
      schema: z.object({ value: z.number() }),
      state: proxy({ value: 0 }),
    },
  };

  protected async init(): Promise<void> {
    // No init needed
  }

  protected getScriptUtilities(): Record<string, Function> {
    return {
      increment: (amount: number = 1) => {
        this.states.count.state.value += amount;
      },
      decrement: (amount: number = 1) => {
        this.states.count.state.value -= amount;
      },
    };
  }
}
```

### After (ToolComponent)

```typescript
class CounterComponent extends ToolComponent {
  toolSet = new Map<string, Tool>([
    [
      'increment',
      {
        toolName: 'increment',
        desc: 'Increment the counter',
        paramsSchema: z.object({ amount: z.number().optional() }),
      },
    ],
    [
      'decrement',
      {
        toolName: 'decrement',
        desc: 'Decrement the counter',
        paramsSchema: z.object({ amount: z.number().optional() }),
      },
    ],
  ]);

  private count = 0;

  renderImply = async () => {
    return [
      new tdiv({
        content: `Counter: ${this.count}`,
        styles: { width: 80, showBorder: false },
      }),
    ];
  };

  handleToolCall = async (toolName: string, params: any) => {
    const amount = params.amount || 1;
    if (toolName === 'increment') {
      this.count += amount;
    } else if (toolName === 'decrement') {
      this.count -= amount;
    }
  };
}
```

## Benefits of ToolComponent

1. **Security**: No arbitrary script execution - only defined tools can be called
2. **Type Safety**: Zod schemas validate all tool parameters
3. **Explicit API**: Clear tool definitions with descriptions
4. **Simpler State Management**: No need for Valtio proxies (optional)
5. **Better Testability**: Direct method calls instead of script execution

## Backwards Compatibility

`StatefulComponent` is still exported for backwards compatibility but is deprecated. New components should use `ToolComponent`.
