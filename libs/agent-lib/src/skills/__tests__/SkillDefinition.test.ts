import { describe, it, expect, beforeEach } from 'vitest';
import { SkillDefinition, defineSkill, createTool } from '../SkillDefinition.js';
import { z } from 'zod';

describe('SkillDefinition', () => {
    describe('defineSkill', () => {
        it('should create a skill with basic configuration', () => {
            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: ['Test capability'],
                workDirection: 'Test direction'
            });

            expect(skill.name).toBe('test-skill');
            expect(skill.displayName).toBe('Test Skill');
            expect(skill.description).toBe('A test skill');
            expect(skill.prompt.capability).toContain('Test capability');
            expect(skill.prompt.direction).toBe('Test direction');
        });

        it('should create a skill with tools', () => {
            const tool = createTool(
                'test_tool',
                'Test tool description',
                z.object({
                    param1: z.string()
                })
            );

            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: [],
                workDirection: 'Test',
                tools: [tool]
            });

            expect(skill.tools).toBeDefined();
            expect(skill.tools?.length).toBe(1);
            expect(skill.tools?.[0]?.toolName).toBe('test_tool');
        });

        it('should create a skill with lifecycle hooks', async () => {
            let activated = false;
            let deactivated = false;

            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: [],
                workDirection: 'Test',
                onActivate: async () => {
                    activated = true;
                },
                onDeactivate: async () => {
                    deactivated = true;
                }
            });

            await skill.onActivate?.();
            expect(activated).toBe(true);

            await skill.onDeactivate?.();
            expect(deactivated).toBe(true);
        });

        it('should include tags and triggers', () => {
            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                tags: ['tag1', 'tag2'],
                triggers: ['trigger1', 'trigger2'],
                capabilities: [],
                workDirection: 'Test'
            });

            expect(skill.triggers).toEqual(['trigger1', 'trigger2']);
        });

        it('should use tags as triggers if triggers not provided', () => {
            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                tags: ['tag1', 'tag2'],
                capabilities: [],
                workDirection: 'Test'
            });

            expect(skill.triggers).toEqual(['tag1', 'tag2']);
        });
    });

    describe('SkillDefinition.create', () => {
        it('should create a skill definition builder', () => {
            const definition = SkillDefinition.create({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: [],
                workDirection: 'Test'
            });

            expect(definition).toBeInstanceOf(SkillDefinition);
        });

        it('should build a skill from definition', () => {
            const definition = SkillDefinition.create({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: [],
                workDirection: 'Test'
            });

            const skill = definition.build();

            expect(skill.name).toBe('test-skill');
            expect(skill.displayName).toBe('Test Skill');
        });

        it('should provide metadata', () => {
            const definition = SkillDefinition.create({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                category: 'test-category',
                tags: ['tag1'],
                capabilities: [],
                workDirection: 'Test',
                metadata: {
                    author: 'Test Author'
                }
            });

            const metadata = definition.getMetadata();

            expect(metadata.name).toBe('test-skill');
            expect(metadata.version).toBe('1.0.0');
            expect(metadata.category).toBe('test-category');
            expect(metadata.tags).toEqual(['tag1']);
            expect(metadata.metadata?.author).toBe('Test Author');
        });
    });

    describe('createTool', () => {
        it('should create a tool with schema', () => {
            const schema = z.object({
                param1: z.string().describe('First parameter'),
                param2: z.number().optional().describe('Second parameter')
            });

            const tool = createTool('test_tool', 'Test tool', schema);

            expect(tool.toolName).toBe('test_tool');
            expect(tool.desc).toBe('Test tool');
            expect(tool.paramsSchema).toBe(schema);
        });

        it('should validate parameters with schema', () => {
            const schema = z.object({
                name: z.string(),
                age: z.number()
            });

            const tool = createTool('test_tool', 'Test tool', schema);

            // Valid params
            const validResult = tool.paramsSchema.safeParse({
                name: 'John',
                age: 30
            });
            expect(validResult.success).toBe(true);

            // Invalid params
            const invalidResult = tool.paramsSchema.safeParse({
                name: 'John',
                age: 'thirty'
            });
            expect(invalidResult.success).toBe(false);
        });
    });

    describe('Capability formatting', () => {
        it('should format capabilities as bullet list', () => {
            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: [
                    'Capability 1',
                    'Capability 2',
                    'Capability 3'
                ],
                workDirection: 'Test'
            });

            expect(skill.prompt.capability).toContain('- Capability 1');
            expect(skill.prompt.capability).toContain('- Capability 2');
            expect(skill.prompt.capability).toContain('- Capability 3');
        });

        it('should handle empty capabilities', () => {
            const skill = defineSkill({
                name: 'test-skill',
                displayName: 'Test Skill',
                description: 'A test skill',
                version: '1.0.0',
                capabilities: [],
                workDirection: 'Test'
            });

            expect(skill.prompt.capability).toBe('');
        });
    });
});
