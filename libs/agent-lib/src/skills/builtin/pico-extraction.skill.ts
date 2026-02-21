import { defineSkill } from '../SkillDefinition.js';
import {
    setPicosElementTool,
    generateClinicalQuestionTool,
    validatePicosTool,
    clearPicosTool,
    exportPicosTool
} from '../../components/PICOS/picosTools.js';

/**
 * PICO Extraction Skill - TypeScript Definition
 *
 * Evidence-based medicine skill for extracting PICO elements
 * from clinical research questions and literature.
 *
 * This skill uses tools from the PicosComponent for building
 * and managing clinical questions using the PICO framework.
 */

// Define the skill with tools from PicosComponent
export default defineSkill({
    name: 'pico-extraction',
    displayName: 'PICO Extraction',
    description: 'Evidence-based medicine skill for extracting PICO elements from clinical text and formulating structured research questions',
    version: '1.0.0',
    category: 'medical-research',
    tags: ['PICO', 'evidence-based-medicine', 'clinical-research', 'systematic-review', 'literature-search'],
    triggers: [
        'extract PICO',
        'clinical question',
        'evidence-based medicine',
        'research question',
        'literature search',
        'systematic review',
        'PICO framework',
        'PICOS',
        'clinical study',
        'medical research'
    ],

    capabilities: [
        'Extract and structure PICO (Patient, Intervention, Comparison, Outcome) elements from clinical text',
        'Formulate well-structured clinical research questions using PICO framework',
        'Validate completeness and quality of PICO formulations',
        'Export PICO data in multiple formats (JSON, Markdown, search strings)',
        'Build clinical questions element by element for systematic reviews',
        'Support evidence-based medicine research and literature review preparation',
        'Manage clinical question formulation with Study Design element (PICOS)',
        'Generate search-ready formats for medical databases'
    ],

    workDirection: `When working with PICO extraction and clinical question formulation, follow this systematic approach:

## Core Workflow

1. **Extract Elements**: Use set_picos_element to build PICO elements one by one from source text
2. **Validate**: Use validate_picos to assess completeness and quality
3. **Generate Question**: Use generate_clinical_question to create structured research questions
4. **Export**: Use export_picos to prepare data for literature searches or documentation

## PICO Framework Guidelines

**P - Patient/Population**:
- Identify the target population or patient group
- Include age, gender, clinical condition, and relevant characteristics
- Example: "Adults with type 2 diabetes aged 65+"

**I - Intervention/Exposure**:
- Define the treatment, exposure, or intervention of interest
- Be specific about dosage, duration, and delivery method
- Example: "GLP-1 receptor agonists"

**C - Comparison/Control**:
- Specify the comparison group (standard treatment, placebo, no intervention)
- Note: Comparison may be optional for some question types
- Example: "Basal insulin therapy"

**O - Outcome**:
- Identify measurable endpoints (clinical outcomes, patient-reported outcomes)
- Specify time frame when relevant
- Example: "HbA1c reduction at 6 months"

**S - Study Design** (Optional):
- Specify the type of study design for literature search
- Examples: "Randomized Controlled Trial", "Cohort Study", "Systematic Review"

## Best Practices

- **Be Specific**: More specific PICO elements lead to better search results
- **Use Standard Terminology**: Employ established medical terms and vocabulary
- **Consider Question Type**: Different clinical question types may require different PICO structures:
  * Therapy: PICO (all elements typically required)
  * Diagnosis: PIO (Comparison often omitted)
  * Prognosis: PIO (focus on patient characteristics and outcomes)
  * Etiology/Harm: PEO (Exposure instead of Intervention)
- **Validate Early**: Check completeness before proceeding to search strategy
- **Document Assumptions**: Note any uncertainties or ambiguities in the extraction

## Tool Usage Examples

**Setting PICO Elements:**
\`\`\`
set_picos_element with:
- element: "patient"
- data: { description: "Adults with type 2 diabetes", ageGroup: "65+", condition: "type 2 diabetes" }
\`\`\`

**Generating Questions:**
\`\`\`
generate_clinical_question with:
- format: "both" (outputs both natural language and structured format)
\`\`\`

**Exporting for Literature Search:**
\`\`\`
export_picos with:
- format: "search" (generates Boolean query for databases)
\`\`\`

## Integration with Literature Search

After building a complete PICO formulation:
1. Export in "search" format to get Boolean queries
2. Use the exported search terms with bibliography search tools
3. Combine with MeSH terms for comprehensive database searches`,

    tools: [
        setPicosElementTool,
        generateClinicalQuestionTool,
        validatePicosTool,
        clearPicosTool,
        exportPicosTool
    ],

    onActivate: async () => {
        console.log('[PICOExtraction] Skill activated - ready for evidence-based medicine tasks');
    },

    onDeactivate: async () => {
        console.log('[PICOExtraction] Skill deactivated - cleaning up resources');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-02-21',
        updated: '2025-02-21',
        domain: 'Evidence-Based Medicine',
        framework: 'PICO (Patient, Intervention, Comparison, Outcome)',
        component: 'PicosComponent',
        useCases: 'Systematic reviews, clinical guidelines, research question formulation, literature searches',
        databases: 'PubMed, Embase, CINAHL, Cochrane, Scopus, Web of Science'
    }
});
