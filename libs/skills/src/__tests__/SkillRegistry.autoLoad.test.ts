import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../SkillRegistry.js';
import { join } from 'path';

describe('SkillRegistry Auto-Load from Directory', () => {
    describe('loadFromDirectory', () => {
        it('should load all skills from repository directory', () => {
            const registry = new SkillRegistry();

            // Load from builtin directory
            const repositoryPath = join(__dirname, '../../repository/builtin');
            const skills = registry.loadFromDirectory(repositoryPath);

            // Verify skills were loaded
            expect(skills.length).toBeGreaterThan(0);
            expect(registry.size).toBeGreaterThan(0);
        });

        it('should load meta-analysis-search skill', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            // Verify specific skill was loaded
            expect(registry.has('meta-analysis-search')).toBe(true);

            const skill = registry.get('meta-analysis-search');
            expect(skill?.name).toBe('meta-analysis-search');
            expect(skill?.displayName).toBe('Meta-Analysis Literature Search');
        });

        it('should load systematic-literature-review skill', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            // Verify specific skill was loaded
            expect(registry.has('systematic-literature-review')).toBe(true);

            const skill = registry.get('systematic-literature-review');
            expect(skill?.name).toBe('systematic-literature-review');
        });

        it('should load paper-analysis skill', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            // Verify specific skill was loaded
            expect(registry.has('paper-analysis')).toBe(true);

            const skill = registry.get('paper-analysis');
            expect(skill?.name).toBe('paper-analysis');
        });

        it('should get all loaded skills', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            const allSkills = registry.getAll();
            expect(allSkills.length).toBeGreaterThanOrEqual(3);

            // Check that all skills have required properties
            for (const skill of allSkills) {
                expect(skill.name).toBeDefined();
                expect(skill.displayName).toBeDefined();
                expect(skill.description).toBeDefined();
                expect(skill.prompt).toBeDefined();
            }
        });

        it('should get skill statistics', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            const stats = registry.getStats();

            expect(stats.totalSkills).toBeGreaterThanOrEqual(3);
            expect(stats.categories['medical-research']).toBeGreaterThan(0);
            expect(Object.keys(stats.tags).length).toBeGreaterThan(0);
        });

        it('should search skills by category', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            const medicalSkills = registry.getByCategory('medical-research');
            expect(medicalSkills.length).toBeGreaterThan(0);
        });

        it('should search skills by tag', () => {
            const registry = new SkillRegistry();
            const repositoryPath = join(__dirname, '../../repository/builtin');

            registry.loadFromDirectory(repositoryPath);

            const pubmedSkills = registry.getByTag('pubmed');
            expect(pubmedSkills.length).toBeGreaterThan(0);
        });

        it('should handle non-existent directory gracefully', () => {
            const registry = new SkillRegistry();
            const nonExistentPath = join(__dirname, '../../repository/non-existent');

            // Should not throw, just return empty array
            const skills = registry.loadFromDirectory(nonExistentPath);
            expect(skills).toEqual([]);
        });
    });

    describe('constructor with auto-load', () => {
        it('should auto-load skills when repository path is provided', () => {
            const repositoryPath = join(__dirname, '../../repository/builtin');
            const registry = new SkillRegistry(repositoryPath);

            // Skills should be auto-loaded
            expect(registry.size).toBeGreaterThan(0);
            expect(registry.has('meta-analysis-search')).toBe(true);
        });

        it('should not auto-load when no repository path is provided', () => {
            const registry = new SkillRegistry();

            // No skills should be loaded
            expect(registry.size).toBe(0);
        });
    });
});
