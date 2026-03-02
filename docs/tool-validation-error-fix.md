# Tool Validation Error Fix & Action Phase Guidance Enhancement

## Action Phase Guidance Enhancement

Added action phase guidance to instruct the LLM to follow the thinking phase's plan during execution.

### Changes Made

1. **Created Action Phase Guidance Section** ([`libs/agent-lib/src/prompts/sections/actionPhaseGuidance.ts`](libs/agent-lib/src/prompts/sections/actionPhaseGuidance.ts))
   - Provides clear instructions for the LLM during the action phase
   - When a thinking summary is available, it displays the plan and instructs the LLM to follow it
   - When no thinking summary is available, it provides generic action phase instructions

2. **Modified Agent** ([`libs/agent-lib/src/agent/agent.ts`](libs/agent-lib/src/agent/agent.ts:406-432))
   - Added import for `generateActionPhaseGuidance`
   - After the thinking phase, generates action phase guidance with the thinking summary
   - Prepends the action phase guidance to the system prompt before passing to `performActionPhase`

### Action Phase Guidance Structure

The guidance includes:

1. **Thinking Phase Plan** (when available)
   - Displays the summary from the thinking phase
   - Shows the rounds of thinking and the plan generated

2. **Action Phase Instructions**
   - 📋 **FOLLOW THE PLAN** - Review and execute the thinking phase plan
   - 🛠️ **USE AVAILABLE TOOLS** - Use appropriate tools for each step
   - 📊 **REPORT PROGRESS** - Review tool results and track progress
   - 🔄 **ADAPT IF NEEDED** - Adjust approach when circumstances require it
   - ✅ **COMPLETE THE TASK** - Call `attempt_completion` when done

3. **Execution Guidelines**
   - DO: Execute systematically, use tools, review results, adjust based on feedback
   - DO NOT: Skip steps, make up info, ignore errors, complete prematurely

4. **Response Format**
   - Explain what you're about to do
   - Call the appropriate tool
   - Wait for and review results
   - Proceed to next step or adjust

### Example Output

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                      📋 THINKING PHASE PLAN 📋                                   ║
╚══════════════════════════════════════════════════════════════════════════════╝

The thinking phase has generated a plan for you to follow:

[Reflective Thinking Phase]
Total rounds: 2
Tokens used: 50

Thinking rounds:
  Round 1: I need to analyze this task. The user wants to search for articles...
  Round 2: My plan is: 1) Activate meta-analysis skill, 2) Search...

╔══════════════════════════════════════════════════════════════════════════════╗
║                        ⚠️ ACTION PHASE GUIDANCE ⚠️                              ║
╚════════════════════════════════════════════════════════════════════════════╝

You are now in the ACTION phase. Your primary responsibility is to EXECUTE the plan
that was generated during the thinking phase.

...
```

## Prompt Inspection Tests

Added unit tests in [`libs/agent-lib/src/action/__tests__/ActionModule.prompt-inspection.test.ts`](libs/agent-lib/src/action/__tests__/ActionModule.prompt-inspection.test.ts) to inspect and display the complete prompt structure passed to the API client during the action phase.

### Prompt Structure

The complete prompt consists of:

1. **System Prompt** - The agent's behavior instructions
2. **Workspace Context** - The current state of the workspace including components and skills
3. **Memory Context (Conversation History)** - Previous messages converted to XML format:
   - `<user>` - User messages
   - `<assistant>` - Assistant messages
   - `<system>` - System messages (tool results)
   - `<thinking>` - Thinking phase output
   - `<tool_use>` - Tool calls made by the assistant
   - `<tool_result>` - Results from tool execution
4. **Tools** - The available tools in OpenAI ChatCompletionTool format

### Example Output

```
========== COMPLETE PROMPT STRUCTURE ==========

--- SYSTEM PROMPT ---
You are a helpful assistant.

--- WORKSPACE CONTEXT ---
Workspace: Test workspace with some state

--- MEMORY CONTEXT (Conversation History) ---

[1] <user>
Hello, how are you?
</user>

[2] <assistant>
I am doing well, thank you!
</assistant>

