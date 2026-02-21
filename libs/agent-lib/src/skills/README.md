# TypeScript-Based Skill System

This directory contains the refactored skill system that supports TypeScript-based skill definitions with direct registration.

## Overview

The skill system provides:

- **Type Safety**: Full TypeScript type checking for skill definitions
- **Direct Registration**: Built-in skills are registered directly, not scanned from filesystem
- **Better IDE Support**: Autocomplete, refactoring, and inline documentation
- **Easier Testing**: Skills can be unit tested like regular TypeScript modules
- **Version Control**: Better diff tracking and code review
- **Flexibility**: Support for complex logic in lifecycle hooks
- **Backward Compatibility**: Markdown skills still supported for custom skills
- **Skill-Based Tool Control**: Skills can now provide tools that are only available when the skill is active

## Quick Start

### Using Built-in Skills (Automatic)

```typescript
import { VirtualWorkspace } from './statefulContext/virtualWorkspace.js';

// Built-in skills are automatically registered
const workspace = new VirtualWorkspace(config);

// Activate a skill
await workspace.activateSkill('paper-analysis');
```

### Manual Registration

```typescript
import { getBuiltinSkills, SkillRegistry } from './skills/index.js';

// Get all built-in skills
const skills = getBuiltinSkills();

// Register with SkillRegistry
const registry = new SkillRegistry();
registry.registerSkills(skills);

// Or register individually
import paperAnalysisSkill from './repository/builtin/paper-analysis.skill.js';
registry.registerSkill(paperAnalysisSkill);
```

## Architecture

### Core Components

1. **SkillDefinition.ts**: Builder for creating TypeScript-based skills
2. **SkillRegistry.ts**: Manages loading both TypeScript and Markdown skills
3. **SkillManager.ts**: Runtime skill activation and management
4. **SkillLoader.ts**: Legacy markdown skill parser (still supported)

### Skill Types

- **TypeScript Skills** (`.ts` files): New, recommended approach
- **Markdown Skills** (`.md` files): Legacy format, still supported

## Creating TypeScript Skills

### Method 1: Using `defineSkill` (Recommended)

```typescript
import { z } from 'zod';
import { defineSkill, createTool } from '../skills/SkillDefinition.js';

export default defineSkill({
    name: 'my-skill',
    displayName: 'My Skill',
    description: 'Brief description for LLM',
    whenToUse: 'Use this skill when...',
    version: '1.0.0',
    category: 'category-name',
    tags: ['tag1', 'tag2'],
    triggers: ['keyword1', 'keyword2'],

    capabilities: [
        'Capability 1',
        'Capability 2'
    ],

    workDirection: `
    Instructions for how to use this skill...
    `,

    // Skill-specific tools - only available when this skill is active
    tools: [
        createTool(
            'tool_name',
            'Tool description',
            z.object({
                param1: z.string().describe('Parameter description'),
                param2: z.number().optional()
            })
        )
    ],

    onActivate: async () => {
        // Tools are automatically added to the workspace when skill activates
        console.log('Skill activated - tools now available');
    },

    onDeactivate: async () => {
        // Tools are automatically removed from the workspace when skill deactivates
        console.log('Skill deactivated - tools removed');
    },

    metadata: {
        author: 'Your Name',
        created: '2025-02-19'
    }
});
```

### Method 2: Using `SkillDefinition` Builder

```typescript
import { SkillDefinition } from '../skills/SkillDefinition.js';

export const skill = SkillDefinition.create({
    // ... same config as above
});

export default skill.build();
```

### Method 3: Direct Skill Object

```typescript
import type { Skill } from '../skills/types.js';

const mySkill: Skill = {
    name: 'my-skill',
    displayName: 'My Skill',
    description: 'Brief description',
    prompt: {
        capability: 'Capabilities text',
        direction: 'Work direction text'
    },
    tools: [/* ... */],
    onActivate: async () => {},
    onDeactivate: async () => {}
};

export default mySkill;
```

## Skill File Naming

- TypeScript skills: `skill-name.skill.ts`
- Markdown skills: `skill-name.skill.md`
- Test files: `skill-name.skill.test.ts`

## Loading Skills

### Automatic Loading

The `SkillRegistry` automatically loads all skills from a directory:

```typescript
import { SkillRegistry } from './skills/SkillRegistry.js';

const registry = new SkillRegistry('./repository');
await registry.loadFromDirectory('./repository');

const skills = registry.getAll();
```

### Manual Loading

```typescript
// Load TypeScript skill
const skill = await registry.loadFromTypeScriptFile('./my-skill.skill.ts');

// Load Markdown skill
const content = readFileSync('./my-skill.skill.md', 'utf-8');
const skill = registry.loadFromContent(content);
```

## Skill Configuration

### Required Fields

- `name`: Unique identifier (kebab-case)
- `displayName`: Human-readable name
- `description`: Brief description for LLM selection
- `version`: Semantic version
- `capabilities`: Array of capability descriptions
- `workDirection`: Instructions for using the skill

### Optional Fields

- `whenToUse`: Guidance on when this skill should be used
- `category`: Skill category for organization
- `tags`: Tags for discovery
- `triggers`: Keywords that help LLM match this skill
- `tools`: Skill-specific tools (only available when skill is active)
- `onActivate`: Initialization logic (tools are automatically added)
- `onDeactivate`: Cleanup logic (tools are automatically removed)
- `metadata`: Additional metadata

## Tool Definition

Tools are defined using Zod schemas for type-safe parameter validation:

