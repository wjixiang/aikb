# Wiki Editor - XML-Based Text Editing System

A comprehensive XML-based editing command system for wiki document manipulation, designed for AI agent text editing workflows.

## Overview

The Wiki Editor provides a powerful, declarative way to edit text documents using XML commands. It's specifically designed for AI agents to manipulate wiki content with precision and flexibility.

## Features

- **8 Edit Operations**: Insert, Replace, Delete, Append, Prepend, Move, Copy, and Batch
- **XML-Based Commands**: Declarative, easy-to-parse command format
- **Flexible Positioning**: Position-based, marker-based (after/before), and range-based operations
- **Batch Processing**: Execute multiple commands in sequence with error handling
- **Command History**: Track all executed commands and their results
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **Error Handling**: Detailed error messages and validation

## Architecture

```
wikiEditor/
├── wikiEditorComponents.ts    # Main component with workspace integration
├── wikiEditorCommandTypes.ts   # Type definitions and XML schema
├── wikiEditorCommandParser.ts  # XML command parser
├── wikiEditorCommandExecutor.ts # Command execution engine
├── index.ts                    # Public API exports
└── README.md                   # This file
```

## Quick Start

```typescript
import { WikiEditorComponents } from './wikiEditor';

// Create a wiki editor instance
const editor = new WikiEditorComponents();

// Set initial content
await editor.setContent('# My Wiki Document\n\nThis is the content.');

// Execute an edit command
await editor.updateState(
  'edit_command',
  `
  <append>
    <content>## New Section

This is new content.
</content>
  </append>
`,
);

// Get the updated content
const content = editor.getContent();
console.log(content);
```

## XML Command Reference

### 1. INSERT - Insert Content

Insert content at a specific position or relative to text markers.

```xml
<insert>
  <position>0</position>
  <content>Content to insert</content>
</insert>
```

Or use markers:

```xml
<insert>
  <after>## Introduction</after>
  <content>New section content</content>
</insert>
```

```xml
<insert>
  <before>## Conclusion</before>
  <content>New section content</content>
</insert>
```

**Parameters:**

- `position` (optional): 0-indexed character position
- `after` (optional): Insert after this text marker
- `before` (optional): Insert before this text marker
- `content` (required): Content to insert

**Note:** Only one positioning method can be used at a time.

### 2. REPLACE - Replace Text

Replace text with new content.

```xml
<replace>
  <search>old text</search>
  <replace_text>new text</replace_text>
  <replace_all>true</replace_all>
  <case_sensitive>false</case_sensitive>
</replace>
```

**Parameters:**

- `search` (required): Text to search for
- `replace_text` (required): Replacement text
- `replace_all` (optional): Replace all occurrences (default: false)
- `case_sensitive` (optional): Case-sensitive search (default: true)

### 3. DELETE - Remove Content

Delete content by search or range.

```xml
<delete>
  <search>text to delete</search>
  <delete_all>true</delete_all>
  <case_sensitive>true</case_sensitive>
</delete>
```

Or by range:

```xml
<delete>
  <start>0</start>
  <end>100</end>
</delete>
```

**Parameters:**

- `search` (optional): Text to delete
- `delete_all` (optional): Delete all occurrences (default: false)
- `case_sensitive` (optional): Case-sensitive search (default: true)
- `start` (optional): Start position (0-indexed)
- `end` (optional): End position (0-indexed)

**Note:** Either `search` or both `start` and `end` must be provided.

### 4. APPEND - Add to End

Add content at the end of the document.

```xml
<append>
  <content>Content to append</content>
  <new_line>true</new_line>
</append>
```

**Parameters:**

- `content` (required): Content to append
- `new_line` (optional): Add newline before appending (default: true)

### 5. PREPEND - Add to Beginning

Add content at the beginning of the document.

```xml
<prepend>
  <content>Content to prepend</content>
  <new_line>true</new_line>
</prepend>
```

**Parameters:**

- `content` (required): Content to prepend
- `new_line` (optional): Add newline after prepending (default: true)

### 6. MOVE - Move Content

Move content to a new location.

```xml
<move>
  <search>text to move</search>
  <after>## Section 1</after>
  <case_sensitive>true</case_sensitive>
</move>
```

