import { describe, it, expect } from 'vitest';
import metaAnalysisWithComponentsSkill from '../builtin/meta-analysis-with-components.skill.js';

describe('Meta-Analysis Skill', () => {
    describe('Metadata', () => {
        it('should have correct name', () => {
            expect(metaAnalysisWithComponentsSkill.name).toBe('meta-analysis-with-components');
        });

        it('should have correct display name', () => {
            expect(metaAnalysisWithComponentsSkill.displayName).toBe('Meta-Analysis (Comprehensive)');
        });

        it('should have comprehensive description', () => {
            expect(metaAnalysisWithComponentsSkill.description).toBeDefined();
            expect(metaAnalysisWithComponentsSkill.description.toLowerCase()).toContain('meta-analysis');
            expect(metaAnalysisWithComponentsSkill.description.toLowerCase()).toContain('systematic literature');
            expect(metaAnalysisWithComponentsSkill.description.toLowerCase()).toContain('pico');
            expect(metaAnalysisWithComponentsSkill.description.toLowerCase()).toContain('prisma');
        });

        it('should have whenToUse guidance', () => {
            expect(metaAnalysisWithComponentsSkill.whenToUse).toBeDefined();
            expect(metaAnalysisWithComponentsSkill.whenToUse?.toLowerCase()).toContain('meta-analysis');
            expect(metaAnalysisWithComponentsSkill.whenToUse?.toLowerCase()).toContain('systematic review');
        });
    });

    describe('Triggers', () => {
        it('should have appropriate trigger keywords', () => {
            expect(metaAnalysisWithComponentsSkill.triggers).toBeDefined();
            expect(metaAnalysisWithComponentsSkill.triggers).toContain('meta analysis');
            expect(metaAnalysisWithComponentsSkill.triggers).toContain('systematic review');
            expect(metaAnalysisWithComponentsSkill.triggers).toContain('comprehensive meta-analysis');
            expect(metaAnalysisWithComponentsSkill.triggers).toContain('full systematic review');
            expect(metaAnalysisWithComponentsSkill.triggers).toContain('complete evidence synthesis');
        });
    });

    describe('Capabilities', () => {
        it('should have literature search capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Conduct systematic literature searches using PubMed');
        });

        it('should have PICO formulation capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Formulate clinical research questions using PICO framework');
        });

        it('should have flow diagram tracking capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Track study selection process with PRISMA flow diagram');
        });

        it('should have checklist management capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Manage PRISMA 2020 checklist compliance');
        });

        it('should have bibliographic management capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Retrieve and manage bibliographic records');
        });

        it('should have documentation capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Document exclusion reasons and screening decisions');
        });

        it('should have export capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Export data in multiple formats for publication');
        });

        it('should have validation capability', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.capability).toContain('Validate completeness of systematic review reporting');
        });
    });

    describe('Work Direction', () => {
        it('should have Phase 1: Question Formulation', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Phase 1: Question Formulation (PICO)');
            expect(direction).toContain('set_picos_element');
            expect(direction).toContain('validate_picos');
            expect(direction).toContain('export_picos');
        });

        it('should have Phase 2: Literature Retrieval', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Phase 2: Literature Retrieval');
            expect(direction).toContain('search_pubmed');
            expect(direction).toContain('navigate_page');
            expect(direction).toContain('view_article');
        });

        it('should have Phase 3: Study Selection', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Phase 3: Study Selection (Flow Diagram)');
            expect(direction).toContain('set_identification');
            expect(direction).toContain('set_records_removed');
            expect(direction).toContain('set_screening');
            expect(direction).toContain('set_retrieval');
            expect(direction).toContain('set_assessment');
            expect(direction).toContain('set_included');
            expect(direction).toContain('add_exclusion_reason');
        });

        it('should have Phase 4: PRISMA Checklist', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Phase 4: PRISMA Checklist');
            expect(direction).toContain('set_manuscript_metadata');
            expect(direction).toContain('set_checklist_item');
            expect(direction).toContain('get_progress');
            expect(direction).toContain('validate_checklist');
        });

        it('should mention component integration', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Component Integration');
            expect(direction).toContain('Pubmed Search Engine');
            expect(direction).toContain('PICO Templater');
            expect(direction).toContain('Prisma Check List');
            expect(direction).toContain('Prisma Workflow');
        });

        it('should include best practices', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Best Practices');
            expect(direction).toContain('Start with PICO');
            expect(direction).toContain('Document Everything');
            expect(direction).toContain('Use Auto-Calculate');
            expect(direction).toContain('Validate Regularly');
            expect(direction).toContain('Export Often');
        });

        it('should specify output format', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            expect(direction).toContain('Output Format');
            expect(direction).toContain('PICO Formulation');
            expect(direction).toContain('Search Strategy');
            expect(direction).toContain('Article List');
            expect(direction).toContain('Flow Diagram');
            expect(direction).toContain('PRISMA Checklist');
            expect(direction).toContain('Documentation');
        });
    });

    describe('Components', () => {
        it('should have 4 components registered', () => {
            expect(metaAnalysisWithComponentsSkill.components).toBeDefined();
            expect(metaAnalysisWithComponentsSkill.components?.length).toBe(4);
        });

        it('should have pubmed-search-engine component', () => {
            const component = metaAnalysisWithComponentsSkill.components?.find(c => c.componentId === 'pubmed-search-engine');
            expect(component).toBeDefined();
            expect(component?.displayName).toBe('Pubmed Search Engine');
            expect(component?.description).toContain('PubMed');
        });

        it('should have pico-templater component', () => {
            const component = metaAnalysisWithComponentsSkill.components?.find(c => c.componentId === 'pico-templater');
            expect(component).toBeDefined();
            expect(component?.displayName).toBe('PICO Templater');
            expect(component?.description).toContain('PICO');
        });

        it('should have prisma-check-list component', () => {
            const component = metaAnalysisWithComponentsSkill.components?.find(c => c.componentId === 'prisma-check-list');
            expect(component).toBeDefined();
            expect(component?.displayName).toBe('Prisma Check List');
            expect(component?.description).toContain('PRISMA 2020');
        });

        it('should have prisma-workflow component', () => {
            const component = metaAnalysisWithComponentsSkill.components?.find(c => c.componentId === 'prisma-workflow');
            expect(component).toBeDefined();
            expect(component?.displayName).toBe('Prisma Workflow');
            expect(component?.description).toContain('PRISMA 2020 flow diagram');
        });

        it('should have DI tokens for all components', () => {
            metaAnalysisWithComponentsSkill.components?.forEach(component => {
                expect(component.instance).toBeDefined();
                expect(typeof component.instance).toBe('symbol');
            });
        });
    });

    describe('Lifecycle Hooks', () => {
        it('should have onActivate hook', () => {
            expect(metaAnalysisWithComponentsSkill.onActivate).toBeDefined();
            expect(typeof metaAnalysisWithComponentsSkill.onActivate).toBe('function');
        });

        it('should have onDeactivate hook', () => {
            expect(metaAnalysisWithComponentsSkill.onDeactivate).toBeDefined();
            expect(typeof metaAnalysisWithComponentsSkill.onDeactivate).toBe('function');
        });

        it('should execute onActivate without errors', async () => {
            await expect(metaAnalysisWithComponentsSkill.onActivate?.()).resolves.not.toThrow();
        });

        it('should execute onDeactivate without errors', async () => {
            await expect(metaAnalysisWithComponentsSkill.onDeactivate?.()).resolves.not.toThrow();
        });
    });

    describe('Tool Integration', () => {
        it('should reference search_pubmed tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('search_pubmed');
        });

        it('should reference view_article tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('view_article');
        });

        it('should reference navigate_page tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('navigate_page');
        });

        it('should reference set_picos_element tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('set_picos_element');
        });

        it('should reference generate_clinical_question tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('generate_clinical_question');
        });

        it('should reference validate_picos tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('validate_picos');
        });

        it('should reference export_picos tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('export_picos');
        });

        it('should reference set_checklist_item tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('set_checklist_item');
        });

        it('should reference validate_checklist tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('validate_checklist');
        });

        it('should reference export_checklist tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('export_checklist');
        });

        it('should reference get_progress tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('get_progress');
        });

        it('should reference set_identification tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('set_identification');
        });

        it('should reference set_screening tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('set_screening');
        });

        it('should reference set_assessment tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('set_assessment');
        });

        it('should reference set_included tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('set_included');
        });

        it('should reference export_flow_diagram tool in work direction', () => {
            expect(metaAnalysisWithComponentsSkill.prompt.direction).toContain('export_flow_diagram');
        });
    });

    describe('Workflow Completeness', () => {
        it('should cover complete meta-analysis workflow', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            // Check all major phases are present
            expect(direction).toContain('Phase 1');
            expect(direction).toContain('Phase 2');
            expect(direction).toContain('Phase 3');
            expect(direction).toContain('Phase 4');
        });

        it('should provide guidance for each workflow step', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            // Check that numbered steps are provided
            expect(direction).toMatch(/\d+\.\s+\*\*Extract PICO Elements\*\*/);
            expect(direction).toMatch(/\d+\.\s+\*\*Search PubMed\*\*/);
            expect(direction).toMatch(/\d+\.\s+\*\*Identification\*\*/);
            expect(direction).toMatch(/\d+\.\s+\*\*Set Metadata\*\*/);
        });

        it('should include tool usage examples', () => {
            const direction = metaAnalysisWithComponentsSkill.prompt.direction;

            // Check that tool usage is demonstrated
            expect(direction).toContain('Use set_picos_element');
            expect(direction).toContain('Use search_pubmed');
            expect(direction).toContain('Use set_identification');
            expect(direction).toContain('Use set_checklist_item');
        });
    });
});
