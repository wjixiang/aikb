import update_workspace from '../native-tools/update_workspace';
import { getUpdateWorkspaceDescription } from '../update-workspace';
import { Tool } from '../types';

/**
 * Update workspace tool - allows LLM to modify editable status fields in the workspace
 */
export const update_workspace_tool: Tool = {
    native: update_workspace,
    xml: getUpdateWorkspaceDescription,
};
