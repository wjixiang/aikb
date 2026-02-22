# Skill System Migration Guide

This guide helps you migrate from markdown-based skills to TypeScript-based skills.

## Why Migrate?

TypeScript-based skills offer several advantages:

- **Type Safety**: Catch errors at compile time
- **Better IDE Support**: Autocomplete, refactoring, go-to-definition
- **Easier Testing**: Unit test skills like regular TypeScript modules
- **Better Maintainability**: Easier to refactor and update
- **Version Control**: Better diff tracking in git
- **Flexibility**: Support for complex logic in lifecycle hooks

## Migration Strategy

### Phase 1: Dual Support (Current)

Both markdown and TypeScript skills are supported. You can:
- Keep existing markdown skills running
- Create new skills in TypeScript
- Gradually migrate critical skills

### Phase 2: Gradual Migration

Migrate skills one by one:
1. Start with simple skills
2. Test thoroughly
3. Move to complex skills
4. Keep markdown as fallback

### Phase 3: TypeScript-Only (Future)

Eventually deprecate markdown support:
- All skills in TypeScript
- Remove SkillLoader
- Simplify codebase

## Automated Migration

Use the migration script for quick conversion:

```bash
# Dry run (preview changes)
node scripts/migrate-skills.js ./repository/builtin ./repository/builtin-ts --dry-run

# Actual migration
node scripts/migrate-skills.js ./repository/builtin ./repository/builtin-ts
```

The script will:
- Parse markdown skills
- Generate TypeScript code
- Preserve all metadata
- Convert tool definitions to Zod schemas

## Manual Migration

For complex skills or custom requirements, migrate manually:

### Step 1: Create TypeScript File

Create a new `.skill.ts` file next to the markdown file:

```
repository/
  builtin/
    my-skill.skill.md      # Original
    my-skill.skill.ts      # New
```

### Step 2: Convert Frontmatter

**Markdown:**
```markdown
---
name: my-skill
version: 1.0.0
description: My skill description
category: analysis
tags: [tag1, tag2]
---
```

**TypeScript:**
```typescript
{
    name: 'my-skill',
    displayName: 'My Skill',  // From H1 title
    description: 'My skill description',
    version: '1.0.0',
    category: 'analysis',
    tags: ['tag1', 'tag2']
}
```

### Step 3: Convert Capabilities

**Markdown:**
```markdown
## Capabilities

- Capability 1
- Capability 2
- Capability 3
```

**TypeScript:**
```typescript
capabilities: [
    'Capability 1',
    'Capability 2',
    'Capability 3'
]
```

### Step 4: Convert Work Direction

**Markdown:**
```markdown
## Work Direction

Instructions for using this skill...
```

**TypeScript:**
```typescript
workDirection: `
Instructions for using this skill...
`
```

### Step 5: Convert Tools

**Markdown:**
```markdown
## Provided Tools

### tool_name

Tool description

**Parameters:**
- `param1` (string, required): Parameter description
- `param2` (number, optional): Optional parameter

**Returns:**
- `result` (object, required): Result description
```

**TypeScript:**
```typescript
import { z } from 'zod';
import { createTool } from '../skills/SkillDefinition.js';

const toolNameSchema = z.object({
    param1: z.string().describe('Parameter description'),
    param2: z.number().optional().describe('Optional parameter')
});

const tools = [
    createTool(
        'tool_name',
        'Tool description',
        toolNameSchema
    )
];
```

### Step 6: Add Lifecycle Hooks

```typescript
onActivate: async () => {
    console.log('[MySkill] Activated');
    // Initialization logic
},

onDeactivate: async () => {
    console.log('[MySkill] Deactivated');
    // Cleanup logic
}
```

### Step 7: Export Skill

```typescript
import { defineSkill } from '../skills/SkillDefinition.js';

export default defineSkill({
    // ... configuration
});
```

## Complete Example

### Before (Markdown)

```markdown
---
name: paper-analysis
version: 1.0.0
description: Advanced paper analysis utilities
category: analysis
tags: [paper, analysis, statistics]
---

# Paper Analysis

Advanced paper analysis utilities for academic research.

## Capabilities

- Calculate paper complexity scores
- Extract and rank key citations
- Compare papers side-by-side

## Work Direction

When analyzing papers:
1. Use calculate_complexity for metrics
2. Use extract_key_citations for references
3. Use compare_papers for comparisons

## Provided Tools

### calculate_complexity

Calculate paper complexity scores.

**Parameters:**
- `paper_content` (string, required): The paper content
- `dimensions` (array, optional): Complexity dimensions

## Metadata

- **Author**: AI Knowledge Base Team
- **Created**: 2025-02-17
```

### After (TypeScript)

