import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SkillRegistry } from '../SkillRegistry.js';
import { defineSkill } from '../SkillDefinition.js';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('SkillRegistry', () => {
    let registry: SkillRegistry;
    let testDir: string;

    beforeEach(() => {
        registry = new SkillRegistry();
        testDir = join(tmpdir(), `skill-registry-test-${Date.now()}`);
        mkdirSync(testDir, { recursive: true });
    });

    afterEach(() => {
        registry.clear();
        if (testDir) {
            rmSync(testDir, { recursive: true, force: true });
        }
    });

    describe('Markdown skill loading', () => {
        it('should load a markdown skill', () => {
            const markdownContent = `---
name: test-skill
version: 1.0.0
description: Test skill
category: test
tags: [tag1, tag2]
---

# Test Skill

## Capabilities

- Capability 1
- Capability 2

## Work Direction

Test direction
`;

            const skill = registry.loadFromContent(markdownContent);

            expect(skill.name).toBe('test-skill');
            expect(skill.displayName).toBe('Test Skill');
            expect(skill.description).toBe('Test skill');
        });

        it('should store markdown skill source', () => {
            const markdownContent = `---
name: test-skill
version: 1.0.0
description: Test skill
---

# Test Skill

## Capabilities

- Test

## Work Direction

Test
`;

            registry.loadFromContent(markdownContent);
            const source = registry['skills'].get('test-skill');

            expect(source?.type).toBe('markdown');
            expect(source?.parsed).toBeDefined();
        });
    });

    describe('TypeScript skill loading', () => {
        it('should load a TypeScript skill from definition', () => {
            const definition = defineSkill({
                name: 'ts-skill',
                displayName: 'TypeScript Skill',
                description: 'A TypeScript skill',
                version: '1.0.0',
                capabilities: ['Test capability'],
                workDirection: 'Test direction'
            });

            // Create a mock SkillDefinition
            const mockDefinition = {
                build: () => definition,
                getMetadata: () => ({
                    name: 'ts-skill',
                    version: '1.0.0',
                    category: 'test',
                    tags: ['tag1']
                })
            };

            const skill = registry.loadFromDefinition(mockDefinition as any);

            expect(skill.name).toBe('ts-skill');
            expect(skill.displayName).toBe('TypeScript Skill');
        });

        it('should store TypeScript skill source', () => {
            const definition = defineSkill({
                name: 'ts-skill',
                displayName: 'TypeScript Skill',
                description: 'A TypeScript skill',
                version: '1.0.0',
                capabilities: [],
                workDirection: 'Test'
            });

            const mockDefinition = {
                build: () => definition,
                getMetadata: () => ({
                    name: 'ts-skill',
                    version: '1.0.0'
                })
            };

            registry.loadFromDefinition(mockDefinition as any);
            const source = registry['skills'].get('ts-skill');

            expect(source?.type).toBe('typescript');
            expect(source?.definition).toBeDefined();
        });
    });

    describe('Skill retrieval', () => {
        beforeEach(() => {
            // Load a markdown skill
            const markdownContent = `---
name: markdown-skill
version: 1.0.0
description: Markdown skill
category: test
tags: [markdown]
---

# Markdown Skill

## Capabilities

- Test

## Work Direction

Test
`;
            registry.loadFromContent(markdownContent);

            // Load a TypeScript skill
            const tsSkill = defineSkill({
                name: 'ts-skill',
                displayName: 'TypeScript Skill',
                description: 'TypeScript skill',
                version: '1.0.0',
                category: 'test',
                tags: ['typescript'],
                capabilities: [],
                workDirection: 'Test'
            });

            const mockDefinition = {
                build: () => tsSkill,
                getMetadata: () => ({
                    name: 'ts-skill',
                    version: '1.0.0',
                    category: 'test',
                    tags: ['typescript']
                })
            };

            registry.loadFromDefinition(mockDefinition as any);
        });

        it('should get skill by name', () => {
            const skill = registry.get('markdown-skill');
            expect(skill).toBeDefined();
            expect(skill?.name).toBe('markdown-skill');
        });

        it('should get all skills', () => {
            const skills = registry.getAll();
            expect(skills.length).toBe(2);
        });

        it('should check if skill exists', () => {
            expect(registry.has('markdown-skill')).toBe(true);
            expect(registry.has('ts-skill')).toBe(true);
            expect(registry.has('nonexistent')).toBe(false);
        });

        it('should get skill names', () => {
            const names = registry.getNames();
            expect(names).toContain('markdown-skill');
            expect(names).toContain('ts-skill');
        });

        it('should get skills by category', () => {
            const skills = registry.getByCategory('test');
            expect(skills.length).toBe(2);
        });

        it('should get skills by tag', () => {
            const markdownSkills = registry.getByTag('markdown');
            expect(markdownSkills.length).toBe(1);
            expect(markdownSkills[0]?.name).toBe('markdown-skill');

            const tsSkills = registry.getByTag('typescript');
            expect(tsSkills.length).toBe(1);
            expect(tsSkills[0]?.name).toBe('ts-skill');
        });

        it('should search skills', () => {
            const results = registry.search('markdown');
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(s => s.name === 'markdown-skill')).toBe(true);
        });
    });

    describe('Skill management', () => {
        it('should unload a skill', () => {
            const markdownContent = `---
name: test-skill
version: 1.0.0
description: Test
---

# Test

## Capabilities

- Test

## Work Direction

Test
`;
            registry.loadFromContent(markdownContent);

            expect(registry.has('test-skill')).toBe(true);

            registry.unload('test-skill');

            expect(registry.has('test-skill')).toBe(false);
        });

        it('should clear all skills', () => {
            const markdownContent = `---
name: test-skill
version: 1.0.0
description: Test
---

# Test

## Capabilities

- Test

## Work Direction

Test
`;
            registry.loadFromContent(markdownContent);

            expect(registry.size).toBeGreaterThan(0);

            registry.clear();

            expect(registry.size).toBe(0);
        });

        it('should get size', () => {
            expect(registry.size).toBe(0);

            const markdownContent = `---
name: test-skill
version: 1.0.0
description: Test
---

# Test

## Capabilities

- Test

## Work Direction

Test
`;
            registry.loadFromContent(markdownContent);

            expect(registry.size).toBe(1);
        });
    });

    describe('Statistics', () => {
        beforeEach(() => {
            // Load markdown skill
            const markdownContent = `---
name: markdown-skill
version: 1.0.0
description: Markdown skill
category: analysis
tags: [markdown, test]
---

# Markdown Skill

## Capabilities

- Test

## Work Direction

Test
`;
            registry.loadFromContent(markdownContent);

            // Load TypeScript skill
            const tsSkill = defineSkill({
                name: 'ts-skill',
                displayName: 'TypeScript Skill',
                description: 'TypeScript skill',
                version: '1.0.0',
                category: 'development',
                tags: ['typescript', 'test'],
                capabilities: [],
                workDirection: 'Test'
            });

            const mockDefinition = {
                build: () => tsSkill,
                getMetadata: () => ({
                    name: 'ts-skill',
                    version: '1.0.0',
                    category: 'development',
                    tags: ['typescript', 'test']
                })
            };

            registry.loadFromDefinition(mockDefinition as any);
        });

        it('should get statistics', () => {
            const stats = registry.getStats();

            expect(stats.totalSkills).toBe(2);
            expect(stats.byType.markdown).toBe(1);
            expect(stats.byType.typescript).toBe(1);
            expect(stats.categories.analysis).toBe(1);
            expect(stats.categories.development).toBe(1);
            expect(stats.tags.test).toBe(2);
            expect(stats.tags.markdown).toBe(1);
            expect(stats.tags.typescript).toBe(1);
        });
    });
});
