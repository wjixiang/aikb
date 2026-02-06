# stateful-context

A state management framework for dynamic context rendering in agent systems. Provides components for managing state, executing tools, and rendering terminal UI elements.

## Features

- **ToolComponent**: A component architecture that uses tool calls for secure and controlled interaction
- **VirtualWorkspace**: A workspace for managing and coordinating multiple components
- **TUI Elements**: Terminal UI elements for rendering dynamic content
- **Type Safety**: Built with TypeScript and Zod for runtime validation
- **ESM Support**: Native ES modules support

## Installation

```bash
pnpm install
```

## Building

```bash
pnpm run build
```

This will compile the TypeScript source files to the `dist` directory.

## Running Tests

```bash
# Run tests once
pnpm test

# Run tests with UI
pnpm test:ui

# Run tests with coverage
pnpm test:coverage
```

## Usage

```typescript
import { ToolComponent, VirtualWorkspace, tdiv } from 'stateful-context';
import { z } from 'zod';

class MyComponent extends ToolComponent {
  toolSet = new Map([
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

// Create and register component
const workspace = new VirtualWorkspace();
workspace.registerComponent({
  key: 'myComponent',
  component: new MyComponent(),
  priority: 1,
});
```

## Migration from StatefulComponent

If you're migrating from the deprecated `StatefulComponent` architecture, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md) for detailed instructions.

## Project Structure

```
stateful-context/
├── src/
│   ├── index.ts           # Main entry point
│   ├── types.ts           # Type definitions
│   ├── toolComponent.ts   # ToolComponent base class
│   ├── virtualWorkspace.ts # VirtualWorkspace implementation
│   ├── ui/                # TUI elements
│   └── section/           # Section rendering utilities
├── dist/                  # Compiled output
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## License

Private - All rights reserved
