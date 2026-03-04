import { defineSkill, createComponentDefinition } from '../SkillDefinition.js';
import { BibliographySearchComponent } from '../../components/bibliographySearch/bibliographySearchComponent.js';
import { PicosComponent } from '../../components/PICOS/picosComponents.js';
import { PrismaCheckListComponent } from '../../components/PRISMA/prismaCheckListComponent.js';
import { PrismaFlowComponent } from '../../components/PRISMA/prismaFlowComponent.js';

/**
 * Comprehensive Meta-Analysis Skill with Components
 *
 * This skill provides a complete meta-analysis workflow with all necessary components:
 * - Bibliography Search: PubMed search and article retrieval
 * - PICO Extraction: Clinical question formulation
 * - PRISMA Checklist: Systematic review reporting compliance
 * - PRISMA Flow Diagram: Study selection process tracking
 *
 * All components are automatically registered when this skill is activated.
 */

export default defineSkill({
    name: 'meta-analysis-with-components',
    displayName: 'Meta-Analysis (Comprehensive)',
    description: 'Comprehensive meta-analysis skill with all components for systematic literature retrieval, PICO extraction, PRISMA checklist management, and flow diagram tracking',
    whenToUse: 'Use this skill when conducting a complete meta-analysis or systematic review. This includes all phases: literature retrieval, clinical question formulation, study screening, data extraction, quality assessment, and reporting. This skill provides all necessary components in a single activation.',
    version: '1.0.0',
    category: 'meta-analysis',
    tags: ['meta-analysis', 'systematic-review', 'literature-retrieval', 'PICO', 'PRISMA', 'flow-diagram', 'checklist'],
    triggers: [
        'meta analysis',
        'systematic review',
        'comprehensive meta-analysis',
        'full systematic review',
        'complete evidence synthesis'
    ],

    capabilities: [
        'Conduct systematic literature searches using PubMed',
        'Formulate clinical research questions using PICO framework',
        'Track study selection process with PRISMA flow diagram',
        'Manage PRISMA 2020 checklist compliance',
        'Retrieve and manage bibliographic records',
        'Document exclusion reasons and screening decisions',
        'Export data in multiple formats for publication',
        'Validate completeness of systematic review reporting'
    ],

    workDirection: `You are conducting a comprehensive meta-analysis. This skill provides all necessary components for the complete workflow.

## Meta-Analysis Workflow

### Phase 1: Question Formulation (PICO)
1. **Extract PICO Elements**: Use set_picos_element to build PICO from the research question
2. **Validate**: Use validate_picos to ensure completeness
3. **Generate Search Query**: Use export_picos with format="search" to get Boolean queries

### Phase 2: Literature Retrieval
1. **Search PubMed**: Use search_pubmed with the PICO-derived search strategy
2. **Navigate Results**: Use navigate_page to collect all results
3. **View Articles**: Use view_article to get detailed information
4. **Document Strategy**: Record the final search formula for reproducibility

### Phase 3: Study Selection (Flow Diagram)
1. **Identification**: Use set_identification to record records found
2. **Records Removed**: Use set_records_removed for duplicates and automation exclusions
3. **Screening**: Use set_screening to track screening decisions
4. **Retrieval**: Use set_retrieval to document reports sought
5. **Assessment**: Use set_assessment to track eligibility assessments
6. **Included**: Use set_included to record final included studies
7. **Add Exclusion Reasons**: Use add_exclusion_reason to document why studies were excluded

### Phase 4: PRISMA Checklist
1. **Set Metadata**: Use set_manuscript_metadata to record review information
2. **Track Items**: Use set_checklist_item to update item status as you work
3. **Monitor Progress**: Use get_progress to view completion statistics
4. **Validate**: Use validate_checklist to ensure all required items are complete

## Component Integration

This skill automatically activates four components:
- **Pubmed Search Engine**: Provides search_pubmed, view_article, navigate_page, clear_results
- **PICO Templater**: Provides set_picos_element, generate_clinical_question, validate_picos, export_picos
- **Prisma Check List**: Provides set_checklist_item, validate_checklist, export_checklist, get_progress
- **Prisma Workflow**: Provides set_identification, set_screening, set_assessment, set_included, export_flow_diagram

Tools are automatically extracted from components when the skill is activated.

## Best Practices

- **Start with PICO**: Formulate clear clinical questions before searching
- **Document Everything**: Record search strategies, exclusion reasons, and item locations
- **Use Auto-Calculate**: Let the flow diagram calculate derived values automatically
- **Validate Regularly**: Check PICO completeness, flow consistency, and checklist progress
- **Export Often**: Export data at each phase for documentation

## Output Format

At completion, provide:
1. **PICO Formulation**: Structured clinical question elements
2. **Search Strategy**: Reproducible search formulas
3. **Article List**: Complete bibliographic records
4. **Flow Diagram**: Study selection process with exclusion reasons
5. **PRISMA Checklist**: Completion status with item locations
6. **Documentation**: All exported data in appropriate formats`,

    // Components that will be automatically registered when skill is activated
    // Tools are automatically extracted from these components
    components: [
        createComponentDefinition(
            'pubmed-search-engine',
            'Pubmed Search Engine',
            'Searches PubMed and retrieves bibliographic records for systematic reviews',
            new BibliographySearchComponent()
        ),
        createComponentDefinition(
            'pico-templater',
            'PICO Templater',
            'Formulates clinical research questions using PICO framework',
            new PicosComponent()
        ),
        createComponentDefinition(
            'prisma-check-list',
            'Prisma Check List',
            'Manages PRISMA 2020 checklist compliance for systematic reviews',
            new PrismaCheckListComponent()
        ),
        createComponentDefinition(
            'prisma-workflow',
            'Prisma Workflow',
            'Tracks study selection process with PRISMA 2020 flow diagram',
            new PrismaFlowComponent()
        )
    ],

    onActivate: async () => {
        console.log('[MetaAnalysisWithComponents] Skill activated - all components registered:');
        console.log('  - Pubmed Search Engine');
        console.log('  - PICO Templater');
        console.log('  - Prisma Check List');
        console.log('  - Prisma Workflow');
    },

    onDeactivate: async () => {
        console.log('[MetaAnalysisWithComponents] Skill deactivated - all components unregistered');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-03-04',
        updated: '2025-03-04',
        domain: 'Evidence-Based Medicine',
        framework: 'Meta-Analysis with PRISMA 2020',
        components: 'BibliographySearchComponent, PicosComponent, PrismaCheckListComponent, PrismaFlowComponent',
        phases: 'Question Formulation, Literature Retrieval, Study Selection, Data Extraction, Reporting',
        guidelines: 'PRISMA 2020, MOOSE, Cochrane Handbook',
        useCases: 'Systematic reviews, meta-analyses, clinical guidelines, evidence synthesis'
    }
});
