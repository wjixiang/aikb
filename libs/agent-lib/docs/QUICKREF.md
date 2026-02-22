# TypeScript Skills Quick Reference

## Create a Skill

```typescript
import { z } from 'zod';
import { defineSkill, createTool } from '../skills/SkillDefinition.js';

export default defineSkill({
    // Required
    name: 'skill-name',              // kebab-case
    displayName: 'Skill Name',       // Human-readable
    description: 'Brief description',
    version: '1.0.0',
    capabilities: ['Cap 1', 'Cap 2'],
    workDirection: 'Instructions...',

    // Optional
    category: 'category-name',
    tags: ['tag1', 'tag2'],
    triggers: ['keyword1', 'keyword2'],
    tools: [/* tools */],
    onActivate: async () => {},
    onDeactivate: async () => {},
    metadata: { key: 'value' }
});
```

## Create a Tool

```typescript
const myTool = createTool(
    'tool_name',
    'Tool description',
    z.object({
        required: z.string().describe('Required param'),
        optional: z.number().optional().describe('Optional param'),
        enum: z.enum(['a', 'b']).describe('Enum param'),
        array: z.array(z.string()).describe('Array param')
    })
);
```

## Common Zod Types

```typescript
z.string()                    // String
z.number()                    // Number
z.boolean()                   // Boolean
z.array(z.string())          // Array of strings
z.object({ key: z.string() }) // Object
z.enum(['a', 'b', 'c'])      // Enum
z.record(z.string(), z.any()) // Record/Map
z.any()                       // Any type
.optional()                   // Make optional
.describe('Description')      // Add description
```

## Load Skills

```typescript
import { SkillRegistry } from './skills/SkillRegistry.js';

const registry = new SkillRegistry();
await registry.loadFromDirectory('./repository');

const skills = registry.getAll();
const skill = registry.get('skill-name');
```

## Test a Skill

```typescript
import { describe, it, expect } from 'vitest';
import mySkill from './my-skill.skill.js';

describe('MySkill', () => {
    it('should have correct name', () => {
        expect(mySkill.name).toBe('my-skill');
    });

    it('should activate', async () => {
        await expect(mySkill.onActivate?.()).resolves.not.toThrow();
    });
});
```

## File Naming

- Skill: `skill-name.skill.ts`
- Test: `skill-name.skill.test.ts`
- Location: `repository/category/skill-name.skill.ts`

## Migration

```bash
# Dry run
node scripts/migrate-skills.js ./input ./output --dry-run

# Actual migration
node scripts/migrate-skills.js ./input ./output
```

## Best Practices

1. Use `defineSkill` for simplicity
2. Use descriptive names and descriptions
3. Add JSDoc comments for documentation
4. Write tests for complex skills
5. Use semantic versioning
6. Keep capabilities focused
7. Provide clear work direction
8. Use Zod for parameter validation
9. Handle errors in lifecycle hooks
10. Document metadata

## Common Patterns

### Simple Skill (No Tools)

```typescript
export default defineSkill({
    name: 'simple-skill',
    displayName: 'Simple Skill',
    description: 'A simple skill',
    version: '1.0.0',
    capabilities: ['Do something'],
    workDirection: 'Just do it'
});
```

### Skill with Tools

```typescript
const tools = [
    createTool('tool1', 'Description', z.object({ /* schema */ })),
    createTool('tool2', 'Description', z.object({ /* schema */ }))
];

export default defineSkill({
    // ... config
    tools
});
```

### Skill with Lifecycle

```typescript
let cache: Map<string, any>;

export default defineSkill({
    // ... config
    onActivate: async () => {
        cache = new Map();
        await initialize();
    },
    onDeactivate: async () => {
        cache.clear();
        await cleanup();
    }
});
```

### Builder Pattern

```typescript
import { SkillDefinition } from '../skills/SkillDefinition.js';

export const skill = SkillDefinition.create({
    // ... config
});

export default skill.build();
```

## Troubleshooting

**Skill not loading?**
- Check file naming (must end with `.skill.ts`)
- Ensure default export or named `skill` export
- Check for syntax errors

**Type errors?**
- Verify Zod schemas
- Check required fields
- Ensure proper imports

**Runtime errors?**
- Check lifecycle hooks
- Verify tool implementations
- Check console for errors

## Resources

- Full docs: `src/skills/README.md`
- Migration guide: `MIGRATION.md`
- Examples: `repository/builtin/*.skill.ts`
- Tests: `src/skills/__tests__/*.test.ts`
