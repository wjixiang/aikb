import type { Tool } from '../../statefulContext/index.js';
import {
    setPicosElementParamsSchema,
    generateClinicalQuestionParamsSchema,
    clearPicosParamsSchema,
    validatePicosParamsSchema,
    exportPicosParamsSchema
} from './picosSchemas.js'

/**
 * Tool for setting or updating a specific PICOS element
 * Allows building the clinical question element by element
 */
export const setPicosElementTool: Tool = {
    toolName: 'set_picos_element',
    desc: 'Set or update a specific PICOS element (Patient, Intervention, Comparison, Outcome, or Study Design) to build a clinical question',
    paramsSchema: setPicosElementParamsSchema
};

/**
 * Tool for generating a clinical question
 * Creates a well-formatted clinical question based on the current PICOS elements
 */
export const generateClinicalQuestionTool: Tool = {
    toolName: 'generate_clinical_question',
    desc: 'Generate a clinical question based on the current PICOS elements. Can output in natural language, structured format, or both.',
    paramsSchema: generateClinicalQuestionParamsSchema
};

/**
 * Tool for validating PICOS formulation
 * Checks if the current PICOS elements form a complete and valid clinical question
 */
export const validatePicosTool: Tool = {
    toolName: 'validate_picos',
    desc: 'Validate the current PICOS formulation and provide feedback on completeness and quality',
    paramsSchema: validatePicosParamsSchema
};

/**
 * Tool for clearing all PICOS elements
 * Resets all PICOS elements to start fresh
 */
export const clearPicosTool: Tool = {
    toolName: 'clear_picos',
    desc: 'Clear all PICOS elements and reset the clinical question formulation',
    paramsSchema: clearPicosParamsSchema
};

/**
 * Tool for exporting PICOS data
 * Exports the current PICOS formulation in various formats for documentation or search
 */
export const exportPicosTool: Tool = {
    toolName: 'export_picos',
    desc: 'Export the current PICOS formulation in JSON, Markdown, or search format for literature databases',
    paramsSchema: exportPicosParamsSchema
};

/**
 * Map of all PICOS tools
 * Can be used to initialize the toolSet in PicosComponent
 */
export function createPicosToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    tools.set('set_picos_element', setPicosElementTool);
    tools.set('generate_clinical_question', generateClinicalQuestionTool);
    tools.set('validate_picos', validatePicosTool);
    tools.set('clear_picos', clearPicosTool);
    tools.set('export_picos', exportPicosTool);

    return tools;
}

/**
 * Export individual tools for direct import if needed
 */
export const picosTools = {
    setPicosElement: setPicosElementTool,
    generateClinicalQuestion: generateClinicalQuestionTool,
    validatePicos: validatePicosTool,
    clearPicos: clearPicosTool,
    exportPicos: exportPicosTool
};