--- TOOLS ---
[
  {
    "type": "function",
    "function": {
      "name": "test_tool",
      "description": "A test tool",
      "parameters": {
        "type": "object",
        "properties": {
          "param": {
            "type": "string"
          }
        }
      }
    }
  }
]

==============================================
```

To view the complete prompt structure, run:

```bash
pnpm vitest 'src/action/__tests__/ActionModule.prompt-inspection.test.ts' --reporter=verbose
```

## Problem

## Problem

When running the agent in end-to-end mode, the following error occurred:

```
[23:03:16.114] ERROR (4095021): API request failed
    error: {
      "name": "ValidationError",
      "message": "Tool at index 0 has invalid type",
      "code": "VALIDATION_ERROR",
      "statusCode": 400,
      "retryable": false,
      ...
    }
```

## Root Cause

In [`libs/agent-lib/src/agent/agent.ts`](libs/agent-lib/src/agent/agent.ts:410-420), the code was converting tools from the internal `Tool` format to OpenAI's `ChatCompletionTool` format, but then passing the wrong array to `performActionPhase`:

```typescript
// Convert tools to OpenAI format (inline utility)
const allTools = this.workspace.getAllTools();
const tools = allTools.map((t: { tool: any }) => t.tool);
const converter = new DefaultToolCallConverter();
const openaiTools = converter.convertTools(tools); // ← Converted tools

const actionResult: ActionPhaseResult =
  await this.actionModule.performActionPhase(
    currentWorkspaceContext,
    systemPrompt,
    conversationHistory,
    tools, // ← BUG: Should be openaiTools
    () => this.isAborted(),
  );
```

### Why This Caused the Error

The `Tool` interface (from `statefulContext/types.ts`) has the following structure:

```typescript
export interface Tool {
  toolName: string;
  paramsSchema: z.ZodTypeAny;
  desc: string;
}
```

The `ChatCompletionTool` interface (from `api-client/ApiClient.interface.ts`) requires:

```typescript
export interface ChatCompletionFunctionTool {
  function: FunctionDefinition;
  type: 'function'; // ← Required field
}
```

The `OpenaiCompatibleApiClient.validateRequestInputs()` method (line 312) validates that each tool has a `type` field that is either `'function'` or `'custom'`. Raw `Tool` objects don't have this field, causing the validation error.

## Solution

Changed line 420 in [`agent.ts`](libs/agent-lib/src/agent/agent.ts:420) to pass `openaiTools` instead of `tools`:

```typescript
const actionResult: ActionPhaseResult =
  await this.actionModule.performActionPhase(
    currentWorkspaceContext,
    systemPrompt,
    conversationHistory,
    openaiTools, // ← Fixed: Now passes converted tools
    () => this.isAborted(),
  );
```

## Testing

Created unit tests in [`libs/agent-lib/src/action/__tests__/ActionModule.tool-validation.test.ts`](libs/agent-lib/src/action/__tests__/ActionModule.tool-validation.test.ts) to verify:

1. Valid `ChatCompletionTool` objects with `type: 'function'` are accepted
2. Tools without a `type` field are rejected
3. Tools with invalid `type` values are rejected
4. Raw `Tool` objects (not converted) are rejected
5. Multiple valid tools are accepted
6. Mixed valid/invalid tools are rejected

All tests pass:

- `ActionModule.test.ts`: 7 tests passed
- `ActionModule.tool-validation.test.ts`: 6 tests passed
- `agent.meta-analysis.test.ts`: 26 tests passed
- `tool-conversion.unit.test.ts`: 5 tests passed

## Files Modified

1. [`libs/agent-lib/src/agent/agent.ts`](libs/agent-lib/src/agent/agent.ts:420) - Fixed the bug by passing `openaiTools` instead of `tools`
2. [`libs/agent-lib/src/action/__tests__/ActionModule.test.ts`](libs/agent-lib/src/action/__tests__/ActionModule.test.ts:47-55) - Added missing `MemoryModuleConfig` binding
3. [`libs/agent-lib/src/action/__tests__/ActionModule.tool-validation.test.ts`](libs/agent-lib/src/action/__tests__/ActionModule.tool-validation.test.ts) - New test file for tool validation
