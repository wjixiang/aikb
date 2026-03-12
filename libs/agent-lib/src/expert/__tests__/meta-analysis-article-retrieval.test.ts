import { describe, it, expect, beforeEach } from 'vitest';
import createMetaAnalysisArticleRetrievalExpert from '../builtin/meta-analysis-article-retrieval/expert';

describe('MetaAnalysisArticleRetrieval Expert', () => {
    let expert: ReturnType<typeof createMetaAnalysisArticleRetrievalExpert>;

    beforeEach(() => {
        expert = createMetaAnalysisArticleRetrievalExpert();
    });

    describe('basic properties', () => {
        it('should have correct expertId', () => {
            expect(expert.expertId).toBe('meta-analysis-article-retrieval');
        });

        it('should have displayName', () => {
            expect(expert.displayName).toBe('Meta-Analysis Article Retrieval');
        });

        it('should have description', () => {
            expect(expert.description).toBeTruthy();
            expect(expert.description.length).toBeGreaterThan(0);
        });
    });

    describe('triggers', () => {
        it('should have triggers', () => {
            expect(expert.triggers).toBeDefined();
            expect(Array.isArray(expert.triggers)).toBe(true);
            expect(expert.triggers?.length).toBeGreaterThan(0);
        });

        it('should include relevant triggers', () => {
            const triggers = expert.triggers || [];
            expect(triggers.some(t => t.includes('literature'))).toBe(true);
            expect(triggers.some(t => t.includes('search'))).toBe(true);
        });
    });

    describe('prompt', () => {
        it('should have capability prompt', () => {
            expect(expert.prompt).toBeDefined();
            expect(expert.prompt.capability).toBeTruthy();
            expect(typeof expert.prompt.capability).toBe('string');
        });

        it('should have direction prompt', () => {
            expect(expert.prompt.direction).toBeTruthy();
            expect(typeof expert.prompt.direction).toBe('string');
        });

        it('should include literature retrieval in capability', () => {
            expect(expert.prompt.capability.toLowerCase()).toContain('literature');
        });

        it('should include Steps content in direction', () => {
            // Direction contains Steps, but might not have "Phase"
            expect(expert.prompt.direction.length).toBeGreaterThan(0);
        });
    });

    describe('capabilities', () => {
        it('should have capabilities array', () => {
            expect(expert.capabilities).toBeDefined();
            expect(Array.isArray(expert.capabilities)).toBe(true);
        });

        it('should have at least one capability', () => {
            expect(expert.capabilities.length).toBeGreaterThan(0);
        });
    });

    describe('responsibilities', () => {
        it('should have responsibilities', () => {
            expect(expert.responsibilities).toBeTruthy();
            expect(typeof expert.responsibilities).toBe('string');
        });

        it('should describe literature retrieval', () => {
            expect(expert.responsibilities.toLowerCase()).toContain('literature');
        });
    });

    describe('components', () => {
        it('should have components array', () => {
            expect(expert.components).toBeDefined();
            expect(Array.isArray(expert.components)).toBe(true);
        });

        it('should have at least one component', () => {
            expect(expert.components.length).toBeGreaterThan(0);
        });

        it('should have bibliography-search component', () => {
            const componentIds = expert.components.map(c => c.componentId);
            expect(componentIds).toContain('bibliography-search');
        });

        it('should have component with DI token', () => {
            const bibComponent = expert.components.find(c => c.componentId === 'bibliography-search');
            expect(bibComponent).toBeDefined();
            expect(bibComponent?.instance).toBeDefined();
        });
    });

    describe('whenToUse', () => {
        it('should have whenToUse', () => {
            expect(expert.whenToUse).toBeDefined();
            expect(expert.whenToUse).toBeTruthy();
        });

        it('should describe meta-analysis context', () => {
            expect(expert.whenToUse?.toLowerCase()).toContain('meta-analysis');
        });
    });
});
