import { describe, it, expect } from 'vitest';
import {
    getBuiltinSkills,
    getBuiltinSkill,
    isBuiltinSkill,
    getBuiltinSkillNames,
} from '../builtin/index.js';
import { SkillRegistry } from '../SkillRegistry.js';

describe('Built-in Skills Registration', () => {
    describe('getBuiltinSkills', () => {
        it('should return an array of skills', () => {
            const skills = getBuiltinSkills();

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

        it('should include paper-analysis skill', () => {
            const skills = getBuiltinSkills();
            const paperSkill = skills.find(s => s.name === 'paper-analysis');

            expect(paperSkill).toBeDefined();
            expect(paperSkill?.displayName).toBe('Paper Analysis');
        });

        it('should include code-review skill', () => {
            const skills = getBuiltinSkills();
            const codeSkill = skills.find(s => s.name === 'code-review');

            expect(codeSkill).toBeDefined();
            expect(codeSkill?.displayName).toBe('Code Review');
        });
    });

    describe('getBuiltinSkill', () => {
        it('should get skill by name', () => {
            const skill = getBuiltinSkill('paper-analysis');

            expect(skill).toBeDefined();
            expect(skill?.name).toBe('paper-analysis');
        });

        it('should return undefined for non-existent skill', () => {
            const skill = getBuiltinSkill('non-existent-skill');

            expect(skill).toBeUndefined();
        });
    });

    describe('isBuiltinSkill', () => {
        it('should return true for built-in skills', () => {
            expect(isBuiltinSkill('paper-analysis')).toBe(true);
            expect(isBuiltinSkill('code-review')).toBe(true);
        });

        it('should return false for non-built-in skills', () => {
            expect(isBuiltinSkill('custom-skill')).toBe(false);
            expect(isBuiltinSkill('non-existent')).toBe(false);
        });
    });

    describe('getBuiltinSkillNames', () => {
        it('should return array of skill names', () => {
            const names = getBuiltinSkillNames();

            expect(Array.isArray(names)).toBe(true);
            expect(names.length).toBeGreaterThan(0);
            expect(names).toContain('paper-analysis');
            expect(names).toContain('code-review');
        });
    });

    describe('SkillRegistry integration', () => {
        it('should register built-in skills', () => {
            const registry = new SkillRegistry();
            const builtinSkills = getBuiltinSkills();

            registry.registerSkills(builtinSkills);

            expect(registry.size).toBe(builtinSkills.length);
            expect(registry.has('paper-analysis')).toBe(true);
            expect(registry.has('code-review')).toBe(true);
        });

        it('should register single built-in skill', () => {
            const registry = new SkillRegistry();
            const skill = getBuiltinSkill('paper-analysis');

            if (skill) {
                registry.registerSkill(skill);
            }

            expect(registry.size).toBe(1);
            expect(registry.has('paper-analysis')).toBe(true);
        });

        it('should get registered skills', () => {
            const registry = new SkillRegistry();
            const builtinSkills = getBuiltinSkills();

            registry.registerSkills(builtinSkills);

            const allSkills = registry.getAll();
            expect(allSkills.length).toBe(builtinSkills.length);

            const paperSkill = registry.get('paper-analysis');
            expect(paperSkill).toBeDefined();
            expect(paperSkill?.name).toBe('paper-analysis');
        });
    });

    describe('Skill properties', () => {
        it('paper-analysis should have tools', () => {
            const skill = getBuiltinSkill('paper-analysis');

            expect(skill?.tools).toBeDefined();
            expect(Array.isArray(skill?.tools)).toBe(true);
            expect(skill?.tools?.length).toBeGreaterThan(0);
        });

        it('code-review should have tools', () => {
            const skill = getBuiltinSkill('code-review');

            expect(skill?.tools).toBeDefined();
            expect(Array.isArray(skill?.tools)).toBe(true);
            expect(skill?.tools?.length).toBeGreaterThan(0);
        });

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
