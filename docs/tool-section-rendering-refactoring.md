# Tool Section Rendering Refactoring

## Summary

This document describes the refactoring of tool section rendering to separate System Context from Workspace Context.

## Problem

Previously, tool sections were rendered in both:

1. **System Context** (via `agent.getSystemPrompt()`)
2. **Workspace Context** (via `workspace.render()`)

This caused duplication and made it unclear where tool information should be rendered.

## Solution

### 1. Modified Source Code

#### [`libs/agent-lib/src/statefulContext/virtualWorkspace.ts`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:385)

Removed the `renderSkillToolsSection()` call from `_render()` method:

```typescript
// Before:
container.addChild(this.renderSkillsSection());

// Add skill tools section (if active skill has tools)
const skillToolsSection = this.renderSkillToolsSection();
if (skillToolsSection) {
  container.addChild(skillToolsSection);
}

// After:
container.addChild(this.renderSkillsSection());

// Note: Tool sections are NOT rendered in workspace.render()
// - Global tools are rendered via renderToolBox() in System Context (agent.ts)
// - Skill tools are rendered via renderSkillToolsSection() in System Context (agent.ts)
// - Component tools are rendered within their respective component sections below
```

#### [`libs/agent-lib/src/agent/agent.ts`](libs/agent-lib/src/agent/agent.ts:621)

Added `renderSkillToolsSection()` to the system prompt:

```typescript
// Render skill tools section (if active skill has tools)
// Note: renderSkillToolsSection() returns TUIElement | null
const skillToolsSection = this.workspace.renderSkillToolsSection();
const skillToolsRendered = skillToolsSection ? skillToolsSection.render() : '';

return `
${generateWorkspaceGuide()}
${this.renderAgentPrompt()}
${this.workspace.renderToolBox().render()}  // Global tools
${skillsSection}                             // Skills list
${skillToolsRendered}                        // Skill tools (NEW)
${skillsUsageGuidance}

${todoList}
`;
```

### 2. Updated Tests

#### Modified Existing Tests

Three tests in [`libs/agent-lib/src/statefulContext/__tests__/virtualWorkspace.skillComponent.test.ts`](libs/agent-lib/src/statefulContext/__tests__/virtualWorkspace.skillComponent.test.ts) were updated:

1. **`should render skill-specific tools section`** (line 475) - Now tests `renderToolBox().render()` instead of `workspace.render()`
2. **`should show skill tools section only when skill is active`** (line 507) - Now verifies that `SKILL TOOLS` does NOT appear in `workspace.render()`
3. **`should hide skill tools section when skill is deactivated`** (line 530) - Now verifies that `SKILL TOOLS` does NOT appear in `workspace.render()` after deactivation

#### Added New Tests

Added a new test suite **"ToolBox and Skill Tools Section Rendering (System Context)"** with 8 tests:

1. **`should render ToolBox with global tools`** - Verifies `renderToolBox().render()` contains "TOOL BOX"
2. **`should render skill tools section when skill is active`** - Verifies `renderSkillToolsSection()` returns content when skill is active
3. **`should hide skill tools section when skill is deactivated`** - Verifies `renderSkillToolsSection()` returns null when skill is deactivated
4. **`should render skill tools section for skill with multiple tools`** - Verifies all tool names are rendered
5. **`should update skill tools section when switching skills`** - Verifies the section updates when switching between skills
6. **`should not render tool sections in workspace.render()`** - Verifies neither "TOOL BOX" nor "SKILL TOOLS" appear in `workspace.render()`
7. **`should render tool sections in separate methods`** - Verifies separation between workspace, ToolBox, and skill tools rendering

## Result

### Tool Section Distribution

| Location                                                                                                        | What's Rendered                                                                                                                                                                                                       | Context Type          |
| --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **System Prompt** (via [`agent.getSystemPrompt()`](libs/agent-lib/src/agent/agent.ts:621))                      | - Global tools (via [`renderToolBox()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:325))<br>- Skill tools (via [`renderSkillToolsSection()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:253)) | **System Context**    |
| **Workspace Context** (via [`workspace._render()`](libs/agent-lib/src/statefulContext/virtualWorkspace.ts:357)) | - Skills section<br>- Skill components (with their own tool sections)<br>- Legacy components                                                                                                                          | **Workspace Context** |

### Key Benefits

1. **Clear Separation**: Tool sections are now clearly separated between System Context and Workspace Context
2. **No Duplication**: Tool information is no longer duplicated across contexts
3. **Better Testing**: New tests specifically validate the rendering of `renderToolBox()` and `renderSkillToolsSection()`
4. **Maintainability**: Clearer code structure makes it easier to understand where each type of content is rendered

## Test Results

All 62 tests in `libs/agent-lib/src/statefulContext/__tests__/` pass successfully.

```bash
Test Files  3 passed (3)
      Tests  62 passed | 20 skipped (82)
   Duration  589ms
```
