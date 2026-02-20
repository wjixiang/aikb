import { describe, it, expect } from 'vitest';
import { getBuiltinSkills, getBuiltinSkill } from '../builtin/index.js';

describe('Meta-Analysis Article Retrieval Skill', () => {
    it('should be registered in builtin skills', () => {
        const skills = getBuiltinSkills();
        const skillNames = skills.map(s => s.name);

        expect(skillNames).toContain('meta-analysis-article-retrieval');
    });

    it('should have correct metadata', () => {
        const skill = getBuiltinSkill('meta-analysis-article-retrieval');

        expect(skill).toBeDefined();
        expect(skill?.name).toBe('meta-analysis-article-retrieval');
        expect(skill?.displayName).toBe('Meta-Analysis Article Retrieval');
        expect(skill?.description.toLowerCase()).toContain('systematic literature retrieval');
    });

    it('should have question decomposition capability', () => {
        const skill = getBuiltinSkill('meta-analysis-article-retrieval');

        expect(skill?.prompt.capability).toContain('Decompose broad clinical questions');
        expect(skill?.prompt.capability).toContain('<100 per sub-question');
    });

    it('should have proper workflow direction', () => {
        const skill = getBuiltinSkill('meta-analysis-article-retrieval');

        expect(skill?.prompt.direction).toContain('Phase 0: Question Decomposition');
        expect(skill?.prompt.direction).toContain('Phase 4: Aggregation');
        expect(skill?.prompt.direction).toContain('search_pubmed');
    });

    it('should have appropriate triggers', () => {
        const skill = getBuiltinSkill('meta-analysis-article-retrieval');

        expect(skill?.triggers).toBeDefined();
        expect(skill?.triggers).toContain('meta analysis retrieval');
        expect(skill?.triggers).toContain('systematic search');
    });
});