```typescript
import { z } from 'zod';
import { createTool } from '../skills/SkillDefinition.js';

const myTool = createTool(
    'tool_name',
    'Tool description for LLM',
    z.object({
        required_param: z.string().describe('Required parameter'),
        optional_param: z.number().optional().describe('Optional parameter'),
        enum_param: z.enum(['option1', 'option2']).describe('Enum parameter'),
        array_param: z.array(z.string()).describe('Array parameter')
    })
);
```

## Migration Guide

### Converting Markdown to TypeScript

1. Create a new `.ts` file with the same base name
2. Import required dependencies
3. Convert frontmatter to config object
4. Convert capabilities list to array
5. Convert work direction to string
6. Convert tool definitions to Zod schemas
7. Export using `defineSkill` or `SkillDefinition`

Example:

**Before (Markdown):**
```markdown
---
name: my-skill
version: 1.0.0
description: My skill description
category: analysis
tags: [tag1, tag2]
---

# My Skill

## Capabilities

- Capability 1
- Capability 2

## Work Direction

Instructions here...
```

**After (TypeScript):**
```typescript
import { defineSkill } from '../skills/SkillDefinition.js';

export default defineSkill({
    name: 'my-skill',
    displayName: 'My Skill',
    description: 'My skill description',
    whenToUse: 'Use this skill when you need to...',
    version: '1.0.0',
    category: 'analysis',
    tags: ['tag1', 'tag2'],
    capabilities: [
        'Capability 1',
        'Capability 2'
    ],
    workDirection: 'Instructions here...',
    tools: []
});
```

## Testing Skills

TypeScript skills can be tested like regular modules:

```typescript
import { describe, it, expect } from 'vitest';
import mySkill from './my-skill.skill.js';

describe('MySkill', () => {
    it('should have correct name', () => {
        expect(mySkill.name).toBe('my-skill');
    });

    it('should have tools', () => {
        expect(mySkill.tools).toBeDefined();
        expect(mySkill.tools?.length).toBeGreaterThan(0);
    });

    it('should activate successfully', async () => {
        await expect(mySkill.onActivate?.()).resolves.not.toThrow();
    });
});
```

## Tool Control

Skills can define tools that are only available when the skill is active. This allows for:

1. **Context-Aware Tools**: Tools that are only relevant for specific tasks
2. **Cleaner Interface**: The LLM only sees tools that are relevant to the current skill
3. **Dynamic Tool Availability**: Tools are added/removed automatically on skill activation/deactivation

### Tool Lifecycle

When a skill is activated:
1. The skill's `onActivate()` hook is called
2. All tools defined in the skill's `tools` array are added to the workspace
3. These tools become available for the LLM to use

When a skill is deactivated:
1. The skill's `onDeactivate()` hook is called
2. All tools from this skill are removed from the workspace
3. These tools are no longer available

### Tool Sources

The workspace tracks three types of tools:

- **Global Tools**: Always available (e.g., `attempt_completion`, `get_skill`)
- **Component Tools**: Always available from registered components
- **Skill Tools**: Only available when their associated skill is active

## Best Practices

1. **Use TypeScript**: Prefer TypeScript skills for new development
2. **Type Safety**: Leverage Zod schemas for parameter validation
3. **Documentation**: Add JSDoc comments for better IDE support
4. **Modularity**: Keep skills focused on a single domain
5. **Testing**: Write unit tests for complex skills
6. **Versioning**: Use semantic versioning
7. **Metadata**: Include author, creation date, and other relevant info
8. **Lifecycle Hooks**: Use onActivate/onDeactivate for setup/cleanup
9. **Error Handling**: Handle errors gracefully in lifecycle hooks
10. **Naming**: Use kebab-case for skill names, descriptive display names
11. **Tool Design**: Define tools that are specific to the skill's domain
12. **Tool Reuse**: Consider using tools from components when appropriate

## Examples

See the `repository/builtin/` directory for example skills:

- `paper-analysis.skill.ts`: Analysis skill with multiple tools
- `code-review.skill.ts`: Development skill with builder pattern

## API Reference

### defineSkill(config)

Creates a skill from a configuration object.

**Parameters:**
- `config: SkillDefinitionConfig` - Skill configuration

**Returns:** `Skill` - Runtime skill object

### createTool(name, description, schema)

Creates a tool definition.

**Parameters:**
- `name: string` - Tool name
- `description: string` - Tool description
- `schema: z.ZodType` - Zod schema for parameters

**Returns:** `Tool` - Tool definition

### SkillDefinition.create(config)

Creates a skill definition builder.

**Parameters:**
- `config: SkillDefinitionConfig` - Skill configuration

**Returns:** `SkillDefinition` - Builder instance

### SkillRegistry

Manages skill loading and registration.

**Methods:**
- `loadFromDirectory(path)`: Load all skills from directory
- `loadFromTypeScriptFile(path)`: Load TypeScript skill
- `loadFromContent(content)`: Load markdown skill
- `get(name)`: Get skill by name
- `getAll()`: Get all skills
- `search(query)`: Search skills
- `getByCategory(category)`: Get skills by category
- `getByTag(tag)`: Get skills by tag
- `getStats()`: Get statistics

## Troubleshooting

### Skill not loading

- Check file naming (must end with `.skill.ts`)
- Ensure default export or named `skill` export
- Check for syntax errors
- Verify import paths

### Type errors

- Ensure Zod schemas are properly defined
- Check that all required fields are provided
- Verify tool parameter types

### Runtime errors

- Check lifecycle hooks for errors
- Verify tool implementations
- Check console for error messages