Or by position:

```xml
<move>
  <search>text to move</search>
  <position>50</position>
</move>
```

**Parameters:**

- `search` (required): Text to move
- `after` (optional): Move after this text marker
- `before` (optional): Move before this text marker
- `position` (optional): Move to this position
- `case_sensitive` (optional): Case-sensitive search (default: true)

**Note:** Only one positioning method can be used at a time.

### 7. COPY - Copy Content

Copy content to a new location.

```xml
<copy>
  <search>text to copy</search>
  <after>## Section 2</after>
  <case_sensitive>true</case_sensitive>
</copy>
```

**Parameters:**

- `search` (required): Text to copy
- `after` (optional): Copy after this text marker
- `before` (optional): Copy before this text marker
- `position` (optional): Copy to this position
- `case_sensitive` (optional): Case-sensitive search (default: true)

**Note:** Only one positioning method can be used at a time.

### 8. BATCH - Execute Multiple Commands

Execute multiple commands in sequence.

```xml
<batch>
  <stop_on_error>false</stop_on_error>
  <commands>
    <append>
      <content>Additional content</content>
    </append>
    <replace>
      <search>foo</search>
      <replace_text>bar</replace_text>
    </replace>
    <insert>
      <after>## Introduction</after>
      <content>## New Section

Content here.
</content>
    </insert>
  </commands>
</batch>
```

**Parameters:**

- `stop_on_error` (optional): Stop on error (default: true)
- `commands` (required): Nested commands to execute

## API Reference

### WikiEditorComponents

Main component class for wiki editing.

#### Constructor

```typescript
constructor();
```

Creates a new WikiEditorComponents instance.

#### Methods

##### `getContent(): string`

Get the current editor content.

##### `setContent(content: string): Promise<void>`

Set the editor content.

##### `getLastExecutionResult(): WikiEditorExecutionResult | null`

Get the result of the last command execution.

##### `getCommandHistory(): CommandHistoryEntry[]`

Get the history of all executed commands.

##### `clearCommandHistory(): Promise<void>`

Clear the command history.

##### `resetContent(): Promise<void>`

Reset the editor content to empty.

##### `getContentLength(): number`

Get the current content length in characters.

##### `getLineCount(): number`

Get the number of lines in the content.

##### `getContentPreview(maxLength?: number): string`

Get a preview of the content (first N characters).

### Parser Functions

#### `parseXMLCommands(xml: string): EditCommand[]`

Parse XML string into command objects.

```typescript
const commands = parseXMLCommands(
  '<insert><position>0</position><content>test</content></insert>',
);
```

#### `parseXMLCommand(xml: string): EditCommand`

Parse a single XML command.

```typescript
const command = parseXMLCommand('<append><content>test</content></append>');
```

### Executor Functions

#### `executeCommand(content: string, command: EditCommand): EditCommandResult`

Execute a single command on content.

```typescript
const result = executeCommand('Hello world', {
  type: EditCommandType.APPEND,
  content: '!',
});
```

#### `executeCommands(content: string, commands: EditCommand[]): CommandResult[]`

Execute multiple commands in sequence.

```typescript
const results = executeCommands('Hello', [
  { type: EditCommandType.APPEND, content: ' world' },
  { type: EditCommandType.APPEND, content: '!' },
]);
```

#### `applyCommand(content: string, command: EditCommand): string`

Execute a command and return the new content (throws on error).

```typescript
const newContent = applyCommand('Hello', {
  type: EditCommandType.APPEND,
  content: ' world',
});
```

## Type Definitions

### EditCommand

Union type for all edit commands:

```typescript
type EditCommand =
  | InsertCommand
  | ReplaceCommand
  | DeleteCommand
  | AppendCommand
  | PrependCommand
  | MoveCommand
  | CopyCommand
  | BatchCommand;
```

### EditCommandResult

Result of executing an edit command:

```typescript
interface EditCommandResult {
  success: boolean;
  command: EditCommand;
  error?: string;
  previousContent: string;
  newContent: string;
  changes: number;
}
```

### WikiEditorExecutionResult

Result of executing edit commands on the wiki editor:

