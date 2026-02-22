import type { Tool } from '../../statefulContext/index.js';
import {
    setChecklistItemParamsSchema,
    setMultipleItemsParamsSchema,
    filterChecklistParamsSchema,
    exportChecklistParamsSchema,
    validateChecklistParamsSchema,
    clearChecklistParamsSchema,
    getProgressParamsSchema,
    setManuscriptMetadataParamsSchema
} from './prismaSchemas.js'

/**
 * Tool for setting a single checklist item status
 * Allows updating the completion status, location, and notes for a specific item
 */
export const setChecklistItemTool: Tool = {
    toolName: 'set_checklist_item',
    desc: 'Set or update a single PRISMA checklist item. Update the completion status, location in manuscript, and add notes for a specific item (1-27).',
    paramsSchema: setChecklistItemParamsSchema
};

/**
 * Tool for setting multiple checklist items at once
 * Useful for bulk updates or initial setup
 */
export const setMultipleItemsTool: Tool = {
    toolName: 'set_multiple_items',
    desc: 'Set or update multiple PRISMA checklist items at once. Useful for bulk updates or marking several items as completed.',
    paramsSchema: setMultipleItemsParamsSchema
};

/**
 * Tool for filtering checklist items
 * Allows viewing items by section, status, or topic
 */
export const filterChecklistTool: Tool = {
    toolName: 'filter_checklist',
    desc: 'Filter PRISMA checklist items by section (e.g., TITLE, ABSTRACT, INTRODUCTION, METHODS, RESULTS, DISCUSSION), status, or topic.',
    paramsSchema: filterChecklistParamsSchema
};

/**
 * Tool for exporting the checklist
 * Exports the current checklist state in various formats
 */
export const exportChecklistTool: Tool = {
    toolName: 'export_checklist',
    desc: 'Export the PRISMA checklist in JSON, Markdown, or CSV format. Can optionally include only completed items.',
    paramsSchema: exportChecklistParamsSchema
};

/**
 * Tool for validating the checklist
 * Checks if all required items are completed
 */
export const validateChecklistTool: Tool = {
    toolName: 'validate_checklist',
    desc: 'Validate the PRISMA checklist and check if all required items are completed. Provides feedback on completeness.',
    paramsSchema: validateChecklistParamsSchema
};

/**
 * Tool for clearing the checklist
 * Resets all items to not_started status
 */
export const clearChecklistTool: Tool = {
    toolName: 'clear_checklist',
    desc: 'Clear all PRISMA checklist items and reset them to not_started status. Requires confirmation.',
    paramsSchema: clearChecklistParamsSchema
};

/**
 * Tool for getting checklist progress
 * Shows completion statistics and progress
 */
export const getProgressTool: Tool = {
    toolName: 'get_progress',
    desc: 'Get the current progress of the PRISMA checklist, including completion percentage and statistics by section.',
    paramsSchema: getProgressParamsSchema
};

/**
 * Tool for setting manuscript metadata
 * Sets information about the systematic review manuscript
 */
export const setManuscriptMetadataTool: Tool = {
    toolName: 'set_manuscript_metadata',
    desc: 'Set manuscript metadata including title, authors, registration information, and protocol link.',
    paramsSchema: setManuscriptMetadataParamsSchema
};

/**
 * Map of all PRISMA tools
 * Can be used to initialize the toolSet in PrismaComponent
 */
export function createPrismaToolSet(): Map<string, Tool> {
    const tools = new Map<string, Tool>();

    tools.set('set_checklist_item', setChecklistItemTool);
    tools.set('set_multiple_items', setMultipleItemsTool);
    tools.set('filter_checklist', filterChecklistTool);
    tools.set('export_checklist', exportChecklistTool);
    tools.set('validate_checklist', validateChecklistTool);
    tools.set('clear_checklist', clearChecklistTool);
    tools.set('get_progress', getProgressTool);
    tools.set('set_manuscript_metadata', setManuscriptMetadataTool);

    return tools;
}

/**
 * Export individual tools for direct import if needed
 */
export const prismaTools = {
    setChecklistItem: setChecklistItemTool,
    setMultipleItems: setMultipleItemsTool,
    filterChecklist: filterChecklistTool,
    exportChecklist: exportChecklistTool,
    validateChecklist: validateChecklistTool,
    clearChecklist: clearChecklistTool,
    getProgress: getProgressTool,
    setManuscriptMetadata: setManuscriptMetadataTool
};
