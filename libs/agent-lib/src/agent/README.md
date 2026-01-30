# Virtual Workspace Agent Framework

A novel agent framework that replaces traditional tool-calling patterns with a virtual workspace interaction model, giving LLMs more flexibility through script-based state manipulation.

## 🔒 Security

The framework includes comprehensive security measures to ensure safe script execution:

### Security Features

1. **Script Validation**: Scripts are validated before execution
   - Blocked patterns (require, eval, process, etc.)
   - Script length warnings
   - Potential infinite loop detection
   - Custom validation support

2. **Execution Limits**:
   - Maximum execution time (default: 5 seconds)
   - Maximum memory usage (default: 100 MB)
   - Maximum iteration count (default: 100,000)

3. **Sandboxed Environment**:
   - Controlled global scope
   - Safe console implementation
   - Restricted setTimeout/setInterval
   - No network/file system/process access by default

4. **Permission System**:
   - Read-only, write-only, and read-write states
   - Fine-grained access control

### Script Writing Guidance

The framework provides script writing guidance to help LLMs write effective scripts:

When you call `renderWithScriptSection()`, output includes:

1. **State Initialization Code**: Pre-generated JavaScript code that initializes all writable states with their current values

   ```javascript
   const search_box_state = { search_pattern: '' };
   const filter_state = {};
   ```

2. **Utility Functions**: Component-specific helper functions that can be used in scripts

   ```javascript
   // Available utility functions:
   // normalizeSearch
   // validatePriceRange
   // buildSearchQuery
   ```

3. **Usage Examples**: Sample scripts showing how to interact with states

   ```javascript
   // Simple state update
   search_box_state.search_pattern = 'new search term';

   // Using utility functions
   const normalized = normalizeSearch('  HELLO  ');
   search_box_state.search_pattern = normalized;

   // Complete task
   // Use attempt_completion tool from getCommonTools()
   await attempt_completion('Task completed successfully');
   ```

#### Providing Utility Functions

Components can expose utility functions by overriding `getScriptUtilities()`:

```typescript
class MyComponent extends StatefulComponent {
  protected override getScriptUtilities(): Record<string, Function> {
    return {
      normalizeSearch: (text: string) => text.trim().toLowerCase(),
      validatePrice: (min: number, max: number) => {
        if (min < 0 || max < 0) throw new Error('Invalid price');
        return min <= max;
      },
    };
  }
}
```

### Security Configuration

```typescript
import { SecurityConfig } from './scriptSecurity';

class MyComponent extends StatefulComponent {
  protected securityConfig: SecurityConfig = {
    maxExecutionTime: 10000, // 10 seconds
    maxMemoryUsage: 200, // 200 MB
    maxIterations: 50000, // 50k iterations
    allowNetwork: false, // Block network
    allowFileSystem: false, // Block file system
    allowProcess: false, // Block process access
    blockedPatterns: [/require\s*\(/, /eval\s*\(/, /process\./],
    customValidator: async (script) => {
      // Custom validation logic
      return !script.includes('forbidden');
    },
  };
}
```

### Default Security Settings

The framework uses secure defaults:

| Setting            | Default Value      |
| ------------------ | ------------------ |
| Max Execution Time | 5000ms (5 seconds) |
| Max Memory Usage   | 100 MB             |
| Max Iterations     | 100,000            |
| Allow Network      | false              |
| Allow File System  | false              |
| Allow Process      | false              |

### Blocked Patterns

By default, the following patterns are blocked:

- `require()` - Module loading
- `import()` - Dynamic imports
- `eval()` - Code evaluation
- `Function()` constructor - Dynamic function creation
- `process.` - Process access
- `global.` - Global object access
- `__dirname`, `__filename` - File system paths
- `Buffer.` - Buffer operations
- `child_process` - Child process spawning
- `fs.` - File system access
- `http.`, `https.` - Network access
- And more...

See [`scriptSecurity.ts`](./scriptSecurity.ts) for the complete list.

## Concept Overview

### Traditional Agent Framework

```
Build Context → LLM Tool Call → Execute Tool → Build Context
```

**Limitations:**

- Requires specialized tools for each scenario
- Limited flexibility - new scenarios need new tools
- Tight coupling between agent and tool implementations

### Virtual Workspace Framework

```
Render Environment → LLM Returns Script → Execute Script → Re-render
```

**Benefits:**

- No need for specialized tools
- LLM has maximum flexibility through script execution
- State-driven side effects
- Clear separation of public/private states
- Permission-based access control

## Core Architecture

### StatefulComponent

The base class for all interactive components in the virtual workspace.

```typescript
abstract class StatefulComponent {
  protected privateStates: Record<string, PrivateState> = {};
  protected publicStates: Record<string, PublicState> = {};

  // Render the workspace as context for LLM
  async render(): Promise<string>;

  // Execute a script to mutate states
  protected async executeScript(script: string): Promise<ScriptExecutionResult>;

  // Complete the task
  protected async attemptCompletion(result: string): Promise<void>;

  // Get common tools for LLM interaction
  getCommonTools(): CommonTools;
}
```

### State Types

#### PublicState

States that are visible to the LLM and can be mutated via scripts.

```typescript
interface PublicState {
  type: StateType.public;
  permission: Permission; // r, w, or rw
  schema: z.Schema; // Zod schema for validation
  sideEffectsDesc?: string; // Description of what happens when state changes
  state: object; // The actual state (using valtio proxy)
}
```

#### PrivateState