```typescript
interface WikiEditorExecutionResult {
  success: boolean;
  error?: string;
  results: CommandResult[];
  previousContent: string;
  newContent: string;
  totalChanges: number;
}
```

## Error Handling

The system provides two main error types:

### CommandParseError

Thrown when XML parsing fails.

```typescript
try {
  const commands = parseXMLCommands('<invalid>');
} catch (error) {
  if (error instanceof CommandParseError) {
    console.error('Parse error:', error.message);
  }
}
```

### CommandExecutionError

Thrown when command execution fails.

```typescript
try {
  const result = executeCommand('Hello', {
    type: EditCommandType.DELETE,
    search: 'World', // Not found
  });
} catch (error) {
  if (error instanceof CommandExecutionError) {
    console.error('Execution error:', error.message);
    console.error('Command:', error.command);
    console.error('Content:', error.content);
  }
}
```

## Examples

### Example 1: Building a Wiki Document

```typescript
const editor = new WikiEditorComponents();

// Start with a title
await editor.setContent('# My Wiki');

// Add sections
await editor.updateState(
  'edit_command',
  `
  <append>
    <content>## Introduction

Welcome to my wiki.
</content>
  </append>
`,
);

await editor.updateState(
  'edit_command',
  `
  <append>
    <content>## Features

- Feature 1
- Feature 2
- Feature 3
</content>
  </append>
`,
);
```

### Example 2: Batch Editing

```typescript
await editor.updateState(
  'edit_command',
  `
  <batch>
    <stop_on_error>false</stop_on_error>
    <commands>
      <replace>
        <search>old</search>
        <replace_text>new</replace_text>
        <replace_all>true</replace_all>
      </replace>
      <append>
        <content>## Additional Section

More content here.
</content>
      </append>
      <insert>
        <before>## Features</before>
        <content>## Overview

This is an overview.
</content>
      </insert>
    </commands>
  </batch>
`,
);
```

### Example 3: Using Markers

```typescript
// Insert a section after a specific header
await editor.updateState(
  'edit_command',
  `
  <insert>
    <after>## Introduction</after>
    <content>## Getting Started

Follow these steps to get started.
</content>
  </insert>
`,
);

// Move a section
await editor.updateState(
  'edit_command',
  `
  <move>
    <search>## Getting Started</search>
    <after>## Features</after>
  </move>
`,
);
```

### Example 4: Range Deletion

```typescript
// Delete content from position 100 to 200
await editor.updateState(
  'edit_command',
  `
  <delete>
    <start>100</start>
    <end>200</end>
  </delete>
`,
);
```

## Integration with Workspace

The WikiEditorComponents extends `WorkspaceComponent` and integrates seamlessly with the agent workspace system:

```typescript
import { WorkspaceBase } from '../agentWorkspace';
import { WikiEditorComponents } from './wikiEditor';

class MyWorkspace extends WorkspaceBase {
  constructor() {
    super();
    this.registerComponent(new WikiEditorComponents());
  }
}
```

## Best Practices

1. **Use Batch Commands**: When making multiple edits, use batch commands for better performance and atomicity.

2. **Error Handling**: Always check execution results and handle errors appropriately.

3. **Position vs Markers**: Use markers (after/before) for more robust positioning when content structure is predictable.

4. **Case Sensitivity**: Be aware of the default case-sensitive behavior for search operations.

5. **Content Preservation**: Use COPY instead of MOVE if you want to preserve the original content.

6. **New Line Handling**: The `new_line` parameter in APPEND/PREPEND helps maintain proper formatting.

## Testing

The module includes comprehensive type definitions for compile-time validation. For runtime testing, consider:

```typescript
import {
  parseXMLCommands,
  executeCommand,
  EditCommandType,
} from './wikiEditor';

const testCases = [
  {
    name: 'Insert at position',
    command: '<insert><position>0</position><content>Test</content></insert>',
    content: 'Hello',
    expected: 'TestHello',
  },
  {
    name: 'Replace text',
    command:
      '<replace><search>Hello</search><replace_text>Hi</replace_text></replace>',
    content: 'Hello World',
    expected: 'Hi World',
  },
  // Add more test cases
];
```

## License

This module is part of the agent-lib library.
