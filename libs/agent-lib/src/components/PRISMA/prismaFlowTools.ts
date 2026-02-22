import type { Tool } from '../../statefulContext/index.js';
import {
    setIdentificationParamsSchema,
    setRecordsRemovedParamsSchema,
    setScreeningParamsSchema,
    setRetrievalParamsSchema,
    setAssessmentParamsSchema,
    setIncludedParamsSchema,
    addExclusionReasonParamsSchema,
    exportFlowDiagramParamsSchema,
    clearFlowDiagramParamsSchema,
    validateFlowDiagramParamsSchema,
    autoCalculateParamsSchema
} from './prismaFlowSchemas.js'

/**
 * Tool for setting identification numbers
 * Updates the number of records identified from various sources
 */
export const setIdentificationTool: Tool = {
    toolName: 'set_identification',
    desc: 'Set the number of records identified from databases, registers, websites, organisations, citation searching, or other methods. Specify which flow (database or other methods) to update.',
    paramsSchema: setIdentificationParamsSchema
};

/**
 * Tool for setting records removed before screening
 * Updates duplicate records, automation tool exclusions, and other removals
 */
export const setRecordsRemovedTool: Tool = {
    toolName: 'set_records_removed',
    desc: 'Set the number of records removed before screening: duplicates, records marked ineligible by automation tools, and records removed for other reasons.',
    paramsSchema: setRecordsRemovedParamsSchema
};

/**
 * Tool for setting screening phase data
 * Updates records screened, excluded, and exclusion reasons
 */
export const setScreeningTool: Tool = {
    toolName: 'set_screening',
    desc: 'Set screening phase data including records screened, records excluded, and reasons for exclusion.',
    paramsSchema: setScreeningParamsSchema
};

/**
 * Tool for setting retrieval phase data
 * Updates reports sought and not retrieved for each flow
 */
export const setRetrievalTool: Tool = {
    toolName: 'set_retrieval',
    desc: 'Set retrieval phase data for database or other methods flow, including reports sought for retrieval and reports not retrieved.',
    paramsSchema: setRetrievalParamsSchema
};

/**
 * Tool for setting assessment phase data
 * Updates reports assessed, excluded, and exclusion reasons
 */
export const setAssessmentTool: Tool = {
    toolName: 'set_assessment',
    desc: 'Set assessment phase data for database or other methods flow, including reports assessed, reports excluded, and reasons for exclusion.',
    paramsSchema: setAssessmentParamsSchema
};

/**
 * Tool for setting included studies
 * Updates the final count of included studies and reports
 */
export const setIncludedTool: Tool = {
    toolName: 'set_included',
    desc: 'Set the number of studies included in the review and reports of included studies (final counts).',
    paramsSchema: setIncludedParamsSchema
};

/**
 * Tool for adding exclusion reasons
 * Adds a new exclusion reason with count to screening or assessment phase
 */
export const addExclusionReasonTool: Tool = {
    toolName: 'add_exclusion_reason',
    desc: 'Add an exclusion reason with count to the screening or assessment phase for database or other methods flow.',
    paramsSchema: addExclusionReasonParamsSchema
};

/**
 * Tool for exporting flow diagram
 * Exports the flow diagram in various formats
 */
export const exportFlowDiagramTool: Tool = {
    toolName: 'export_flow_diagram',
    desc: 'Export the PRISMA flow diagram in JSON, Markdown, or Mermaid format.',
    paramsSchema: exportFlowDiagramParamsSchema
};

/**
 * Tool for clearing flow diagram
 * Resets all flow diagram data
 */
export const clearFlowDiagramTool: Tool = {
    toolName: 'clear_flow_diagram',
    desc: 'Clear all PRISMA flow diagram data and reset to empty state. Requires confirmation.',
    paramsSchema: clearFlowDiagramParamsSchema
};

/**
 * Tool for validating flow diagram
 * Validates the flow diagram data for consistency
 */
export const validateFlowDiagramTool: Tool = {
    toolName: 'validate_flow_diagram',
    desc: 'Validate the PRISMA flow diagram data for consistency and completeness. Checks if numbers flow correctly through the diagram.',
    paramsSchema: validateFlowDiagramParamsSchema
};

/**
 * Tool for auto-calculating derived values
 * Automatically calculates derived values based on entered data
 */
export const autoCalculateTool: Tool = {
    toolName: 'auto_calculate',
    desc: 'Automatically calculate derived values in the flow diagram, such as records screened (identification - removed) and reports assessed (sought - not retrieved).',
    paramsSchema: autoCalculateParamsSchema
};

/**
 * Map of all PRISMA flow diagram tools
 * Can be used to initialize the toolSet in PrismaFlowComponent
 */
export function createPrismaFlowToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    tools.set('set_identification', setIdentificationTool);
    tools.set('set_records_removed', setRecordsRemovedTool);
    tools.set('set_screening', setScreeningTool);
    tools.set('set_retrieval', setRetrievalTool);
    tools.set('set_assessment', setAssessmentTool);
    tools.set('set_included', setIncludedTool);
    tools.set('add_exclusion_reason', addExclusionReasonTool);
    tools.set('export_flow_diagram', exportFlowDiagramTool);
    tools.set('clear_flow_diagram', clearFlowDiagramTool);
    tools.set('validate_flow_diagram', validateFlowDiagramTool);
    tools.set('auto_calculate', autoCalculateTool);

    return tools;
}

/**
 * Export individual tools for direct import if needed
 */
export const prismaFlowTools = {
    setIdentification: setIdentificationTool,
    setRecordsRemoved: setRecordsRemovedTool,
    setScreening: setScreeningTool,
    setRetrieval: setRetrievalTool,
    setAssessment: setAssessmentTool,
    setIncluded: setIncludedTool,
    addExclusionReason: addExclusionReasonTool,
    exportFlowDiagram: exportFlowDiagramTool,
    clearFlowDiagram: clearFlowDiagramTool,
    validateFlowDiagram: validateFlowDiagramTool,
    autoCalculate: autoCalculateTool
};