Internal states not exposed to the LLM, used for component-internal logic.

```typescript
interface PrivateState {
  type: StateType.private;
  schema: z.Schema;
  state: object;
}
```

### Permissions

- `r` (READ_ONLY): LLM can read but not modify
- `w` (WRITE_ONLY): LLM can modify but not read
- `rw` (READ_AND_WRITE): LLM can both read and modify

### Common Tools

The framework provides two universal tools for LLM interaction:

1. **`execute_script(script: string)`**: Execute JavaScript to mutate states
2. **`attempt_completion(result: string)`**: Signal task completion

## Usage Example

### Creating a Component

```typescript
import {
  StatefulComponent,
  StateType,
  Permission,
  PublicState,
} from './statefulComponent';
import { proxy, subscribe } from 'valtio';
import * as z from 'zod';

const searchBoxSchema = z.object({
  search_pattern: z.string().max(300),
});

class SearchComponent extends StatefulComponent {
  protected override publicStates: Record<string, PublicState> = {
    search_box_state: {
      type: StateType.public,
      permission: Permission.rw,
      schema: searchBoxSchema,
      sideEffectsDesc: 'Changes trigger search and refresh results',
      state: proxy({ search_pattern: '' }),
    },
  };

  state = {
    search_result: '',
  };

  constructor() {
    super();
    // Subscribe to state changes for side effects
    subscribe(this.publicStates['search_box_state'].state, async () => {
      this.state.search_result = await this.performSearch();
    });
  }

  private async performSearch(): Promise<string> {
    // Implement search logic
    return 'search results';
  }
}
```

### Using the Component

```typescript
const component = new SearchComponent();

// Render context for LLM
const context = await component.renderWithScriptSection();
console.log(context);

// Execute a script (simulating LLM response)
const script = `
search_box_state.search_pattern = "example query";
await attempt_completion("Search completed");
`;

const result = await component.executeScript(script);
console.log(result);
```

## Workflow Comparison

### Traditional Approach

```typescript
// Define specialized tool
const setSearchPatternTool = {
  name: 'set_search_pattern',
  description: 'Set the search pattern',
  parameters: {
    type: 'object',
    properties: {
      pattern: { type: 'string' },
    },
  },
};

// LLM calls tool
const toolCall = await llm.generateToolCall(context, [setSearchPatternTool]);
await executeToolCall(toolCall);
```

### Virtual Workspace Approach

```typescript
// Render environment
const context = await component.renderWithScriptSection();

// LLM generates script
const script = await llm.generateScript(context);
// Example: search_box_state.search_pattern = "query";

// Execute script
await component.executeScript(script);
```

## Key Features

### 1. Flexible Script Execution

LLMs can write any JavaScript to manipulate states:

```javascript
// Simple assignment
search_box_state.search_pattern = 'query';

// Complex logic
search_box_state.search_pattern = 'term1 ' + 'term2';

// Dynamic values
search_box_state.search_pattern = 'search_' + Date.now();
```

### 2. State-Driven Side Effects

Using valtio's reactivity, state changes automatically trigger side effects:

```typescript
subscribe(publicStates['search_box_state'].state, () => {
  // Automatically execute when state changes
  this.refreshResults();
});
```

### 3. Permission-Based Access Control

Control what LLM can do with each state:

```typescript
publicStates: {
    read_only_config: {
        permission: Permission.r,  // Read only
        // ...
    },
    write_only_log: {
        permission: Permission.w,  // Write only
        // ...
    },
    mutable_state: {
        permission: Permission.rw,  // Read and write
        // ...
    }
}
```

### 4. Clear Separation of Concerns

- **Public states**: Visible to LLM, can be mutated
- **Private states**: Internal component state, not exposed
- **Side effects**: Triggered automatically by state changes

## Testing

Run the test suite to verify the framework:

```bash
npx nx test agent-lib --testFile=statefulComponent.test.ts --rootDir=/workspace
```

All 18 tests pass, covering:

- Basic state management
- Script execution
- Common tools
- End-to-end workflow simulation
- Framework concept validation
- Permission system

## Design Philosophy

This framework is built on these principles:

1. **Flexibility over Specialization**: Instead of creating many specialized tools, provide a flexible script execution mechanism.

2. **State as Source of Truth**: All interactions happen through state mutations, making the system predictable and testable.

3. **Reactive Side Effects**: Side effects are triggered automatically by state changes, reducing boilerplate.

4. **Clear Boundaries**: Public/private states and permissions provide clear boundaries between LLM and component internals.

## Future Enhancements

Potential improvements to consider:

1. **Script Sandbox**: Enhanced security with a proper sandboxed execution environment
2. **State Validation**: Automatic validation of state mutations against schemas
3. **Transaction Support**: Batch state mutations with rollback capability
4. **State History**: Track state changes for debugging and replay
5. **Component Composition**: Combine multiple components into complex workspaces

## Files

- [`statefulComponent.ts`](./statefulComponent.ts) - Core framework implementation
- [`statefulComponent.test.ts`](./statefulComponent.test.ts) - Comprehensive test suite
- [`demoComponent.ts`](./demoComponent.ts) - Example component with utility functions
- [`demoComponent.test.ts`](./demoComponent.test.ts) - Demo component tests
- [`scriptSecurity.ts`](./scriptSecurity.ts) - Security module for safe script execution
- [`scriptSecurity.test.ts`](./scriptSecurity.test.ts) - Security module tests

## License

This framework is part of the agent-lib library.
