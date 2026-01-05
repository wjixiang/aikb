# Workspace Interaction Tool

## Overview

The `update_workspace` tool enables LLM agents to interact with editable status fields in the workspace. This tool follows the state-based workspace interaction pattern where the LLM can read the current workspace state and modify editable fields through tool calls.

## Architecture

### Components

1. **Native Tool Definition** (`native-tools/update_workspace.ts`)
   - Defines the tool schema for OpenAI-compatible APIs
   - Specifies parameters: `field_name` and `value`

2. **XML Description** (`update-workspace.ts`)
   - Provides human-readable tool description for XML protocol
   - Includes usage examples and parameter documentation

3. **Tool Implementation** (`tools/update_workspace.ts`)
   - Contains the actual tool execution logic
   - Receives workspace context through `ToolContext`
   - Validates field existence and editability
   - Calls `workspace.updateEditableProps()` to update the field

4. **Tool Registration** (`index.ts`)
   - Registers the tool in the global `toolSet`
   - Makes the tool available to the agent

## Usage

### For Agent Implementation

The Agent class provides a protected method `executeToolCall()` that automatically passes the workspace context:

```typescript
// In your Agent subclass or method
const result = await this.executeToolCall('update_workspace', {
  field_name: 'status',
  value: 'in_progress',
});
```

### Tool Parameters

- **field_name** (required): The name of the editable field to update
  - Must be a field marked as [EDITABLE] in the workspace
  - The field must exist in the workspace's editable props schema

- **value** (required): The new value for the field
  - Must match the field's schema (validated by Zod)
  - Can be set to `null` to clear the field

### Response Format

**Success Response:**

```
Successfully updated field 'status':
- Previous value: "idle"
- New value: "in_progress"
```

**Error Response:**

```
Error: Field 'invalid_field' does not exist or is not editable. Please check the workspace context for available editable fields.
```

## Integration with Workspace

The tool integrates with the `IWorkspace` interface:

1. **Reading Workspace State**: The workspace context is automatically included in the system prompt via `workspace.renderContext()`
2. **Updating Fields**: The tool calls `workspace.updateEditableProps()` to update fields
3. **Validation**: The workspace validates the new value against the field's Zod schema
4. **Side Effects**: Successful updates may trigger cascading updates or side effects

## Tool Context

The `ToolContext` interface allows passing additional context to tool execution:

```typescript
export interface ToolContext {
  workspace?: IWorkspace;
  [key: string]: any;
}
```

The `update_workspace` tool uses the `workspace` property from the context to access the workspace instance.

## Example Workflow

1. Agent receives user input
2. Agent generates system prompt with workspace context
3. LLM analyzes workspace context and identifies editable fields
4. LLM calls `update_workspace` tool with field name and new value
5. Tool validates field existence and editability
6. Tool calls `workspace.updateEditableProps()` to update the field
7. Workspace validates the value against schema
8. Tool returns success/error response
9. Agent continues with updated workspace state

## Error Handling

The tool handles several error cases:

1. **Workspace Not Available**: Returns error if workspace context is not provided
2. **Field Not Found**: Returns error if the field doesn't exist in editable props
3. **Read-Only Field**: Returns error if the field is marked as read-only
4. **Validation Error**: Returns error from workspace if value doesn't match schema

## Extending the Tool

To add more workspace interaction tools:

1. Create native tool definition in `native-tools/`
2. Create XML description in root `tools/` directory
3. Create tool implementation in `tools/` directory
4. Register tool in `index.ts`
5. Add tool name to `toolNames` in `types/tool.ts`

## Related Files

- `agent/agentWorkspace.ts` - IWorkspace interface definition
- `agent/workspaceTypes.ts` - EditableProps types and utilities
- `tools/types.ts` - Tool and ToolContext interfaces
- `tools/toolCallingHandler.ts` - Tool execution handler
