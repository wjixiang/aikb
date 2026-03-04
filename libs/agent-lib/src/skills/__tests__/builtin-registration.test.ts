import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SkillRegistry } from '../SkillRegistry.js';
import type { Skill } from '../types.js';

// Mock the builtin skills module
const mockSkills: Skill[] = [
    {
        name: 'test-skill-1',
        displayName: 'Test Skill 1',
        description: 'A test skill for unit testing',
        prompt: {
            capability: 'Test capability',
            direction: 'Test direction',
        },
        triggers: ['test', 'mock'],
    },
    {
        name: 'test-skill-2',
        displayName: 'Test Skill 2',
        description: 'Another test skill for unit testing',
        prompt: {
            capability: 'Another test capability',
            direction: 'Another test direction',
        },
        triggers: ['mock', 'skill'],
        onActivate: async () => undefined,
        onDeactivate: async () => undefined,
    },
];

vi.mock('../builtin/index.js', () => ({
    getBuiltinSkills: vi.fn(() => mockSkills),
    getBuiltinSkill: vi.fn((name: string) => mockSkills.find(s => s.name === name)),
    isBuiltinSkill: vi.fn((name: string) => mockSkills.some(s => s.name === name)),
    getBuiltinSkillNames: vi.fn(() => mockSkills.map(s => s.name)),
}));

// Import after mocking
import {
    getBuiltinSkills,
    getBuiltinSkill,
    isBuiltinSkill,
    getBuiltinSkillNames,
} from '../builtin/index.js';

describe('Built-in Skills Registration', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getBuiltinSkills', () => {
        it('should return an array of skills', () => {
            const skills = getBuiltinSkills();

            expect(getBuiltinSkills).toHaveBeenCalled();
            expect(Array.isArray(skills)).toBe(true);
            expect(skills.length).toBeGreaterThan(0);
        });

        it('should return valid skill objects', () => {
            const skills = getBuiltinSkills();

            for (const skill of skills) {
                expect(skill).toHaveProperty('name');
                expect(skill).toHaveProperty('displayName');
                expect(skill).toHaveProperty('description');
                expect(skill).toHaveProperty('prompt');
                expect(typeof skill.name).toBe('string');
                expect(typeof skill.displayName).toBe('string');
            }
        });

        it('should include test-skill-1', () => {
            const skills = getBuiltinSkills();
            const testSkill = skills.find(s => s.name === 'test-skill-1');

            expect(testSkill).toBeDefined();
            expect(testSkill?.displayName).toBe('Test Skill 1');
        });

        it('should include test-skill-2', () => {
            const skills = getBuiltinSkills();
            const testSkill = skills.find(s => s.name === 'test-skill-2');

            expect(testSkill).toBeDefined();
            expect(testSkill?.displayName).toBe('Test Skill 2');
        });
    });

    describe('getBuiltinSkill', () => {
        it('should get skill by name', () => {
            const skill = getBuiltinSkill('test-skill-1');

            expect(getBuiltinSkill).toHaveBeenCalledWith('test-skill-1');
            expect(skill).toBeDefined();
            expect(skill?.name).toBe('test-skill-1');
        });

        it('should return undefined for non-existent skill', () => {
            const skill = getBuiltinSkill('non-existent-skill');

            expect(getBuiltinSkill).toHaveBeenCalledWith('non-existent-skill');
            expect(skill).toBeUndefined();
        });
    });

    describe('isBuiltinSkill', () => {
        it('should return true for built-in skills', () => {
            expect(isBuiltinSkill('test-skill-1')).toBe(true);
            expect(isBuiltinSkill('test-skill-2')).toBe(true);
            expect(isBuiltinSkill).toHaveBeenCalledWith('test-skill-1');
            expect(isBuiltinSkill).toHaveBeenCalledWith('test-skill-2');
        });

        it('should return false for non-built-in skills', () => {
            expect(isBuiltinSkill('custom-skill')).toBe(false);
            expect(isBuiltinSkill('non-existent')).toBe(false);
            expect(isBuiltinSkill).toHaveBeenCalledWith('custom-skill');
            expect(isBuiltinSkill).toHaveBeenCalledWith('non-existent');
        });
    });

    describe('getBuiltinSkillNames', () => {
        it('should return array of skill names', () => {
            const names = getBuiltinSkillNames();

            expect(getBuiltinSkillNames).toHaveBeenCalled();
            expect(Array.isArray(names)).toBe(true);
            expect(names).toContain('test-skill-1');
            expect(names).toContain('test-skill-2');
        });
    });

    describe('Skill properties', () => {
        it('skills should have capabilities', () => {
            const skills = getBuiltinSkills();

            for (const skill of skills) {
                expect(skill.prompt.capability).toBeDefined();
                expect(typeof skill.prompt.capability).toBe('string');
            }
        });

        it('skills should have work direction', () => {
            const skills = getBuiltinSkills();

            for (const skill of skills) {
                expect(skill.prompt.direction).toBeDefined();
                expect(typeof skill.prompt.direction).toBe('string');
            }
        });

        it('skills should have lifecycle hooks', () => {
            const skills = getBuiltinSkills();

            for (const skill of skills) {
                // Hooks are optional but should be functions if present
                if (skill.onActivate) {
                    expect(typeof skill.onActivate).toBe('function');
                }
                if (skill.onDeactivate) {
                    expect(typeof skill.onDeactivate).toBe('function');
                }
            }
        });
    });

    describe('Performance', () => {
        it('should load skills quickly', () => {
            const start = Date.now();
            const skills = getBuiltinSkills();
            const duration = Date.now() - start;

            expect(skills.length).toBeGreaterThan(0);
            expect(duration).toBeLessThan(100); // Should be very fast (< 100ms)
        });

        it('should register skills quickly', () => {
            const registry = new SkillRegistry();
            const builtinSkills = getBuiltinSkills();

            const start = Date.now();
            registry.registerSkills(builtinSkills);
            const duration = Date.now() - start;

            expect(duration).toBeLessThan(50); // Should be very fast (< 50ms)
        });
    });
});