```typescript
import { z } from 'zod';
import { defineSkill, createTool } from '../../src/skills/SkillDefinition.js';

/**
 * Paper Analysis Skill
 *
 * Advanced paper analysis utilities for academic research.
 */

// Tool schemas
const calculateComplexitySchema = z.object({
    paper_content: z.string().describe('The paper content'),
    dimensions: z.array(z.string()).optional().describe('Complexity dimensions')
});

// Tools
const tools = [
    createTool(
        'calculate_complexity',
        'Calculate paper complexity scores',
        calculateComplexitySchema
    )
];

// Skill definition
export default defineSkill({
    name: 'paper-analysis',
    displayName: 'Paper Analysis',
    description: 'Advanced paper analysis utilities',
    version: '1.0.0',
    category: 'analysis',
    tags: ['paper', 'analysis', 'statistics'],

    capabilities: [
        'Calculate paper complexity scores',
        'Extract and rank key citations',
        'Compare papers side-by-side'
    ],

    workDirection: `
When analyzing papers:
1. Use calculate_complexity for metrics
2. Use extract_key_citations for references
3. Use compare_papers for comparisons
    `,

    tools,

    onActivate: async () => {
        console.log('[PaperAnalysis] Activated');
    },

    onDeactivate: async () => {
        console.log('[PaperAnalysis] Deactivated');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-02-17'
    }
});
```

## Testing Migrated Skills

Create a test file for each skill:

```typescript
import { describe, it, expect } from 'vitest';
import mySkill from './my-skill.skill.js';

describe('MySkill', () => {
    it('should have correct configuration', () => {
        expect(mySkill.name).toBe('my-skill');
        expect(mySkill.displayName).toBe('My Skill');
        expect(mySkill.description).toBeDefined();
    });

    it('should have tools', () => {
        expect(mySkill.tools).toBeDefined();
        expect(mySkill.tools?.length).toBeGreaterThan(0);
    });

    it('should activate successfully', async () => {
        await expect(mySkill.onActivate?.()).resolves.not.toThrow();
    });

    it('should deactivate successfully', async () => {
        await expect(mySkill.onDeactivate?.()).resolves.not.toThrow();
    });
});
```

## Common Migration Issues

### Issue 1: Complex Tool Parameters

**Problem:** Markdown doesn't support nested objects well.

**Solution:** Use Zod's full schema capabilities:

```typescript
const schema = z.object({
    config: z.object({
        nested: z.string(),
        array: z.array(z.number())
    }),
    options: z.record(z.string(), z.any())
});
```

### Issue 2: Dynamic Tool Generation

**Problem:** Markdown is static, can't generate tools dynamically.

**Solution:** Use TypeScript logic:

```typescript
const tools = ['tool1', 'tool2', 'tool3'].map(name =>
    createTool(
        name,
        `Description for ${name}`,
        z.object({ input: z.string() })
    )
);
```

### Issue 3: Shared Logic

**Problem:** Can't share code between markdown skills.

**Solution:** Import shared utilities:

```typescript
import { commonSchema, commonLogic } from './shared.js';

export default defineSkill({
    // ... use commonSchema and commonLogic
});
```

### Issue 4: Complex Lifecycle Logic

**Problem:** Markdown doesn't support initialization logic.

**Solution:** Implement in lifecycle hooks:

```typescript
let cache: Map<string, any>;

onActivate: async () => {
    cache = new Map();
    await loadInitialData();
},

onDeactivate: async () => {
    cache.clear();
    await cleanup();
}
```

## Validation Checklist

After migration, verify:

- [ ] Skill loads without errors
- [ ] All tools are defined correctly
- [ ] Tool parameters validate properly
- [ ] Capabilities are complete
- [ ] Work direction is clear
- [ ] Lifecycle hooks work
- [ ] Tests pass
- [ ] Metadata is preserved
- [ ] Documentation is updated

## Rollback Plan

If migration causes issues:

1. Keep markdown file as backup
2. Remove or rename TypeScript file
3. Registry will load markdown version
4. Fix issues in TypeScript version
5. Try again

## Best Practices

1. **Migrate Incrementally**: One skill at a time
2. **Test Thoroughly**: Write tests for each skill
3. **Keep Backups**: Don't delete markdown files immediately
4. **Document Changes**: Note any behavior changes
5. **Review Code**: Have someone review TypeScript version
6. **Monitor Production**: Watch for issues after deployment

## Getting Help

If you encounter issues:

1. Check the README.md for examples
2. Look at existing TypeScript skills
3. Review test files for patterns
4. Ask the team for help
5. File an issue if you find bugs

## Timeline

Recommended migration timeline:

- **Week 1-2**: Migrate simple skills (no tools)
- **Week 3-4**: Migrate skills with basic tools
- **Week 5-6**: Migrate complex skills
- **Week 7-8**: Testing and refinement
- **Week 9+**: Deprecate markdown support

## Conclusion

TypeScript-based skills provide a more robust, maintainable foundation for the skill system. Take your time with migration, test thoroughly, and don't hesitate to ask for help.
