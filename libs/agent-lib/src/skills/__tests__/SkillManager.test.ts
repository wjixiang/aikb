import { describe, it, expect, beforeEach } from 'vitest';
import { SkillManager } from '../SkillManager.js';
import type { Skill } from '../types.js';

// Test fixtures - inline skill definitions for testing
const testSkill1: Skill = {
    name: 'test-skill-1',
    displayName: 'Test Skill 1',
    description: 'A test skill for unit testing',
    triggers: ['test', 'demo'],
    prompt: {
        capability: 'Test capability description',
        direction: 'Test direction for how to use this skill'
    }
};

const testSkill2: Skill = {
    name: 'test-skill-2',
    displayName: 'Test Skill 2',
    description: 'Another test skill with statistical analysis',
    triggers: ['analysis', 'stats'],
    prompt: {
        capability: 'Statistical analysis capability',
        direction: 'Analyze data statistically'
    }
};

describe('SkillManager', () => {
    let manager: SkillManager;

    beforeEach(() => {
        manager = new SkillManager();
    });

    describe('registration', () => {
        it('should register a skill', () => {
            manager.register(testSkill1);
            expect(manager.has('test-skill-1')).toBe(true);
            expect(manager.size).toBe(1);
        });

        it('should register multiple skills', () => {
            manager.registerAll([testSkill1, testSkill2]);
            expect(manager.size).toBe(2);
            expect(manager.getSkillNames()).toContain('test-skill-1');
            expect(manager.getSkillNames()).toContain('test-skill-2');
        });

        it('should unregister a skill', () => {
            manager.register(testSkill1);
            expect(manager.unregister('test-skill-1')).toBe(true);
            expect(manager.has('test-skill-1')).toBe(false);
        });

        it('should not unregister active skill', async () => {
            manager.register(testSkill1);
            await manager.activateSkill('test-skill-1');
            expect(manager.unregister('test-skill-1')).toBe(false);
            expect(manager.has('test-skill-1')).toBe(true);
        });
    });

    describe('activation', () => {
        beforeEach(() => {
            manager.registerAll([testSkill1, testSkill2]);
        });

        it('should activate a skill', async () => {
            const result = await manager.activateSkill('test-skill-1');
            expect(result.success).toBe(true);
            expect(result.skill?.name).toBe('test-skill-1');
            expect(manager.getActiveSkill()?.name).toBe('test-skill-1');
        });

        it('should return error for non-existent skill', async () => {
            const result = await manager.activateSkill('non-existent');
            expect(result.success).toBe(false);
            expect(result.message).toContain('not found');
        });

        it('should switch between skills', async () => {
            await manager.activateSkill('test-skill-1');
            expect(manager.getActiveSkill()?.name).toBe('test-skill-1');

            await manager.activateSkill('test-skill-2');
            expect(manager.getActiveSkill()?.name).toBe('test-skill-2');
        });

        it('should return success when activating same skill', async () => {
            await manager.activateSkill('test-skill-1');
            const result = await manager.activateSkill('test-skill-1');
            expect(result.success).toBe(true);
            expect(result.message).toContain('already active');
        });

        it('should deactivate skill', async () => {
            await manager.activateSkill('test-skill-1');
            const result = await manager.deactivateSkill();
            expect(result.success).toBe(true);
            expect(manager.getActiveSkill()).toBeNull();
        });
    });

    describe('prompt enhancement', () => {
        it('should return null when no skill active', () => {
            expect(manager.getActivePrompt()).toBeNull();
        });

        it('should return prompt when skill active', async () => {
            manager.register(testSkill1);
            await manager.activateSkill('test-skill-1');

            const prompt = manager.getActivePrompt();
            expect(prompt).not.toBeNull();
            expect(prompt?.capability).toBe('Test capability description');
            expect(prompt?.direction).toBe('Test direction for how to use this skill');
        });
    });

    describe('tools', () => {
        it('should return empty array when no skill active', () => {
            expect(manager.getActiveTools()).toEqual([]);
        });

        it('should return empty array for skill without tools', async () => {
            manager.register(testSkill1);
            await manager.activateSkill('test-skill-1');

            const tools = manager.getActiveTools();
            expect(tools).toEqual([]);
        });
    });

    describe('skill discovery', () => {
        beforeEach(() => {
            manager.registerAll([testSkill1, testSkill2]);
        });

        it('should get available skills', () => {
            const skills = manager.getAvailableSkills();
            expect(skills.length).toBe(2);
            expect(skills[0]).toHaveProperty('name');
            expect(skills[0]).toHaveProperty('description');
        });

        it('should find matching skills by name', () => {
            const matches = manager.findMatchingSkills('test-skill-1');
            expect(matches.length).toBe(1);
            expect(matches[0]?.name).toBe('test-skill-1');
        });

        it('should find matching skills by trigger', () => {
            const matches = manager.findMatchingSkills('demo');
            expect(matches.length).toBe(1);
            expect(matches[0]?.name).toBe('test-skill-1');
        });

        it('should find matching skills by description', () => {
            const matches = manager.findMatchingSkills('statistical');
            expect(matches.length).toBe(1);
            expect(matches[0]?.name).toBe('test-skill-2');
        });
    });

    describe('callbacks', () => {
        it('should call onSkillChange when skill activated', async () => {
            let changedSkill: Skill | null = null;
            const testManager = new SkillManager({
                onSkillChange: (skill) => { changedSkill = skill as Skill | null; }
            });

            testManager.register(testSkill1);
            await testManager.activateSkill('test-skill-1');
            expect(testManager).toBeInstanceOf(SkillManager);
            expect(changedSkill?.name).toBe('test-skill-1');
        });

        it('should call onSkillChange with null when deactivated', async () => {
            let changedSkill: Skill | null = null;
            const testManager = new SkillManager({
                onSkillChange: (skill) => { changedSkill = skill as Skill | null; }
            });

            testManager.register(testSkill1);
            await testManager.activateSkill('test-skill-1');
            await testManager.deactivateSkill();

            expect(changedSkill).toBeNull();
        });
    });
});
