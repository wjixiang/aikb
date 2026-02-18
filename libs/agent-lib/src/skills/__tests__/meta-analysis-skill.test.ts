import { describe, it, expect, beforeEach } from 'vitest';
import { SkillManager } from '../SkillManager.js';
import { SkillRegistry } from '../SkillRegistry.js';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Meta-Analysis Search Skill', () => {
    let skillManager: SkillManager;
    let skillRegistry: SkillRegistry;

    beforeEach(() => {
        skillManager = new SkillManager();
        skillRegistry = new SkillRegistry();
    });

    describe('skill loading', () => {
        it('should load meta-analysis-search skill from markdown file', () => {
            // Load skill from repository
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            // Parse and load skill
            const skill = skillRegistry.loadFromContent(skillContent, skillPath);
            console.log(skill)
            // Verify skill properties
            expect(skill.name).toBe('meta-analysis-search');
            expect(skill.displayName).toBe('Meta-Analysis Literature Search');
            expect(skill.description).toContain('meta-analysis studies');
            expect(skill.triggers).toContain('meta-analysis');
            expect(skill.triggers).toContain('pubmed');
        });

        it('should register loaded skill with SkillManager', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            const skill = skillRegistry.loadFromContent(skillContent, skillPath);
            skillManager.register(skill);

            // Verify registration
            expect(skillManager.has('meta-analysis-search')).toBe(true);
            expect(skillManager.size).toBe(1);
        });

        it('should activate meta-analysis-search skill', async () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            const skill = skillRegistry.loadFromContent(skillContent, skillPath);
            skillManager.register(skill);

            // Activate skill
            const result = await skillManager.activateSkill('meta-analysis-search');

            // Verify activation
            expect(result.success).toBe(true);
            expect(result.skill?.name).toBe('meta-analysis-search');
            expect(skillManager.getActiveSkill()?.name).toBe('meta-analysis-search');
        });
    });

    describe('skill properties', () => {
        beforeEach(async () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');
            const skill = skillRegistry.loadFromContent(skillContent, skillPath);
            skillManager.register(skill);
            await skillManager.activateSkill('meta-analysis-search');
        });

        it('should have correct prompt enhancement', () => {
            const prompt = skillManager.getActivePrompt();

            expect(prompt).not.toBeNull();
            expect(prompt?.capability).toContain('PICO');
            expect(prompt?.direction).toContain('PRISMA');
        });

        it('should have no provided tools (only required tools)', () => {
            const tools = skillManager.getActiveTools();

            // This skill only defines required tools, not provided tools
            expect(tools).toEqual([]);
        });

        it('should be discoverable via search', () => {
            const matches = skillManager.findMatchingSkills('meta-analysis');

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0]?.name).toBe('meta-analysis-search');
        });

        it('should match by tags', () => {
            const matches = skillManager.findMatchingSkills('pubmed');

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0]?.name).toBe('meta-analysis-search');
        });

        it('should match by description', () => {
            const matches = skillManager.findMatchingSkills('PRISMA');

            expect(matches.length).toBeGreaterThan(0);
            expect(matches[0]?.name).toBe('meta-analysis-search');
        });
    });

    describe('skill lifecycle', () => {
        it('should call onActivate when skill is activated', async () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');
            const skill = skillRegistry.loadFromContent(skillContent, skillPath);
            skillManager.register(skill);

            // Activate skill
            await skillManager.activateSkill('meta-analysis-search');

            // Verify skill is active
            expect(skillManager.hasActiveSkill()).toBe(true);
            expect(skillManager.getActiveSkill()?.name).toBe('meta-analysis-search');
        });

        it('should deactivate skill', async () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');
            const skill = skillRegistry.loadFromContent(skillContent, skillPath);
            skillManager.register(skill);

            // Activate then deactivate
            await skillManager.activateSkill('meta-analysis-search');
            expect(skillManager.hasActiveSkill()).toBe(true);

            const result = await skillManager.deactivateSkill();
            expect(result.success).toBe(true);
            expect(skillManager.hasActiveSkill()).toBe(false);
        });

        it('should switch between skills', async () => {
            // Load meta-analysis-search skill
            const skillPath1 = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent1 = readFileSync(skillPath1, 'utf-8');
            const skill1 = skillRegistry.loadFromContent(skillContent1, skillPath1);
            skillManager.register(skill1);

            // Load another skill
            const skillPath2 = join(__dirname, '../../../repository/builtin/paper-analysis.skill.md');
            const skillContent2 = readFileSync(skillPath2, 'utf-8');
            const skill2 = skillRegistry.loadFromContent(skillContent2, skillPath2);
            skillManager.register(skill2);

            // Activate first skill
            await skillManager.activateSkill('meta-analysis-search');
            expect(skillManager.getActiveSkill()?.name).toBe('meta-analysis-search');

            // Switch to second skill
            await skillManager.activateSkill('paper-analysis');
            expect(skillManager.getActiveSkill()?.name).toBe('paper-analysis');
        });
    });

    describe('skill registry integration', () => {
        it('should retrieve skill from registry', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            skillRegistry.loadFromContent(skillContent, skillPath);

            // Verify skill is in registry
            expect(skillRegistry.has('meta-analysis-search')).toBe(true);

            const retrievedSkill = skillRegistry.get('meta-analysis-search');
            expect(retrievedSkill?.name).toBe('meta-analysis-search');
        });

        it('should get parsed skill data', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            skillRegistry.loadFromContent(skillContent, skillPath);

            const parsed = skillRegistry.getParsed('meta-analysis-search');

            expect(parsed).toBeDefined();
            expect(parsed?.frontmatter.name).toBe('meta-analysis-search');
            expect(parsed?.frontmatter.version).toBe('1.0.0');
            expect(parsed?.frontmatter.category).toBe('medical-research');
            expect(parsed?.capabilities.length).toBeGreaterThan(0);
        });

        it('should search skills by category', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            skillRegistry.loadFromContent(skillContent, skillPath);

            const medicalSkills = skillRegistry.getByCategory('medical-research');

            expect(medicalSkills.length).toBeGreaterThan(0);
            expect(medicalSkills[0]?.name).toBe('meta-analysis-search');
        });

        it('should search skills by tag', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            skillRegistry.loadFromContent(skillContent, skillPath);

            const pubmedSkills = skillRegistry.getByTag('pubmed');

            expect(pubmedSkills.length).toBeGreaterThan(0);
            expect(pubmedSkills[0]?.name).toBe('meta-analysis-search');
        });

        it('should get skill statistics', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            skillRegistry.loadFromContent(skillContent, skillPath);

            const stats = skillRegistry.getStats();

            expect(stats.totalSkills).toBeGreaterThan(0);
            expect(stats.categories['medical-research']).toBeGreaterThan(0);
            expect(stats.tags['meta-analysis']).toBeGreaterThan(0);
        });
    });

    describe('skill validation', () => {
        it('should validate meta-analysis-search skill content', () => {
            const skillPath = join(__dirname, '../../../repository/builtin/meta-analysis-search.skill.md');
            const skillContent = readFileSync(skillPath, 'utf-8');

            const validation = skillRegistry.validate(skillContent);

            expect(validation.valid).toBe(true);
            expect(validation.errors).toEqual([]);
        });

        it('should detect invalid skill content', () => {
            const invalidContent = `
# Invalid Skill

Missing frontmatter and required sections.
`;

            const validation = skillRegistry.validate(invalidContent);

            expect(validation.valid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });
});
