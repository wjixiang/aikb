import { describe, it, expect } from 'vitest';
import { SkillParser } from '../parser/SkillParser';
import { SkillSerializer } from '../parser/SkillSerializer';
import { Skill } from '../core/Skill.interface';

describe('Skill Frontmatter', () => {
  const parser = new SkillParser();
  const serializer = new SkillSerializer();

  it('should parse description from frontmatter', () => {
    const markdown = `---
name: test-skill
version: 1.0.0
description: This is a test skill
category: testing
tags: [test, example]
---

# Test Skill

This is a test skill for unit testing.

## Capabilities

- Test capability 1
- Test capability 2
`;

    const skill = parser.parse(markdown);

    expect(skill.name).toBe('test-skill');
    expect(skill.version).toBe('1.0.0');
    expect(skill.description).toBe('This is a test skill');
    expect(skill.metadata?.category).toBe('testing');
    expect(skill.metadata?.tags).toEqual(['test', 'example']);
  });

  it('should fallback to body description if frontmatter missing', () => {
    const markdown = `---
name: test-skill
version: 1.0.0
category: testing
---

# Test Skill

This is the body description.

## Capabilities

- Test capability
`;

    const skill = parser.parse(markdown);

    expect(skill.description).toBe('This is the body description.');
  });

  it('should serialize description to frontmatter', () => {
    const skill: Skill = {
      name: 'test-skill',
      version: '1.0.0',
      description: 'Test skill description',
      metadata: {
        category: 'testing',
        tags: ['test']
      }
    };

    const markdown = serializer.serialize(skill);

    expect(markdown).toContain('name: test-skill');
    expect(markdown).toContain('version: 1.0.0');
    expect(markdown).toContain('description: Test skill description');
    expect(markdown).toContain('category: testing');
    expect(markdown).toContain('tags: [test]');
  });

  it('should round-trip parse and serialize', () => {
    const originalMarkdown = `---
name: round-trip-test
version: 2.0.0
description: Round trip test skill
category: testing
tags: [test, round-trip]
---

# Round Trip Test

Round trip test skill.

## Capabilities

- Capability 1
- Capability 2

## Work Direction

Step 1: Do something
Step 2: Do something else
`;

    const skill = parser.parse(originalMarkdown);
    const serialized = serializer.serialize(skill);
    const reparsed = parser.parse(serialized);

    expect(reparsed.name).toBe(skill.name);
    expect(reparsed.version).toBe(skill.version);
    expect(reparsed.description).toBe(skill.description);
    expect(reparsed.metadata?.category).toBe(skill.metadata?.category);
    expect(reparsed.metadata?.tags).toEqual(skill.metadata?.tags);
  });

  it('should handle multiline description in frontmatter', () => {
    const markdown = `---
name: multiline-test
version: 1.0.0
description: This is a multiline description that spans multiple lines
category: testing
---

# Multiline Test
`;

    const skill = parser.parse(markdown);

    expect(skill.description).toContain('This is a multiline description');
  });

  it('should prioritize frontmatter description over body', () => {
    const markdown = `---
name: priority-test
version: 1.0.0
description: Frontmatter description
category: testing
---

# Priority Test

Body description that should be ignored.
`;

    const skill = parser.parse(markdown);

    expect(skill.description).toBe('Frontmatter description');
  });
});
