# Skill Tool Execution Call Chain

## Architecture Overview

The VirtualWorkspace uses a **tool enable/disable model** where:

1. **All component tools are loaded into toolSet** at component registration
2. **Skills control which tools are enabled** (callable) and rendered
3. Skills don't add/remove tools from toolSet - they only toggle the `enabled` flag

## Solution: Handler-Based Tool Execution

Instead of relying on `componentKey` lookup, we store the **handler function directly in the `ToolRegistration`**. This allows direct execution without component lookup.

## Architecture Changes

### 1. Extended `ToolRegistration` Interface

```typescript
export interface ToolRegistration {
    tool: Tool;                    // Tool definition (name, description, paramsSchema)
    source: ToolSource;            // Where the tool comes from (GLOBAL/COMPONENT/SKILL)
    componentKey?: string;         // For component tools (metadata only)
    skillName?: string;            // For skill tools (metadata only)
    enabled: boolean;              // Whether the tool is currently available
    handler?: (params: any) => Promise<any>;  // NEW: Handler function for execution
}
```

### 2. Tool Registration with Handlers

**Component Tools:**
```typescript
registerComponent(registration: ComponentRegistration): void {
    registration.component.toolSet.forEach((value: Tool) => {
        this.toolSet.set(value.toolName, {
            tool: value,
            source: ToolSource.COMPONENT,
            componentKey: registration.key,
            enabled: true,
            handler: async (params: any) => {
                // Handler directly calls the component's handleToolCall
                await registration.component.handleToolCall(value.toolName, params);
            }
        });
    })
}
```

**Skill Tool Enable/Disable:**
```typescript
private handleSkillChange(skill: Skill | null): void {
    // Disable previous skill's tools
    for (const toolName of this.skillToolNames) {
        const registration = this.toolSet.get(toolName);
        if (registration?.source === ToolSource.COMPONENT) {
            registration.enabled = false;
        }
    }
    this.skillToolNames.clear();

    // Enable new skill's tools
    if (skill?.tools) {
        for (const tool of skill.tools) {
            const registration = this.toolSet.get(tool.toolName);
            if (registration?.source === ToolSource.COMPONENT) {
                registration.enabled = true;  // Enable this tool
                this.skillToolNames.add(tool.toolName);
            }
        }
    } else {
        // No skill active, enable all component tools
        for (const [toolName, registration] of this.toolSet.entries()) {
            if (registration.source === ToolSource.COMPONENT) {
                registration.enabled = true;
            }
        }
    }
}
```

## Call Chain

### When a Skill Tool is Called

```
1. LLM calls a tool
   ↓
2. VirtualWorkspace.handleToolCall(toolName, params)
   ↓
3. Look up ToolRegistration in toolSet
   ↓
4. Check if tool is enabled
   ↓
5. Call toolRegistration.handler(params)
   ↓
6. Handler executes component.handleToolCall(toolName, params)
   ↓
7. Component processes the tool call and updates its state
   ↓
8. Return result to LLM
```

### Example: PICO Extraction Skill

**Skill Definition:**
```typescript
// pico-extraction.skill.ts
export default defineSkill({
    name: 'pico-extraction',
    tools: [
        setPicosElementTool,      // From PicosComponent
        generateClinicalQuestionTool,  // From PicosComponent
        // ... other tools
    ]
});
```

**Registration Flow:**
1. PicosComponent is registered with workspace
   - All component tools are added to toolSet with handlers
   - Tools are initially enabled

2. pico-extraction skill is activated
   - handleSkillChange() is called
   - All component tools are disabled
   - Only tools defined in pico-extraction skill are enabled
   - set_picos_element is enabled (source: COMPONENT, enabled: true)

3. LLM calls set_picos_element
   - handleToolCall('set_picos_element', params)
   - Get ToolRegistration (source: COMPONENT, enabled: true, handler: function)
   - Check enabled flag → true
   - Call handler(params)
   - Handler calls PicosComponent.handleToolCall('set_picos_element', params)
   - PicosComponent updates its state

4. pico-extraction skill is deactivated
   - All component tools are re-enabled

## Benefits

1. **No componentKey Required**: Tools can be executed directly via their handler
2. **Skill Enable/Disable Model**: Skills control which tools are available without adding/removing from toolSet
3. **Simpler Architecture**: Single source of truth (ToolRegistration) for both metadata and execution
4. **Flexible**: Can support standalone tools in the future (tools with their own handlers, not from components)
5. **Cleaner State Management**: Tools stay in toolSet, only their enabled state changes

## Files Modified

1. [`libs/agent-lib/src/skills/types.ts`](../libs/agent-lib/src/skills/types.ts) - Added `handler` to `ToolRegistration`
2. [`libs/agent-lib/src/statefulContext/virtualWorkspace.ts`](../libs/agent-lib/src/statefulContext/virtualWorkspace.ts) - Updated tool registration and execution

## Related Documentation

- [Skill-Based Tool Control Implementation](./skill-based-tool-control-implementation.md)
- [Skill-Based Tool Control Architecture](../plans/skill-based-tool-control-architecture.md)
