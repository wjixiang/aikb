import { defineSkill } from '../SkillDefinition.js';
import {
    setChecklistItemTool,
    setMultipleItemsTool,
    filterChecklistTool,
    exportChecklistTool,
    validateChecklistTool,
    clearChecklistTool,
    getProgressTool,
    setManuscriptMetadataTool
} from '../../components/PRISMA/prismaTools.js';

/**
 * PRISMA Checklist Skill - TypeScript Definition
 *
 * Evidence-based medicine skill for managing the PRISMA 2020 checklist
 * for systematic reviews and meta-analyses.
 *
 * This skill uses tools from the PrismaComponent for tracking completion
 * of all 27 items in the PRISMA 2020 checklist across all sections.
 */

// Define the skill with tools from PrismaComponent
export default defineSkill({
    name: 'prisma-checklist',
    displayName: 'PRISMA 2020 Checklist',
    description: 'Evidence-based medicine skill for managing the PRISMA 2020 checklist for systematic reviews and meta-analyses. Track completion of all 27 checklist items across TITLE, ABSTRACT, INTRODUCTION, METHODS, RESULTS, DISCUSSION, and OTHER INFORMATION sections.',
    whenToUse: 'Use this skill when conducting or planning a systematic review or meta-analysis that requires adherence to the PRISMA 2020 reporting guidelines. This includes tasks like: tracking completion of systematic review reporting items, validating manuscript completeness, generating PRISMA checklists for publication, managing manuscript metadata (registration, protocol), or exporting checklist data for documentation and peer review.',
    version: '1.0.0',
    category: 'medical-research',
    tags: ['PRISMA', 'systematic-review', 'meta-analysis', 'reporting-guidelines', 'checklist', 'research-methods'],
    triggers: [
        'PRISMA checklist',
        'systematic review',
        'meta-analysis',
        'reporting guidelines',
        'manuscript checklist',
        'review protocol',
        'study selection',
        'risk of bias',
        'PRISMA 2020',
        'evidence synthesis'
    ],

    capabilities: [
        'Track completion of all 27 PRISMA 2020 checklist items across 7 sections',
        'Manage manuscript metadata (title, authors, registration, protocol)',
        'Validate completeness of systematic review reporting',
        'Filter and view checklist items by section, status, or topic',
        'Export checklist in multiple formats (JSON, Markdown, CSV)',
        'Monitor progress with visual indicators and section-wise statistics',
        'Document location of each item in the manuscript',
        'Add notes and track status for each checklist item'
    ],

    workDirection: `When working with the PRISMA 2020 checklist, follow this systematic approach:

## Core Workflow

1. **Set Metadata**: Use set_manuscript_metadata to record review information (title, authors, registration)
2. **Track Items**: Use set_checklist_item to update individual item status, location, and notes
3. **Monitor Progress**: Use get_progress to view completion statistics and section-wise progress
4. **Validate**: Use validate_checklist to ensure all required items are completed
5. **Export**: Use export_checklist to generate documentation for publication or peer review

## PRISMA 2020 Checklist Structure

**TITLE Section (Item 1)**:
- Identify the report as a systematic review

**ABSTRACT Section (Item 2)**:
- See PRISMA 2020 for Abstracts checklist

**INTRODUCTION Section (Items 3-4)**:
- Item 3: Rationale - Describe rationale in context of existing knowledge
- Item 4: Objectives - Provide explicit statement of objectives/questions

**METHODS Section (Items 5-15)**:
- Item 5: Eligibility criteria - Specify inclusion/exclusion criteria
- Item 6: Information sources - Specify all databases, registers, websites
- Item 7: Search strategy - Present full search strategies
- Item 8: Selection process - Specify screening methods
- Item 9: Data collection process - Specify data extraction methods
- Item 10: Data items - List and define all outcomes and variables
- Item 11: Study risk of bias assessment - Specify risk of bias methods
- Item 12: Effect measures - Specify effect measures for each outcome
- Item 13: Synthesis methods - Describe synthesis methods
- Item 14: Reporting bias assessment - Describe methods for assessing reporting bias
- Item 15: Certainty assessment - Describe methods for assessing certainty

**RESULTS Section (Items 16-22)**:
- Item 16: Study selection - Describe search and selection process with flow diagram
- Item 17: Study characteristics - Cite each included study
- Item 18: Risk of bias in studies - Present risk of bias assessments
- Item 19: Results of individual studies - Present results for each study
- Item 20: Results of syntheses - Present synthesis results
- Item 21: Reporting biases - Present reporting bias assessments
- Item 22: Certainty of evidence - Present certainty assessments

**DISCUSSION Section (Item 23)**:
- Item 23: Discussion - Interpret results, discuss limitations, implications

**OTHER INFORMATION Section (Items 24-27)**:
- Item 24: Registration and protocol - Provide registration information
- Item 25: Support - Describe sources of support
- Item 26: Competing interests - Declare competing interests
- Item 27: Availability of data, code and other materials - Report availability

## Status Tracking

Each checklist item can have one of the following statuses:
- **not_started**: Item has not been addressed yet
- **in_progress**: Item is being worked on
- **completed**: Item is fully addressed
- **not_applicable**: Item does not apply to this review

## Best Practices

- **Start Early**: Begin tracking checklist items during protocol development
- **Be Specific**: Document exact location (section, page, line) for each item
- **Add Notes**: Record important details, decisions, or justifications
- **Regular Validation**: Validate checklist frequently to catch missing items
- **Section Progress**: Monitor section-wise progress to ensure balanced coverage
- **Documentation**: Export checklist regularly for documentation and team communication

## Tool Usage Examples

**Setting Manuscript Metadata:**
\`\`\`
set_manuscript_metadata with:
- title: "Effectiveness of GLP-1 receptor agonists in type 2 diabetes"
- authors: ["Smith J", "Johnson A", "Williams B"]
- registrationNumber: "CRD42020123456"
- registrationDate: "2020-01-15"
\`\`\`

**Updating Checklist Item:**
\`\`\`
set_checklist_item with:
- itemNumber: 16
- status: "completed"
- location: "Results section, page 8, Figure 2"
- notes: "Flow diagram created following PRISMA 2020 template"
\`\`\`

**Getting Progress:**
\`\`\`
get_progress to view:
- Overall completion percentage
- Section-wise progress statistics
- Visual progress bars
\`\`\`

**Exporting for Publication:**
\`\`\`
export_checklist with:
- format: "markdown"
- includeCompletedOnly: false
\`\`\`

## Integration with Systematic Review Workflow

The PRISMA checklist skill integrates with:
1. **PICO Extraction**: Use PICO skills to formulate research questions (Item 4)
2. **Literature Search**: Use bibliography search for Items 6-7
3. **Study Selection**: Track selection process for Item 16
4. **Data Extraction**: Document extraction methods for Items 9-10
5. **Risk of Bias**: Assess bias for Items 11, 18
6. **Data Synthesis**: Perform synthesis for Items 19-22`,

    tools: [
        setChecklistItemTool,
        setMultipleItemsTool,
        filterChecklistTool,
        exportChecklistTool,
        validateChecklistTool,
        clearChecklistTool,
        getProgressTool,
        setManuscriptMetadataTool
    ],

    onActivate: async () => {
        console.log('[PRISMAChecklist] Skill activated - ready for PRISMA 2020 checklist management');
    },

    onDeactivate: async () => {
        console.log('[PRISMAChecklist] Skill deactivated - cleaning up resources');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-02-22',
        updated: '2025-02-22',
        domain: 'Evidence-Based Medicine',
        framework: 'PRISMA 2020 (Preferred Reporting Items for Systematic Reviews and Meta-Analyses)',
        component: 'PrismaComponent',
        checklistVersion: 'PRISMA 2020',
        totalItems: '27',
        sections: 'TITLE, ABSTRACT, INTRODUCTION, METHODS, RESULTS, DISCUSSION, OTHER INFORMATION',
        useCases: 'Systematic reviews, meta-analyses, guideline development, peer review, journal submission',
        guidelines: 'PRISMA 2020 statement, MOOSE guidelines, Cochrane handbook'
    }
});
