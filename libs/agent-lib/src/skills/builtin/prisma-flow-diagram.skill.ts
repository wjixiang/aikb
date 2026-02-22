import { defineSkill } from '../SkillDefinition.js';
import {
    setIdentificationTool,
    setRecordsRemovedTool,
    setScreeningTool,
    setRetrievalTool,
    setAssessmentTool,
    setIncludedTool,
    addExclusionReasonTool,
    exportFlowDiagramTool,
    clearFlowDiagramTool,
    validateFlowDiagramTool,
    autoCalculateTool
} from '../../components/PRISMA/prismaFlowTools.js';

/**
 * PRISMA Flow Diagram Skill - TypeScript Definition
 *
 * Evidence-based medicine skill for managing the PRISMA 2020 flow diagram
 * for systematic reviews and meta-analyses.
 *
 * This skill uses tools from the PrismaFlowComponent for tracking the study
 * selection process from identification to inclusion, following the PRISMA 2020
 * flow diagram template with dual flows (databases/registers and other methods).
 */

// Define the skill with tools from PrismaFlowComponent
export default defineSkill({
    name: 'prisma-flow-diagram',
    displayName: 'PRISMA 2020 Flow Diagram',
    description: 'Evidence-based medicine skill for managing the PRISMA 2020 flow diagram for systematic reviews. Track the study selection process from identification through screening, eligibility assessment, to final inclusion, with support for dual flows (databases/registers and other methods) and detailed exclusion tracking.',
    whenToUse: 'Use this skill when conducting a systematic review or meta-analysis that requires documenting the study selection process using the PRISMA 2020 flow diagram. This includes tasks like: tracking records identified from multiple sources, documenting screening and exclusion decisions, managing dual identification flows, generating flow diagrams for publication, validating flow consistency, or exporting flow data in multiple formats.',
    version: '1.0.0',
    category: 'medical-research',
    tags: ['PRISMA', 'flow-diagram', 'systematic-review', 'study-selection', 'screening', 'eligibility', 'exclusion-tracking'],
    triggers: [
        'PRISMA flow diagram',
        'study selection',
        'screening process',
        'eligibility assessment',
        'exclusion tracking',
        'systematic review flow',
        'records identified',
        'study inclusion',
        'PRISMA 2020 flow',
        'selection process'
    ],

    capabilities: [
        'Track records identified from databases, registers, and other methods',
        'Manage dual identification flows (databases/registers vs. other methods)',
        'Document records removed before screening (duplicates, automation tools)',
        'Track screening phase with records screened and excluded',
        'Manage retrieval phase (reports sought and not retrieved)',
        'Document eligibility assessment with exclusion reasons',
        'Track final included studies and reports',
        'Auto-calculate derived values for flow consistency',
        'Validate flow diagram data for completeness and accuracy',
        'Export flow diagram in multiple formats (JSON, Markdown, Mermaid)'
    ],

    workDirection: `When working with the PRISMA 2020 flow diagram, follow this systematic approach:

## Core Workflow

1. **Identification**: Use set_identification to record records from databases, registers, and other sources
2. **Records Removed**: Use set_records_removed to document duplicates and automation tool exclusions
3. **Screening**: Use set_screening to track records screened and excluded with reasons
4. **Retrieval**: Use set_retrieval to document reports sought and not retrieved for each flow
5. **Assessment**: Use set_assessment to track reports assessed and excluded with detailed reasons
6. **Included**: Use set_included to record final counts of included studies and reports
7. **Validate**: Use validate_flow_diagram to ensure flow consistency
8. **Export**: Use export_flow_diagram to generate the flow diagram for publication

## PRISMA 2020 Flow Diagram Structure

### Top Level - Identification

**Databases & Registers Flow (Left Side)**:
- Records identified from databases (n = X)
- Records identified from registers (n = Y)

**Other Methods Flow (Right Side)**:
- Records identified from websites (n = X)
- Records identified from organisations (n = Y)
- Records identified from citation searching (n = Z)
- Records identified from other methods (n = W)

### Database & Registers Flow

**Identification → Records Removed**:
- Duplicate records removed (n = X)
- Records marked as ineligible by automation tools (n = Y)
- Records removed for other reasons (n = Z)

**Records Removed → Screening**:
- Records screened (n = X)
- Records excluded** (n = Y) with reasons

**Screening → Retrieval**:
- Reports sought for retrieval (n = X)
- Reports not retrieved (n = Y)

**Retrieval → Assessment**:
- Reports assessed for eligibility (n = X)
- Reports excluded (n = Y) with reasons

**Assessment → Included**:
- Studies included in review (n = X)
- Reports of included studies (n = Y)

### Other Methods Flow

**Identification → Retrieval**:
- Reports sought for retrieval (n = X)
- Reports not retrieved (n = Y)

**Retrieval → Assessment**:
- Reports assessed for eligibility (n = X)
- Reports excluded (n = Y) with reasons

**Assessment → Included** (converges with database flow)

## Exclusion Reason Management

Use add_exclusion_reason to document specific reasons for excluding studies:

**Screening Phase Exclusions**:
- Wrong population
- Wrong intervention/exposure
- Wrong study design
- Wrong outcome
- Duplicate publication
- Insufficient data

**Assessment Phase Exclusions**:
- Did not address review question
- Inappropriate study design
- Incomplete data reporting
- High risk of bias
- Language barrier

## Best Practices

- **Start Early**: Begin tracking identification numbers as soon as searches are completed
- **Be Precise**: Record exact counts at each stage
- **Document Reasons**: Always document exclusion reasons with specific counts
- **Use Auto-Calculate**: Let the system calculate derived values (screened = identified - removed)
- **Validate Regularly**: Check flow consistency frequently to catch errors
- **Dual Flow Tracking**: Keep separate counts for database/registers vs. other methods
- **Converge at End**: Both flows converge at the included studies stage
- **Export Often**: Export flow data regularly for documentation

## Tool Usage Examples

**Setting Identification Numbers:**
\`\`\`
set_identification with:
- flow: "database"
- databases: 1250
- registers: 85
\`\`\`

**Setting Records Removed:**
\`\`\`
set_records_removed with:
- duplicates: 234
- automationTools: 45
- otherReasons: 12
\`\`\`

**Adding Exclusion Reason:**
\`\`\`
add_exclusion_reason with:
- phase: "screening"
- flow: "database"
- reason: "Wrong study design (not RCT)"
- count: 67
\`\`\`

**Auto-Calculating Derived Values:**
\`\`\`
auto_calculate with:
- flow: "both"
\`\`\`

**Exporting Flow Diagram:**
\`\`\`
export_flow_diagram with:
- format: "mermaid"
\`\`\`

## Flow Validation

The validate_flow_diagram tool checks:
- Identification data exists for at least one flow
- Included studies count is provided
- Flow consistency: identification - removed = screened
- Flow consistency: sought - not retrieved = assessed
- Warns about potential data inconsistencies

## Export Formats

**JSON**: Complete flow data for programmatic access
**Markdown**: Human-readable flow diagram for documentation
**Mermaid**: Diagram code for visualization tools

## Integration with Systematic Review Workflow

The PRISMA flow diagram skill integrates with:
1. **Literature Search**: Use identification numbers from database searches
2. **Screening Tools**: Track screening decisions and exclusions
3. **PRISMA Checklist**: Item 16 requires flow diagram documentation
4. **Data Extraction**: Included studies feed into data extraction process
5. **Publication**: Export flow diagram for manuscript figures`,

    tools: [
        setIdentificationTool,
        setRecordsRemovedTool,
        setScreeningTool,
        setRetrievalTool,
        setAssessmentTool,
        setIncludedTool,
        addExclusionReasonTool,
        exportFlowDiagramTool,
        clearFlowDiagramTool,
        validateFlowDiagramTool,
        autoCalculateTool
    ],

    onActivate: async () => {
        console.log('[PRISMAFlowDiagram] Skill activated - ready for PRISMA 2020 flow diagram management');
    },

    onDeactivate: async () => {
        console.log('[PRISMAFlowDiagram] Skill deactivated - cleaning up resources');
    },

    metadata: {
        author: 'AI Knowledge Base Team',
        created: '2025-02-22',
        updated: '2025-02-22',
        domain: 'Evidence-Based Medicine',
        framework: 'PRISMA 2020 Flow Diagram',
        component: 'PrismaFlowComponent',
        diagramVersion: 'PRISMA 2020',
        flowType: 'Dual flow (databases/registers + other methods)',
        phases: 'Identification, Screening, Retrieval, Assessment, Inclusion',
        useCases: 'Systematic reviews, meta-analyses, scoping reviews, guideline development',
        guidelines: 'PRISMA 2020 statement, MOOSE guidelines',
        visualization: 'Mermaid, Markdown, JSON'
    }
});
